import { config } from "./config.mjs";

export async function sendGroupMessage(text) {
  if (!config.botApiToken || !config.botGroupJid)
    throw new Error("BOT_API_TOKEN o BOT_GROUP_JID non impostati");
  const res = await fetch(`${config.botApiUrl}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.botApiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ group_jid: config.botGroupJid, text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Bot API ${res.status}: ${await res.text()}`);
  return res.json();
}

export function buildRecap(run) {
  const pages = [...new Set(run.applied)];
  return [
    "Recap SEO weapnea",
    `Aggiornate ${pages.length} pagine: ${pages.join(", ")}.`,
    "Le valutazioni dei risultati arriveranno circa 3 settimane dopo le modifiche.",
  ].join("\n");
}

// Un solo messaggio per run del cron. Restituisce null se non c'è niente da segnalare.
export function buildDigest({ run, indexing, sitemap, fresh = [], indexingIssues = [] }) {
  const lines = [];
  const pages = [...new Set(run.applied)];
  if (pages.length) {
    lines.push(`Aggiornate ${pages.length} pagine: ${pages.join(", ")}.`);
    lines.push("Le valutazioni dei risultati arriveranno circa 3 settimane dopo le modifiche.");
  }
  if (indexing?.submitted) lines.push(`IndexNow: inviate ${indexing.submitted} URL.`);
  if (sitemap?.submitted) lines.push("Sitemap reinviata a Search Console.");
  if (fresh.length) {
    lines.push("Nuovi problemi tecnici:");
    lines.push(...fresh.map((p) => `- ${p.text}`));
  }
  if (indexingIssues.length) {
    const MAX_LISTED = 15;
    const shown = indexingIssues.slice(0, MAX_LISTED);
    lines.push(`Pagine non indicizzate da Google: ${indexingIssues.length}`);
    lines.push(...shown.map((i) => `- ${i.path}: ${i.coverageState}`));
    if (indexingIssues.length > shown.length)
      lines.push(`- e altre ${indexingIssues.length - shown.length}`);
  }
  if (run.technicalSkipped?.length)
    lines.push(`Pagine saltate per problemi tecnici: ${run.technicalSkipped.join(", ")}.`);
  const hasNews =
    pages.length ||
    indexing?.submitted ||
    sitemap?.submitted ||
    fresh.length ||
    indexingIssues.length;
  if (!hasNews) return null;
  return ["SEO weapnea: aggiornamento", ...lines].join("\n");
}

// Messaggio separato, una volta a settimana: idee di contenuti con il titolo in ogni lingua del sito.
export function buildContentMessage(suggestions) {
  const lines = [
    "SEO weapnea: idee contenuti della settimana",
    "Sono solo suggerimenti: il sito non è stato modificato.",
  ];
  suggestions.forEach((s, i) => {
    lines.push("", `${i + 1}. ${s.topic}`);
    if (s.why) lines.push(`Perché: ${s.why}`);
    if (s.targetQuery) lines.push(`Query di riferimento: ${s.targetQuery}`);
    for (const [lang, title] of Object.entries(s.titles))
      lines.push(`${lang.toUpperCase()}: ${title}`);
  });
  return lines.join("\n");
}

// Non deve far fallire il run: un errore di WhatsApp viene solo segnalato nei log.
export async function notifyRecap(run) {
  if (!run.applied.length) return;
  try {
    await sendGroupMessage(buildRecap(run));
    console.log("Recap inviato al gruppo WhatsApp.");
  } catch (err) {
    console.warn(`Recap WhatsApp non inviato: ${err.message}`);
  }
}
