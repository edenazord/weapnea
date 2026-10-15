import { config } from "./config.mjs";
import { fetchCrux, fetchGa4Totals, fetchTopPages } from "./analytics.mjs";
import { searchAnalytics } from "./google.mjs";
import { readEvaluations, readRuns } from "./memory.mjs";
import { sitemapStatus } from "./technical.mjs";
import { saveSeoOverview } from "./site-api.mjs";

const DAY_MS = 86_400_000;
const GSC_LAG_DAYS = 3;
const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
const round = (n, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

// Ogni fonte è isolata: se una fallisce (quota, permessi, rete) il suo blocco diventa null
// e la panoramica viene comunque salvata con gli altri dati.
async function safeSource(name, fn, errors) {
  try {
    return await fn();
  } catch (err) {
    errors.push(`${name}: ${err.message}`);
    return null;
  }
}

// Totali GSC (clic, impressioni, CTR, posizione media) su un intervallo di date.
// La riga senza dimensioni dà il totale esatto del periodo.
async function gscTotals(startDate, endDate) {
  const rows = await searchAnalytics({
    siteUrl: config.siteUrl,
    keyFile: config.googleKeyFile,
    startDate,
    endDate,
    dimensions: [],
    rowLimit: 1,
  });
  const r = rows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: round(r.ctr * 100),
    position: round(r.position),
  };
}

async function gscTop(dimension, limit = 10) {
  const end = addDays(new Date(), -GSC_LAG_DAYS);
  const start = addDays(end, -27);
  const rows = await searchAnalytics({
    siteUrl: config.siteUrl,
    keyFile: config.googleKeyFile,
    startDate: fmt(start),
    endDate: fmt(end),
    dimensions: [dimension],
    rowLimit: limit,
  });
  return rows
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit)
    .map((r) => ({
      key: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: round(r.position),
    }));
}

async function gscSection() {
  const end = addDays(new Date(), -GSC_LAG_DAYS);
  const start = addDays(end, -27);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -27);
  const [current, previous, queries, pages] = await Promise.all([
    gscTotals(fmt(start), fmt(end)),
    gscTotals(fmt(prevStart), fmt(prevEnd)),
    gscTop("query"),
    gscTop("page"),
  ]);
  return {
    period: { start: fmt(start), end: fmt(end) },
    current,
    previous,
    topQueries: queries,
    topPages: pages,
  };
}

// Conteggi dei verdetti delle valutazioni e ultimo run registrato.
async function agentSection() {
  const [runs, evaluations] = await Promise.all([readRuns(), readEvaluations()]);
  const lastRun = runs.at(-1) ?? null;
  const verdicts = {};
  for (const e of evaluations) verdicts[e.verdict] = (verdicts[e.verdict] ?? 0) + 1;
  return {
    lastRun: lastRun
      ? {
          at: lastRun.at,
          mode: lastRun.mode,
          applied: lastRun.applied?.length ?? 0,
          errors: lastRun.errors?.length ?? 0,
          skipped: lastRun.skipped ?? 0,
        }
      : null,
    evaluations: { total: evaluations.length, verdicts },
  };
}

// Costruisce lo snapshot mostrato nella sezione SEO dell'admin e lo salva sul backend.
// Riceve il risultato di checkIndexing già calcolato dal cron, per non rifare le ispezioni URL.
// Non modifica il sito e non invia messaggi.
export async function buildOverview({ indexing = null } = {}) {
  const errors = [];
  const [gsc, ga4Totals, ga4Pages, crux, sitemaps, agent] = await Promise.all([
    safeSource("gsc", gscSection, errors),
    safeSource("ga4Totals", fetchGa4Totals, errors),
    safeSource("ga4Pages", () => fetchTopPages(10), errors),
    safeSource("crux", fetchCrux, errors),
    safeSource("sitemap", sitemapStatus, errors),
    safeSource("agent", agentSection, errors),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    gsc,
    ga4: ga4Totals ? { ...ga4Totals, topPages: ga4Pages ?? [] } : null,
    cwv: crux,
    sitemaps: sitemaps ?? [],
    indexing: indexing
      ? {
          checked: indexing.checked,
          indexed: indexing.indexed,
          notIndexed: indexing.notIndexed,
          errors: indexing.errors,
          // Pagine con stato tecnico (duplicata, canonical, redirect, noindex, non trovata).
          technicalProblems: indexing.problemPaths,
          diagnosis: indexing.diagnosis,
        }
      : null,
    agent: agent ?? null,
    errors,
  };
}

export async function publishOverview({ indexing = null } = {}) {
  const overview = await buildOverview({ indexing });
  await saveSeoOverview(overview);
  return overview;
}

