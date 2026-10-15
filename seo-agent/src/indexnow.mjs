import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";

// IndexNow: Bing, Yandex e gli altri motori aderenti ricevono subito gli URL nuovi o modificati.
const ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_REQUEST = 10_000;
const SNAPSHOT_FILE = path.join(config.dataDir, "memory", "sitemap-snapshot.json");

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

// URL nuove o con lastmod cambiato rispetto allo snapshot. Senza snapshot (primo run) sono tutte.
export function changedUrls(current, previous) {
  if (!previous) return [...current.keys()];
  return [...current]
    .filter(([url, lastmod]) => !previous.has(url) || previous.get(url) !== lastmod)
    .map(([url]) => url);
}

async function readSnapshot() {
  try {
    const data = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8"));
    return new Map(Object.entries(data));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function saveSnapshot(urls) {
  await mkdir(path.dirname(SNAPSHOT_FILE), { recursive: true });
  await writeFile(
    SNAPSHOT_FILE,
    `${JSON.stringify(Object.fromEntries(urls), null, 2)}\n`,
    "utf8",
  );
}

export async function submitUrls(urls) {
  if (!config.indexNowKey) throw new Error("INDEXNOW_KEY non impostata");
  const host = new URL(config.publicBaseUrl).host;
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      // La chiave è servita come file nella root del sito (public/<chiave>.txt).
      body: JSON.stringify({
        host,
        key: config.indexNowKey,
        urlList: urls.slice(i, i + MAX_URLS_PER_REQUEST),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`IndexNow HTTP ${res.status}`);
  }
}

// Invia a IndexNow le URL cambiate in sitemap e le pagine modificate dal run.
// Lo snapshot viene salvato solo dopo un invio riuscito, così il run successivo riprova.
export async function notifyChangedUrls(changedPaths = []) {
  const current = await fetchSitemap();
  const previous = await readSnapshot();
  const fromSitemap = changedUrls(current, previous);
  const fromRun = changedPaths.map((p) => `${config.publicBaseUrl}${p}`);
  const urls = [...new Set([...fromSitemap, ...fromRun])];

  if (urls.length) await submitUrls(urls);
  await saveSnapshot(current);
  return {
    submitted: urls.length,
    fromSitemap: fromSitemap.length,
    bootstrap: previous === null,
  };
}
