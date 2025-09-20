// Lightweight loader for mock JSON data served from public/mock-data/*
// It caches results in module scope to avoid duplicate fetches.

type LoaderCategory = {
  id: string;
  name: string;
  order_index?: number | null;
};

type LoaderEvent = {
  id: string;
  title: string;
  slug: string;
  date: string | null;
  nation: string | null;
  category_id: string | null;
  [k: string]: unknown;
};

let categoriesCache: LoaderCategory[] | null = null;
let eventsCache: LoaderEvent[] | null = null;

export async function tryLoadCategoriesJson(): Promise<LoaderCategory[] | null> {
  if (categoriesCache) return categoriesCache;
  try {
    const res = await fetch('/mock-data/categories.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const rows = (await res.json()) as LoaderCategory[];
    categoriesCache = rows.map(c => ({ ...c, order_index: c.order_index ?? 0 }));
    return categoriesCache;
  } catch {
    return null;
  }
}

export async function tryLoadEventsJson(): Promise<LoaderEvent[] | null> {
  if (eventsCache) return eventsCache;
  try {
    const res = await fetch('/mock-data/events.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const rows = (await res.json()) as LoaderEvent[];
    eventsCache = rows;
    return eventsCache;
  } catch {
    return null;
  }
}
