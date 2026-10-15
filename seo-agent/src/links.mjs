import { config } from "./config.mjs";
import { fetchSitemap } from "./sitemap.mjs";

const MAX_PAGES = 300;
const CONCURRENCY = 3;
const PAGE_TIMEOUT_MS = 30_000;
// Percorsi privati o di servizio (primo segmento): non vanno nell'indice, quindi non si seguono.
const SKIP_SEGMENTS = ["admin", "api", "login", "logout", "register", "auth"];
const SKIP_EXTENSIONS = /\.(png|jpe?g|webp|gif|svg|ico|pdf|txt|xml|json)$/i;

const sameSite = (url, base) =>
  url.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");

// Percorso normalizzato di un href interno alla pagina `from`, oppure null se non va seguito.
function internalPath(href, from, base) {
  let url;
  try {
    url = new URL(href, from);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || !sameSite(url, base)) return null;
  const p = url.pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return p;
  const first = p.split("/")[1];
  if (SKIP_SEGMENTS.includes(first) || SKIP_EXTENSIONS.test(p)) return null;
  return p;
}

// Carica la pagina nel browser (il JS dell'SPA genera i link degli eventi) e restituisce i percorsi interni.
async function collectLinks(context, base, p) {
  const page = await context.newPage();
  try {
    await page.goto(new URL(p, base).href, { waitUntil: "load", timeout: PAGE_TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    const from = new URL(p, base).href;
    return hrefs.map((h) => internalPath(h, from, base)).filter(Boolean);
  } catch (err) {
    console.warn(`::warning::Pagina ${p} non esplorata: ${err.message.split("\n")[0]}`);
    return [];
  } finally {
    await page.close();
  }
}

// Esplora il sito partendo dalla home seguendo solo i link interni renderizzati.
// Le URL della sitemap che nessuna pagina esplorata collega sono "orfane" per Google.
export async function findOrphanPages() {
  const { chromium } = await import("playwright");
  const base = new URL(config.publicBaseUrl);
  const sitemapPaths = new Set(
    [...(await fetchSitemap()).keys()].map((u) => new URL(u).pathname.replace(/\/+$/, "") || "/"),
  );

  const visited = new Set(["/"]);
  const queue = ["/"];
  const linkedFrom = new Map(); // percorso -> pagine che lo collegano (escluso se stesso)

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    while (queue.length && visited.size <= MAX_PAGES) {
      const batch = queue.splice(0, CONCURRENCY);
      const results = await Promise.all(batch.map((p) => collectLinks(context, base, p)));
      results.forEach((targets, idx) => {
        const from = batch[idx];
        for (const to of targets) {
          if (to !== from) {
            if (!linkedFrom.has(to)) linkedFrom.set(to, new Set());
            linkedFrom.get(to).add(from);
          }
          if (!visited.has(to) && visited.size < MAX_PAGES) {
            visited.add(to);
            queue.push(to);
          }
        }
      });
    }
  } finally {
    await browser.close();
  }

  const orphans = [...sitemapPaths]
    .filter((p) => p !== "/" && !linkedFrom.has(p))
    .sort();
  return {
    crawled: visited.size,
    sitemap: sitemapPaths.size,
    truncated: visited.size >= MAX_PAGES,
    orphans,
  };
}
