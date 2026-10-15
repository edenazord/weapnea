import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";
import { chatJson } from "./deepseek.mjs";
import { CONTENT_PROMPT } from "./prompt.mjs";
import { searchAnalytics } from "./google.mjs";
import { fetchTopPages } from "./analytics.mjs";
import { fetchSearchSuggestions, fetchWikipediaInterest } from "./sources.mjs";
import { getBlogArticles } from "./site-api.mjs";
import { buildContentMessage, sendGroupMessage } from "./whatsapp.mjs";

const STATE_FILE = path.join(config.dataDir, "memory", "content-state.json");
// Search Console ritarda di qualche giorno, come nelle opportunità.
const LAG_DAYS = 3;
const WINDOW_DAYS = 28;
const MIN_QUERY_IMPRESSIONS = 10;
const MAX_QUERIES = 60;
const MAX_ARTICLES = 200;
const MAX_SUGGESTIONS = 3;
const DAY_MS = 86_400_000;

const day = (d) => d.toISOString().slice(0, 10);
const cut = (s, n) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

// Domanda reale: query con impressioni, da confrontare con gli articoli già pubblicati.
async function fetchDemand() {
  const end = new Date(Date.now() - LAG_DAYS * DAY_MS);
  const start = new Date(end.getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const rows = await searchAnalytics({
    siteUrl: config.siteUrl,
    keyFile: config.googleKeyFile,
    startDate: day(start),
    endDate: day(end),
    dimensions: ["query"],
    rowLimit: 1000,
  });
  return rows
    .filter((r) => r.impressions >= MIN_QUERY_IMPRESSIONS)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, MAX_QUERIES)
    .map((r) => ({
      query: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: Math.round(r.position * 10) / 10,
    }));
}

// Articoli già pubblicati, in qualsiasi lingua: servono per non riproporre temi coperti.
async function existingArticles() {
  const articles = await getBlogArticles();
  return {
    total: articles.length,
    list: articles.slice(0, MAX_ARTICLES).map((a) => ({
      title: a.title,
      language: a.language || "it",
      tags: (a.tags ?? []).map((t) => t.name),
      keywords: a.seo_keywords ?? null,
      excerpt: cut(a.excerpt || a.subtitle, 140) || null,
    })),
  };
}

// Scarta le idee incomplete: ogni idea deve avere un titolo valido in tutte le lingue del sito.
function validSuggestions(raw) {
  const list = Array.isArray(raw?.suggestions) ? raw.suggestions : [];
  const { titleMin, titleMax } = config.limits;
  return list
    .filter(
      (s) =>
        typeof s?.topic === "string" &&
        s.topic.trim() &&
        s.titles &&
        typeof s.titles === "object",
    )
    .map((s) => ({
      topic: s.topic.trim(),
      why: typeof s.why === "string" ? s.why.trim() : "",
      targetQuery:
        typeof s.targetQuery === "string" && s.targetQuery.trim()
          ? s.targetQuery.trim()
          : null,
      titles: Object.fromEntries(
        config.languages.map((lang) => [
          lang,
          typeof s.titles[lang] === "string" ? s.titles[lang].trim() : "",
        ]),
      ),
    }))
    .filter((s) =>
      config.languages.every((lang) => {
        const n = s.titles[lang].length;
        return n >= titleMin && n <= titleMax;
      }),
    )
    .slice(0, MAX_SUGGESTIONS);
}

// Ogni fonte esterna è facoltativa: se fallisce, le idee si generano con le altre.
const optional = (label, task, fallback) =>
  task().catch((err) => {
    console.warn(`::warning::${label} non disponibile: ${err.message}`);
    return fallback;
  });

export async function generateContentIdeas() {
  const [demand, articles, wikipediaInterest, searchSuggestions, ga4TopPages] =
    await Promise.all([
      optional("Query di ricerca", fetchDemand, []),
      existingArticles(),
      optional("Wikipedia", fetchWikipediaInterest, {}),
      optional("Suggerimenti di ricerca", fetchSearchSuggestions, {}),
      optional("Google Analytics", () => fetchTopPages(10), []),
    ]);
  const raw = await chatJson({
    system: CONTENT_PROMPT,
    user: JSON.stringify({
      today: day(new Date()),
      languages: config.languages,
      limits: config.limits,
      articlesTotal: articles.total,
      existingArticles: articles.list,
      demandQueries: demand,
      wikipediaInterest,
      searchSuggestions,
      ga4TopPages,
    }),
  });
  return validSuggestions(raw);
}

async function readState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeState(state) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

// Usato dal cron: invia al massimo un messaggio ogni SEO_CONTENT_INTERVAL_DAYS.
// Lo stato si salva solo dopo l'invio, così un errore viene ritentato al run successivo.
export async function sendContentIfDue() {
  const { lastSentAt } = await readState();
  const due =
    !lastSentAt ||
    Date.now() - Date.parse(lastSentAt) >= config.contentIntervalDays * DAY_MS;
  if (!due) return { sent: false, reason: "intervallo non ancora passato" };

  const ideas = await generateContentIdeas();
  if (!ideas.length) return { sent: false, reason: "nessuna idea valida" };

  await sendGroupMessage(buildContentMessage(ideas));
  await writeState({ lastSentAt: new Date().toISOString() });
  return { sent: true, count: ideas.length };
}

// Comando manuale: stampa il messaggio senza inviarlo e senza cambiare lo stato.
export async function previewContent() {
  const ideas = await generateContentIdeas();
  console.log(
    ideas.length
      ? buildContentMessage(ideas)
      : "Nessuna idea valida: il modello non ha prodotto suggerimenti completi.",
  );
}
