import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { getAccessToken, SCOPE_READONLY } from "./google.mjs";
import { fetchSitemap } from "./sitemap.mjs";

const STATE_FILE = path.join(config.dataDir, "memory", "indexing-state.json");
const INSPECT_URL = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const CONCURRENCY = 5;

async function inspect(token, url) {
  const res = await fetch(INSPECT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inspectionUrl: url,
      siteUrl: config.siteUrl,
      languageCode: "it",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(`URL Inspection ${res.status}: ${JSON.stringify(data.error ?? {}).slice(0, 200)}`);
  const s = data.inspectionResult?.indexStatusResult ?? {};
  return {
    verdict: s.verdict ?? "UNKNOWN",
    coverageState: s.coverageState ?? "stato sconosciuto",
    userCanonical: s.userCanonical ?? null,
    googleCanonical: s.googleCanonical ?? null,
    lastCrawlTime: s.lastCrawlTime ?? null,
  };
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

// Stati che dipendono da canonical, redirect o tag e non si risolvono cambiando title e description.
const TECHNICAL_STATE = /duplicat|canonic|reindirizz|redirect|soft 404|noindex|non trovat|not found/i;
// Da quando Googlebot riceve canonical e title corretti (middleware, commit 850faab).
const BOT_FIX_AT = Date.parse("2026-10-15T10:48:46Z");

// Ispeziona ogni URL della sitemap. Restituisce le pagine non indicizzate non ancora segnalate.
// Al primo run (nessuno stato salvato) registra lo stato attuale senza avvisare.
// Non invia nulla: lo stato si salva con saveIndexingState solo dopo un invio riuscito.
export async function checkIndexing() {
  const urls = [...(await fetchSitemap()).keys()];
  const token = await getAccessToken(config.googleKeyFile, SCOPE_READONLY);
  const state = await readState();
  const firstRun = state === null;
  const alerted = state?.alerted ?? {};

  const nextAlerted = {};
  const issues = [];
  const problemPaths = [];
  // Diagnosi per le pagine tecniche: quale canonical dichiariamo e quale ha scelto Google.
  const diagnosis = [];
  // Pagine segnalate prima e ora con verdetto PASS.
  const resolved = [];
  // Pagine tecniche ricrawlate da Google dopo la correzione e ancora segnalate, non ancora riportate.
  const previousRecrawled = new Set(state?.recrawled ?? []);
  const nextRecrawled = [];
  const newlyRecrawled = [];
  let errors = 0;
  let indexed = 0;
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((url) => inspect(token, url).then((r) => r, (err) => err)),
    );
    results.forEach((r, idx) => {
      const url = batch[idx];
      if (r instanceof Error) {
        // Errore temporaneo: si mantiene lo stato precedente e non si avvisa.
        errors += 1;
        if (alerted[url]) nextAlerted[url] = alerted[url];
        if (previousRecrawled.has(new URL(url).pathname)) nextRecrawled.push(new URL(url).pathname);
        return;
      }
      const pathname = new URL(url).pathname;
      if (r.verdict === "PASS") {
        indexed += 1;
        if (!firstRun && alerted[url]) resolved.push(pathname);
        return;
      }
      if (TECHNICAL_STATE.test(r.coverageState)) {
        problemPaths.push(pathname);
        const recrawledSinceFix = Boolean(r.lastCrawlTime) && Date.parse(r.lastCrawlTime) >= BOT_FIX_AT;
        diagnosis.push({
          path: pathname,
          coverageState: r.coverageState,
          userCanonical: r.userCanonical,
          googleCanonical: r.googleCanonical,
          lastCrawlTime: r.lastCrawlTime,
          recrawledSinceFix,
        });
        if (recrawledSinceFix) {
          nextRecrawled.push(pathname);
          if (!firstRun && !previousRecrawled.has(pathname)) newlyRecrawled.push(pathname);
        }
      }
      nextAlerted[url] = r.coverageState;
      if (!firstRun && alerted[url] !== r.coverageState)
        issues.push({ path: pathname, coverageState: r.coverageState });
    });
  }

  return {
    checked: urls.length,
    errors,
    indexed,
    notIndexed: urls.length - indexed - errors,
    issues,
    // Percorsi con problemi tecnici: l'ottimizzatore di title e description non li deve toccare.
    problemPaths,
    diagnosis,
    resolved,
    newlyRecrawled,
    nextState: { alerted: nextAlerted, recrawled: nextRecrawled },
  };
}

export async function saveIndexingState(result) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(result.nextState, null, 2)}\n`, "utf8");
}
