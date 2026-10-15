import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { getAccessToken } from "./google.mjs";
import { sendGroupMessage } from "./whatsapp.mjs";

const STATE_FILE = path.join(config.dataDir, "memory", "analytics-state.json");
const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const CRUX_URL = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
// Soglie "buone" di Google Core Web Vitals (p75).
const CWV_GOOD = { lcpMs: 2500, inpMs: 200, cls: 0.1 };

// Pagine più visitate negli ultimi 28 giorni. Vuoto se GA4_PROPERTY_ID non è impostata.
export async function fetchTopPages(limit = 15) {
  if (!config.ga4PropertyId) return [];
  const token = await getAccessToken(config.googleKeyFile, GA_SCOPE);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.ga4PropertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "activeUsers" },
          { name: "engagementRate" },
        ],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`GA4 ${res.status}: ${JSON.stringify(data.error ?? {}).slice(0, 300)}`);
  return (data.rows ?? []).map((r) => ({
    path: r.dimensionValues[0].value,
    views: Number(r.metricValues[0].value),
    users: Number(r.metricValues[1].value),
    engagementRate: Math.round(Number(r.metricValues[2].value) * 1000) / 10,
  }));
}

// Core Web Vitals reali (Chrome UX Report) del sito, su mobile. Null se Google non ha abbastanza dati.
export async function fetchCrux() {
  if (!config.cruxApiKey) return null;
  const res = await fetch(`${CRUX_URL}?key=${encodeURIComponent(config.cruxApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: new URL(config.publicBaseUrl).origin,
      formFactor: "PHONE",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`CrUX ${res.status}: ${JSON.stringify(data.error ?? {}).slice(0, 200)}`);
  const m = data.record?.metrics ?? {};
  return {
    lcpMs: Number(m.largest_contentful_paint?.percentiles?.p75 ?? NaN),
    inpMs: Number(m.interaction_to_next_paint?.percentiles?.p75 ?? NaN),
    cls: Number(m.cumulative_layout_shift?.percentiles?.p75 ?? NaN),
  };
}

const fmtSec = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const mark = (ok) => (ok ? "buono" : "da migliorare");

export async function buildMonthlyReport() {
  const [pages, vitals] = await Promise.all([
    fetchTopPages().catch((err) => {
      console.warn(`::warning::Google Analytics non disponibile: ${err.message}`);
      return [];
    }),
    fetchCrux().catch((err) => {
      console.warn(`::warning::CrUX non disponibile: ${err.message}`);
      return null;
    }),
  ]);
  if (!pages.length && !vitals) return null;

  const lines = ["SEO weapnea: report mensile", "Ultimi 28 giorni"];
  if (pages.length) {
    lines.push("", "Pagine più visitate (Google Analytics):");
    for (const p of pages.slice(0, 10))
      lines.push(`- ${p.path}: ${p.views} visualizzazioni, ${p.users} utenti`);
  }
  if (vitals && Number.isFinite(vitals.lcpMs)) {
    lines.push(
      "",
      "Velocità reali su mobile (Chrome, p75):",
      `- LCP ${fmtSec(vitals.lcpMs)} (${mark(vitals.lcpMs <= CWV_GOOD.lcpMs)}, soglia ${fmtSec(CWV_GOOD.lcpMs)})`,
      `- INP ${Math.round(vitals.inpMs)} ms (${mark(vitals.inpMs <= CWV_GOOD.inpMs)}, soglia ${CWV_GOOD.inpMs} ms)`,
      `- CLS ${vitals.cls.toFixed(2).replace(".", ",")} (${mark(vitals.cls <= CWV_GOOD.cls)}, soglia ${String(CWV_GOOD.cls).replace(".", ",")})`,
    );
  }
  return lines.join("\n");
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

// Usato dal cron: al massimo un report al mese. Lo stato si salva solo dopo l'invio.
export async function sendMonthlyReportIfDue() {
  const month = new Date().toISOString().slice(0, 7);
  const { lastSentMonth } = await readState();
  if (lastSentMonth === month) return { sent: false, reason: "report del mese già inviato" };

  const text = await buildMonthlyReport();
  if (!text) return { sent: false, reason: "nessuna fonte configurata" };

  await sendGroupMessage(text);
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify({ lastSentMonth: month }, null, 2)}\n`, "utf8");
  return { sent: true };
}
