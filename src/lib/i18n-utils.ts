import { useLanguage } from "@/contexts/LanguageContext";

// Mappa basata su nomi categoria tipici in italiano nel DB
const CATEGORY_KEY_MAP: Record<string, keyof typeof CATEGORY_KEYS> = {
  "allenamenti": "trainings",
  "allenamenti condivisi": "trainings",
  "viaggi": "trips",
  "viaggi apnea": "trips",
  "corsi": "courses",
  "corsi di apnea": "courses",
  "workshop": "workshops",
  "workshops": "workshops",
  "competizioni": "competitions",
  "gare": "competitions",
  "gare di apnea": "competitions",
  "stage": "stages",
};

const CATEGORY_KEYS = {
  trainings: "categories.trainings",
  trips: "categories.trips",
  courses: "categories.courses",
  workshops: "categories.workshops",
  competitions: "categories.competitions",
  stages: "categories.stages",
} as const;

// Normalizza una stringa: minuscole, rimozione di accenti, punteggiatura e spazi multipli
function normalizeCategoryName(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function localizeCategoryName(name: string | undefined | null, t: (k: string, fallback?: string) => string) {
  if (!name) return "";
  const norm = normalizeCategoryName(name);
  // match diretto dalla mappa
  let key = CATEGORY_KEY_MAP[norm];
  if (!key) {
    // pattern generici: contiene parole chiave
    if (/\bcorsi\b|\bcorso\b|\bcourse\b/.test(norm)) key = 'courses';
    else if (/\bviaggi\b|\bviaggio\b|\btrip\b|\btravel\b/.test(norm)) key = 'trips';
    else if (/\ballenament/i.test(norm)) key = 'trainings';
    else if (/\bworkshop\b|\batelier\b|\blab\b/.test(norm)) key = 'workshops';
    else if (/\bcompetizion|\bgare\b|\bcompetition\b|\brace\b/.test(norm)) key = 'competitions';
    else if (/\bstage\b|\binternship\b/.test(norm)) key = 'stages';
  }
  if (key) return t(CATEGORY_KEYS[key], name);
  return name; // fallback al nome originale se non mappato
}

// Hook opzionale per usare direttamente in componenti
export function useCategoryLocalizer() {
  const { t } = useLanguage();
  return (name: string | undefined | null) => localizeCategoryName(name, t);
}
