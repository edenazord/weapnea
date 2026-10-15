import { config } from "./config.mjs";
import { getAccessToken } from "./google.mjs";

const SITEMAPS_URL = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/sitemaps`;
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

async function api(url, options = {}) {
  const token = await getAccessToken(config.googleKeyFile);
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

// Esito dell'indicizzazione di ogni pagina statica con l'URL Inspection API.
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
