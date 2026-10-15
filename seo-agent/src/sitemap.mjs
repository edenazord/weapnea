import { config } from "./config.mjs";

// Mappa URL -> lastmod (stringa vuota se la sitemap non lo indica).
export function parseSitemap(xml) {
  const urls = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1]?.trim();
    if (!loc) continue;
    urls.set(loc, block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? "");
  }
  return urls;
}

export async function fetchSitemap() {
  const res = await fetch(`${config.publicBaseUrl}/sitemap.xml`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`);
  return parseSitemap(await res.text());
}
