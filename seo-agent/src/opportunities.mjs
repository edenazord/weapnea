import { config } from "./config.mjs";
import { searchAnalytics } from "./google.mjs";

// Search Console ritarda di qualche giorno: la finestra finisce 3 giorni fa, come nel report.
const LAG_DAYS = 3;
const WINDOW_DAYS = 28;
const STRIKING_MIN_POSITION = 4;
const STRIKING_MAX_POSITION = 15;
const MIN_IMPRESSIONS = 20;
const MIN_PAGE_IMPRESSIONS = 10;

const day = (d) => d.toISOString().slice(0, 10);
const pathOf = (url) => new URL(url).pathname;

// Query che potrebbero salire con poco lavoro, e query contese da più pagine dello stesso sito.
export async function findOpportunities() {
  const end = new Date(Date.now() - LAG_DAYS * 86_400_000);
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * 86_400_000);
  const rows = await searchAnalytics({
    siteUrl: config.siteUrl,
    keyFile: config.googleKeyFile,
    startDate: day(start),
    endDate: day(end),
    dimensions: ["query", "page"],
    rowLimit: 25_000,
  });

  const striking = rows
    .filter(
      (r) =>
        r.position >= STRIKING_MIN_POSITION &&
        r.position <= STRIKING_MAX_POSITION &&
        r.impressions >= MIN_IMPRESSIONS,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .map((r) => ({
      query: r.keys[0],
      page: pathOf(r.keys[1]),
      position: Math.round(r.position * 10) / 10,
      impressions: r.impressions,
      clicks: r.clicks,
    }));

  const byQuery = new Map();
  for (const r of rows) {
    if (r.impressions < MIN_PAGE_IMPRESSIONS) continue;
    const list = byQuery.get(r.keys[0]) ?? [];
    list.push({ page: pathOf(r.keys[1]), impressions: r.impressions, position: r.position });
    byQuery.set(r.keys[0], list);
  }
  const cannibalization = [...byQuery]
    .filter(([, pages]) => pages.length > 1)
    .map(([query, pages]) => ({
      query,
      pages: pages.sort((a, b) => b.impressions - a.impressions),
      impressions: pages.reduce((n, p) => n + p.impressions, 0),
    }))
    .sort((a, b) => b.impressions - a.impressions);

  return { window: { start: day(start), end: day(end) }, striking, cannibalization };
}

// Opportunità di una singola pagina, da passare all'ottimizzatore. Null se non ce ne sono.
export function opportunitiesForPage(pagePath, { striking, cannibalization }) {
  const r1 = (n) => Math.round(n * 10) / 10;
  const queriesToTarget = striking
    .filter((s) => s.page === pagePath)
    .slice(0, 5)
    .map(({ query, position, impressions }) => ({ query, position, impressions }));
  const sharedQueries = cannibalization
    .filter((c) => c.pages.some((p) => p.page === pagePath))
    .slice(0, 3)
    .map((c) => ({
      query: c.query,
      competingPages: c.pages.map((p) => ({ page: p.page, position: r1(p.position) })),
    }));
  if (!queriesToTarget.length && !sharedQueries.length) return null;
  return { queriesToTarget, sharedQueries };
}

export async function printOpportunities() {
  const { window, striking, cannibalization } = await findOpportunities();
  console.log(`\nOpportunità (${window.start} → ${window.end})`);

  console.log(`\nQuery in posizione ${STRIKING_MIN_POSITION}–${STRIKING_MAX_POSITION} con almeno ${MIN_IMPRESSIONS} impressioni:`);
  const topStriking = striking.slice(0, 10);
  if (!topStriking.length) console.log("  nessuna");
  for (const s of topStriking)
    console.log(`  "${s.query}" → ${s.page} | pos ${s.position} | ${s.impressions} impr. | ${s.clicks} clic`);

  console.log("\nQuery contese da più pagine:");
  const topShared = cannibalization.slice(0, 5);
  if (!topShared.length) console.log("  nessuna");
  for (const c of topShared)
    console.log(
      `  "${c.query}": ${c.pages.map((p) => `${p.page} (pos ${Math.round(p.position * 10) / 10}, ${p.impressions} impr.)`).join(" vs ")}`,
    );
  return { striking, cannibalization };
}
