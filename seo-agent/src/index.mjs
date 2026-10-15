import { assertEnv } from "./config.mjs";
import {
  brokenPaths,
  runMonitor,
  saveMonitorState,
} from "./monitor.mjs";
import { printOpportunities } from "./opportunities.mjs";
import { notifyChangedUrls } from "./indexnow.mjs";
import { refreshSitemap } from "./technical.mjs";
import { buildDigest, sendGroupMessage } from "./whatsapp.mjs";
import {
  evaluateActions,
  printHistory,
  progressReport,
  runOptimization,
  syncActivity,
} from "./agent.mjs";

const [command, ...args] = process.argv.slice(2);
const apply = args.includes("--apply");
const REQUIRED = [
  "GOOGLE_SERVICE_ACCOUNT_FILE",
  "API_TOKEN",
  "DEEPSEEK_API_KEY",
];

// Le automazioni accessorie non devono far fallire il cron: un errore viene solo segnalato.
async function safely(label, task) {
  try {
    return await task();
  } catch (err) {
    console.warn(`::warning::${label} non riuscito: ${err.message}`);
    return undefined;
  }
}

try {
  if (command === "run") {
    assertEnv(REQUIRED);
    await runOptimization({ apply });
  } else if (command === "evaluate") {
    assertEnv(REQUIRED);
    await evaluateActions();
  } else if (command === "cron") {
    assertEnv(REQUIRED);
    // Il monitor gira per primo: le pagine con problemi tecnici non vengono ottimizzate.
    const monitor = await safely("Monitor tecnico", () =>
      runMonitor({ notify: false }),
    );
    const run = await runOptimization({
      apply: true,
      notify: false,
      excludePaths: new Set(monitor ? brokenPaths(monitor) : []),
    });
    await evaluateActions();
    await progressReport();
    const indexing = await safely("IndexNow", () =>
      notifyChangedUrls(run.applied),
    );
    if (indexing) console.log(`IndexNow: inviati ${indexing.submitted} URL.`);
    const sitemap = await safely("Reinvio sitemap", async () => {
      const r = await refreshSitemap({ force: (indexing?.submitted ?? 0) > 0 });
      console.log(
        r.submitted
          ? `Sitemap reinviata a Search Console (ultimo download precedente: ${r.previousDownload ?? "mai"}).`
          : `Sitemap aggiornata da Google ${r.ageDays} giorni fa: nessun reinvio.`,
      );
      return r;
    });
    await printOpportunities().catch((err) =>
      console.warn(`::warning::Opportunità non stampate: ${err.message}`),
    );

    // Un solo messaggio nel gruppo per run. Lo stato del monitor si salva solo dopo l'invio.
    const digest = buildDigest({
      run,
      indexing,
      sitemap: sitemap?.submitted ? sitemap : null,
      fresh: monitor?.fresh ?? [],
    });
    let delivered = true;
    if (digest) {
      delivered =
        (await safely("Invio digest WhatsApp", async () => {
          await sendGroupMessage(digest);
          return true;
        })) === true;
    }
    if (monitor && delivered) await saveMonitorState(monitor);
  } else if (command === "monitor") {
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    await runMonitor();
  } else if (command === "opportunities") {
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    await printOpportunities();
  } else if (command === "sync") {
    assertEnv(["API_TOKEN"]);
    await syncActivity();
  } else if (command === "report") {
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    await progressReport();
  } else if (command === "history") {
    await printHistory();
  } else {
    console.log(
      "Uso: node src/index.mjs <run|evaluate|cron|report|monitor|opportunities|history> [--apply]",
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Errore: ${err.message}`);
  process.exitCode = 1;
}
