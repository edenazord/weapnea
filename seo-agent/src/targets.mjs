import { config } from "./config.mjs";
import { getBlogArticles, getEvents } from "./site-api.mjs";

const CONTEXT_CHARS = 700;

const plain = (html) =>
  String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const emptySetting = (path) => ({
  path,
  title: null,
  description: null,
  og_image: null,
  translations: {},
});

// Ogni target e' una pagina indicizzabile salvata in seo_settings con la sua path.
export async function loadTargets(settings) {
  const targets = new Map();
  const add = (target) => {
    if (!targets.has(target.path)) {
      target.setting = settings.get(target.path) ?? emptySetting(target.path);
      targets.set(target.path, target);
    }
  };

  const [articles, events] = await Promise.all([
    getBlogArticles().catch((err) => {
      console.warn(`Articoli non disponibili: ${err.message}`);
      return [];
    }),
    getEvents().catch((err) => {
      console.warn(`Eventi non disponibili: ${err.message}`);
      return [];
    }),
  ]);

  for (const a of articles) {
    if (!a.slug) continue;
    add({
      kind: "blog",
      path: `/blog/${a.slug}`,
      languages: config.languages,
      baseLanguage: a.language || "it",
      fallback: { title: a.seo_title || a.title, description: a.seo_description || a.excerpt || null },
      context: {
        title: a.title,
        subtitle: a.subtitle ?? null,
        excerpt: a.excerpt ?? null,
        keywords: a.seo_keywords ?? null,
        content: plain(a.content).slice(0, CONTEXT_CHARS),
      },
    });
  }

  for (const e of events) {
    if (!e.slug) continue;
    add({
      kind: "event",
      path: `/${e.slug}`,
      languages: config.languages,
      baseLanguage: "it",
      fallback: { title: e.title, description: plain(e.description).slice(0, 160) || null },
      context: {
        title: e.title,
        date: e.date ?? null,
        endDate: e.end_date ?? null,
        location: e.location ?? null,
        nation: e.nation ?? null,
        discipline: e.discipline ?? null,
        level: e.level ?? null,
        eventLanguage: e.language ?? null,
        description: plain(e.description).slice(0, CONTEXT_CHARS),
      },
    });
  }

  const staticPaths = new Set([...config.allowedPaths, ...settings.keys()]);
  for (const path of staticPaths) {
    add({
      kind: "page",
      path,
      languages: config.languages,
      baseLanguage: "it",
      fallback: null,
      context: null,
    });
  }

  return targets;
}
