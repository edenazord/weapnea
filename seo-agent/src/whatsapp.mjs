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
