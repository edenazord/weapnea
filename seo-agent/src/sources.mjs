import { config } from "./config.mjs";

// Fonti pubbliche senza chiave API. Ogni funzione restituisce {} o [] se la fonte non risponde.
const USER_AGENT = "weapnea-seo-agent/1.0 (https://www.weapnea.com)";
const DAY_MS = 86_400_000;
const PAUSE_MS = 300;

// Voce Wikipedia sull'apnea/freediving per ogni lingua del sito.
const WIKI_ARTICLES = {
  it: "Apnea",
  en: "Freediving",
  es: "Apnea",
  fr: "Apnée",
  pl: "Freediving",
  ru: "Фридайвинг",
};

// Seed specifici: "apnea" da solo in italiano restituisce soprattutto "apnea notturna".
const AUTOCOMPLETE_SEEDS = {
  it: ["apnea subacquea", "freediving", "corso apnea"],
  en: ["freediving", "freediving course", "breath hold training"],
  es: ["apnea buceo", "freediving", "curso apnea"],
  fr: ["apnée plongée", "freediving", "stage apnée"],
  pl: ["freediving", "nurkowanie na wstrzymanym oddechu", "kurs freediving"],
  ru: ["фридайвинг", "фридайвинг курсы", "апноэ"],
};

const fmt = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const pause = () => new Promise((resolve) => setTimeout(resolve, PAUSE_MS));

// Visite alle voci Wikipedia: ultimi 30 giorni contro i 30 precedenti (segnale di interesse).
export async function fetchWikipediaInterest() {
  const end = new Date(Date.now() - 2 * DAY_MS);
  const mid = new Date(end.getTime() - 30 * DAY_MS);
  const start = new Date(mid.getTime() - 30 * DAY_MS);
  const out = {};
  for (const lang of config.languages) {
    const article = WIKI_ARTICLES[lang];
    if (!article) continue;
    try {
      const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${fmt(start)}/${fmt(end)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { items = [] } = await res.json();
      const midStamp = fmt(mid);
      let views30d = 0;
      let previous30d = 0;
      for (const item of items) {
        if (item.timestamp.slice(0, 8) > midStamp) views30d += item.views;
        else previous30d += item.views;
      }
      out[lang] = { article, views30d, previous30d };
    } catch (err) {
      console.warn(`::warning::Wikipedia ${lang} non disponibile: ${err.message}`);
    }
    await pause();
  }
  return out;
}

// Suggerimenti di ricerca Google per lingua. Endpoint non documentato: può cambiare senza preavviso.
export async function fetchSearchSuggestions() {
  const out = {};
  for (const lang of config.languages) {
    const seeds = AUTOCOMPLETE_SEEDS[lang] ?? [];
    const found = new Set();
    for (const seed of seeds) {
      try {
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${lang}&q=${encodeURIComponent(seed)}`;
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const [, list = []] = await res.json();
        for (const s of list) if (typeof s === "string") found.add(s.toLowerCase());
      } catch (err) {
        console.warn(`::warning::Suggerimenti ${lang} ("${seed}") non disponibili: ${err.message}`);
      }
      await pause();
    }
    out[lang] = [...found].slice(0, 15);
  }
  return out;
}
