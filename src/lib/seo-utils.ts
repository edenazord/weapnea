
export const generateEventSlug = (title: string, date: string): string => {
  // Rimuove caratteri speciali e spazi dal titolo
  const cleanTitle = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Rimuove caratteri speciali tranne spazi e trattini
    .replace(/\s+/g, '-') // Sostituisce spazi con trattini
    .replace(/-+/g, '-') // Rimuove trattini multipli
    .replace(/^-|-$/g, ''); // Rimuove trattini all'inizio e alla fine

  // Formatta la data come YYYY-MM-DD
  const formattedDate = date ? date.split('T')[0] : '';
  
  // Combina data e titolo
  return formattedDate ? `${formattedDate}-${cleanTitle}` : cleanTitle;
};

export const parseEventSlug = (slug: string): { date?: string; titleSlug?: string } => {
  // Cerca un pattern che inizia con una data (YYYY-MM-DD)
  const dateMatch = slug.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  
  if (dateMatch) {
    return {
      date: dateMatch[1],
      titleSlug: dateMatch[2]
    };
  }
  
  return { titleSlug: slug };
};

// Mesi italiani in minuscolo -> indice (1-12)
const IT_MONTHS: Record<string, number> = {
  'gennaio': 1,
  'febbraio': 2,
  'marzo': 3,
  'aprile': 4,
  'maggio': 5,
  'giugno': 6,
  'luglio': 7,
  'agosto': 8,
  'settembre': 9,
  'ottobre': 10,
  'novembre': 11,
  'dicembre': 12,
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

// Converte uno slug "DD-mese-YYYY-resto" nel canonico "YYYY-MM-DD-resto"
export const friendlyToCanonicalSlug = (friendly: string): string | null => {
  const m = friendly.match(/^(\d{1,2})-([a-zàèéìòù]+)-(\d{4})-(.+)$/i);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const monthName = m[2].toLowerCase();
  const yyyy = m[3];
  const rest = m[4];
  const mmNum = IT_MONTHS[monthName];
  if (!mmNum || dd < 1 || dd > 31) return null;
  const iso = `${yyyy}-${pad2(mmNum)}-${pad2(dd)}`;
  return `${iso}-${rest}`;
};

// Costruisce un path SEO-friendly senza "/events", con data italiana
// Input: canonical slug "YYYY-MM-DD-resto" -> Output: "/DD-mese-YYYY-resto"
export const buildFriendlyEventPath = (canonicalSlug: string): string => {
  const parsed = parseEventSlug(canonicalSlug);
  if (!parsed.date) return `/${canonicalSlug}`;
  try {
    const [y, m, d] = parsed.date.split('-').map((s) => parseInt(s, 10));
    const monthNames = Object.keys(IT_MONTHS);
    const monthName = monthNames.find((name) => IT_MONTHS[name] === m) || String(m);
    const friendlyDate = `${d}-${monthName}-${y}`.toLowerCase();
    return `/${friendlyDate}-${parsed.titleSlug}`;
  } catch {
    return `/${canonicalSlug}`;
  }
};

// Blog: friendly path builder /blog/DD-mese-YYYY-title
export const buildFriendlyBlogPath = (titleSlug: string, dateIso?: string): string => {
  if (!dateIso) return `/blog/${titleSlug}`;
  try {
    const [y, m, d] = dateIso.slice(0, 10).split('-').map((s) => parseInt(s, 10));
    const monthNames = Object.keys(IT_MONTHS);
    const monthName = monthNames.find((name) => IT_MONTHS[name] === m) || String(m);
    const friendlyDate = `${d}-${monthName}-${y}`.toLowerCase();
    return `/blog/${friendlyDate}-${titleSlug}`;
  } catch {
    return `/blog/${titleSlug}`;
  }
};

// Blog: parse friendly slug to extract the original title slug
export const parseFriendlyBlogSlug = (slug: string): { titleSlug: string } | null => {
  const m = slug.match(/^(\d{1,2})-([a-zàèéìòù]+)-(\d{4})-(.+)$/i);
  if (m) return { titleSlug: m[4] };
  return null;
};
