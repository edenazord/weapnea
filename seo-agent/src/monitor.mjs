import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { fetchSitemap } from "./indexnow.mjs";
import { sendGroupMessage } from "./whatsapp.mjs";

const STATE_FILE = path.join(config.dataDir, "memory", "monitor-state.json");
const PSI_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const PSI_MIN_SCORE = 50;
const PSI_MAX_LCP_MS = 4000;
const CONCURRENCY = 5;

async function head(url) {
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  await res.body?.cancel();
  return res;
}

async function checkSitemapUrls(urls, problems) {
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((url) => head(url).then((r) => r.status, (err) => err.name)),
    );
    results.forEach((status, idx) => {
      if (status !== 200) {
        const p = new URL(batch[idx]).pathname;
        problems.push({
          key: `status:${p}`,
          text: `${p} risponde ${status} invece di 200`,
        });
      }
    });
  }
}

// Il dominio senza www deve fare un redirect permanente (301) verso il sito principale.
async function checkApexRedirect(problems) {
  const site = new URL(config.publicBaseUrl);
  if (!site.host.startsWith("www.")) return;
  const apex = site.host.slice(4);
  const res = await head(`${site.protocol}//${apex}/`);
  const location = res.headers.get("location") ?? "";
  if (![301, 308].includes(res.status) || !location.startsWith(config.publicBaseUrl))
    problems.push({
      key: "apex-redirect",
      text: `${apex} risponde ${res.status} invece di un redirect permanente (301) verso ${site.host}`,
    });
}

async function checkRobots(problems) {
  const res = await fetch(`${config.publicBaseUrl}/robots.txt`, {
    signal: AbortSignal.timeout(15_000),
  });
  const body = res.ok ? await res.text() : "";
  if (!res.ok || !/^sitemap:/im.test(body))
    problems.push({
      key: "robots",
      text: `robots.txt non valido (HTTP ${res.status}) o senza riga Sitemap`,
    });
}

// PageSpeed è un controllo a parte: se fallisce (quota, rete) non genera un avviso WhatsApp.
async function checkPageSpeed(problems) {
  const url = new URL(PSI_URL);
  url.searchParams.set("url", `${config.publicBaseUrl}/`);
  url.searchParams.set("strategy", "mobile");
  url.searchParams.append("category", "performance");
  if (config.pagespeedApiKey)
    url.searchParams.set("key", config.pagespeedApiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`PageSpeed HTTP ${res.status}: ${data.error?.message ?? ""}`);

  const lighthouse = data.lighthouseResult ?? {};
  const score = Math.round((lighthouse.categories?.performance?.score ?? 0) * 100);
  const lcp = lighthouse.audits?.["largest-contentful-paint"]?.numericValue ?? 0;
  if (score < PSI_MIN_SCORE)
    problems.push({
      key: "psi-score-home",
      text: `prestazioni mobile della home ${score}/100 (soglia ${PSI_MIN_SCORE})`,
    });
  if (lcp > PSI_MAX_LCP_MS)
    problems.push({
      key: "psi-lcp-home",
      text: `LCP mobile della home ${Math.round(lcp / 100) / 10} s (soglia ${PSI_MAX_LCP_MS / 1000} s)`,
    });
  return { score, lcpMs: Math.round(lcp) };
}

// Esegue i controlli senza inviare nulla. Restituisce i problemi e le avvertenze.
export async function runChecks() {
  const problems = [];
  const warnings = [];
  let urls = [];

  try {
    urls = [...(await fetchSitemap()).keys()];
    if (!urls.length) problems.push({ key: "sitemap", text: "sitemap senza URL" });
  } catch (err) {
    problems.push({ key: "sitemap", text: `sitemap non raggiungibile: ${err.message}` });
  }

  await checkSitemapUrls(urls, problems);
  await checkApexRedirect(problems);
  await checkRobots(problems);
  let pagespeed = null;
  try {
    pagespeed = await checkPageSpeed(problems);
  } catch (err) {
    warnings.push(`PageSpeed non disponibile: ${err.message}`);
  }
  return { checked: urls.length, pagespeed, problems, warnings };
}

async function readState() {
  try {
    return new Set(JSON.parse(await readFile(STATE_FILE, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return new Set();
    throw err;
  }
}

async function writeState(keys) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(keys, null, 2)}\n`, "utf8");
}

// Problemi nuovi rispetto al run precedente. Non invia nulla e non salva lo stato.
export async function freshProblems(result) {
  const previous = await readState();
  return result.problems.filter((p) => !previous.has(p.key));
}

// Salva i problemi attuali: va chiamata solo dopo un invio riuscito, così un avviso non va perso.
export async function saveMonitorState(result) {
  await writeState(result.problems.map((p) => p.key));
}

// Percorsi delle pagine con problemi che l'ottimizzatore non deve toccare.
export function brokenPaths(result) {
  return result.problems
    .filter((p) => p.key.startsWith("status:"))
    .map((p) => p.key.slice("status:".length));
}

// Avvisa nel gruppo solo per i problemi nuovi (usato fuori dal cron, che invia un unico digest).
export async function runMonitor({ notify = true, result } = {}) {
  const checks = result ?? (await runChecks());
  for (const w of checks.warnings) console.warn(`::warning::Monitor: ${w}`);

  const fresh = await freshProblems(checks);
  if (notify) {
    if (fresh.length)
      await sendGroupMessage(
        [
          "Monitor SEO weapnea: nuovi problemi tecnici",
          ...fresh.map((p) => `- ${p.text}`),
        ].join("\n"),
      );
    await saveMonitorState(checks);
  }
  return { ...checks, fresh };
}
