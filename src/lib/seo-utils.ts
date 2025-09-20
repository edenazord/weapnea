
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
