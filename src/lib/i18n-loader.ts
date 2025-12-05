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
  // Use a conservative cache policy to avoid SW/CDN incompatibilities
  const res = await fetch('/locales/languages.json', { cache: 'reload' });
  if (!res.ok) return [];
  const langs = (await res.json()) as UILanguage[];
  return langs;
}

export async function loadTranslations(lang: string): Promise<Record<string, string>> {
  // We use a single namespace common.json for now
  // Fetch with 'reload' to bypass HTTP cache but remain SW/CDN friendly
  try {
    const res = await fetch(`/locales/${lang}/common.json`, { cache: 'reload' });
    if (!res.ok) {
      console.error('i18n-loader: failed to fetch translations for', lang, res.status);
      return {};
    }
    const json = await res.json();
    return flatten(json);
  } catch (e) {
    console.error('i18n-loader: error fetching translations for', lang, e);
    return {};
  }
}
