// Simple JSON i18n loader with nested keys support

export type UILanguage = {
  id: string;
  code: string; // e.g. 'it', 'en'
  name: string;
  native_name: string;
};

// Flatten nested JSON objects into dot.notation keys
function flatten(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, any>, nextKey));
    } else if (value !== undefined && value !== null) {
      out[nextKey] = String(value);
    }
  }
  return out;
}

export async function loadLanguages(): Promise<UILanguage[]> {
  const res = await fetch('/locales/languages.json', { cache: 'no-store' });
  if (!res.ok) return [];
  const langs = (await res.json()) as UILanguage[];
  return langs;
}

export async function loadTranslations(lang: string): Promise<Record<string, string>> {
  // Each language has its own file: en.json, it.json, es.json, etc.
  const res = await fetch(`/locales/${lang}/${lang}.json`, { cache: 'no-store' });
  if (!res.ok) return {};
  const json = await res.json();
  return flatten(json);
}
