import { config } from "./config.mjs";
import { getAccessToken, SCOPE_READONLY, SCOPE_WRITE } from "./google.mjs";

const SITEMAPS_URL = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/sitemaps`;
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
// Google riscarica le sitemap da solo: reinviamo solo se l'ultimo download è più vecchio di così.
const STALE_AFTER_DAYS = 3;

async function api(url, { scope = SCOPE_READONLY, ...options } = {}) {
  const token = await getAccessToken(config.googleKeyFile, scope);
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// Stato delle sitemap inviate a Search Console: errori, avvisi e URL indicizzate.
export async function sitemapStatus() {
  const data = await api(SITEMAPS_URL);
  return (data.sitemap ?? []).map((s) => {
    const contents = s.contents ?? [];
    return {
      path: s.path,
      lastDownloaded: s.lastDownloaded ?? null,
      errors: Number(s.errors ?? 0),
      warnings: Number(s.warnings ?? 0),
      submitted: contents.reduce((n, c) => n + Number(c.submitted ?? 0), 0),
      indexed: contents.reduce((n, c) => n + Number(c.indexed ?? 0), 0),
    };
  });
}

// Reinvia la sitemap pubblica a Search Console se Google non la riscarica da troppo tempo,
// oppure subito con force quando ci sono URL nuove o cambiate.
export async function refreshSitemap({ force = false } = {}) {
  const feed = `${config.publicBaseUrl}/sitemap.xml`;
  const current = (await sitemapStatus()).find((s) => s.path === feed);
  const lastDownload = current?.lastDownloaded ? Date.parse(current.lastDownloaded) : 0;
  const ageDays = (Date.now() - lastDownload) / 86_400_000;
  if (!force && current && ageDays < STALE_AFTER_DAYS)
    return { submitted: false, ageDays: round(ageDays) };

  await api(`${SITEMAPS_URL}/${encodeURIComponent(feed)}`, {
    method: "PUT",
    scope: SCOPE_WRITE,
  });
  return { submitted: true, previousDownload: current?.lastDownloaded ?? null };
}

function round(n) {
  return Math.round(n * 10) / 10;
}


export async function inspectPages(paths) {
  const results = [];
  for (const p of paths) {
    try {
      const data = await api(INSPECT_URL, {
        method: "POST",
        body: JSON.stringify({
          inspectionUrl: `${config.publicBaseUrl}${p}`,
          siteUrl: config.siteUrl,
        }),
      });
      const status = data.inspectionResult?.indexStatusResult ?? {};
      results.push({
        path: p,
        verdict: status.verdict ?? "UNKNOWN",
        coverage: status.coverageState ?? null,
        lastCrawl: status.lastCrawlTime ?? null,
        canonical: status.googleCanonical ?? null,
      });
    } catch (err) {
      results.push({ path: p, error: err.message });
    }
  }
  return results;
}
