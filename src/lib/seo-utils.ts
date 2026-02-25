
export const generateEventSlug = (title: string, _date?: string): string => {
  // Genera slug solo dal titolo (senza data)
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
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
  // Slug diretti senza prefisso data: /slug
  // Retrocompatibilità: se lo slug inizia con YYYY-MM-DD, estrai solo il titleSlug
  const parsed = parseEventSlug(canonicalSlug);
  if (parsed.date && parsed.titleSlug) return `/${parsed.titleSlug}`;
  return `/${canonicalSlug}`;
};

// Blog: friendly path builder /blog/title-slug (senza date)
export const buildFriendlyBlogPath = (titleSlug: string, _dateIso?: string): string => {
  return `/blog/${titleSlug}`;
};

// Blog: parse friendly slug to extract the original title slug
export const parseFriendlyBlogSlug = (slug: string): { titleSlug: string } | null => {
  const m = slug.match(/^(\d{1,2})-([a-zàèéìòù]+)-(\d{4})-(.+)$/i);
  if (m) return { titleSlug: m[4] };
  return null;
};
