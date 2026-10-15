import { assertEnv } from "./config.mjs";
import {
  brokenPaths,
  runChecks,
  runMonitor,
  saveMonitorState,
} from "./monitor.mjs";
import { printOpportunities } from "./opportunities.mjs";
import { refreshSitemap } from "./technical.mjs";
import { previewContent, sendContentIfDue } from "./content.mjs";
import { sendMonthlyReportIfDue, buildMonthlyReport } from "./analytics.mjs";
import { buildOverview, publishOverview } from "./overview.mjs";
import { checkIndexing, saveIndexingState } from "./indexing.mjs";
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
    // Il monitor e il controllo indicizzazione girano prima: le pagine con problemi tecnici non vengono ottimizzate.
    const monitor = await safely("Monitor tecnico", () =>
      runMonitor({ notify: false }),
    );
    const indexingCheck = await safely("Controllo indicizzazione", checkIndexing);
    if (indexingCheck) {
      console.log(
        `Indicizzazione: ${indexingCheck.checked} URL controllate, ${indexingCheck.issues.length} nuove segnalazioni, ${indexingCheck.errors} errori.`,
      );
      for (const d of indexingCheck.diagnosis)
        console.log(
          `Diagnosi ${d.path}: canonical scelta da Google ${d.googleCanonical} (dichiarata ${d.userCanonical}), ultima scansione ${d.lastCrawlTime}`,
        );
    }
    const technicalPaths = new Set([
      ...(monitor ? brokenPaths(monitor) : []),
      ...(indexingCheck?.problemPaths ?? []),
    ]);
    const run = await runOptimization({
      apply: true,
      notify: false,
      excludePaths: technicalPaths,
    });
    await evaluateActions();
    await progressReport();
    const sitemap = await safely("Reinvio sitemap", async () => {
      const r = await refreshSitemap();
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
    // Un solo messaggio nel gruppo per run. Lo stato di monitor e indicizzazione si salva solo dopo l'invio.
    const digest = buildDigest({
      run,
      sitemap: sitemap?.submitted ? sitemap : null,
      fresh: monitor?.fresh ?? [],
      indexingIssues: indexingCheck?.issues ?? [],
      indexingResolved: indexingCheck?.resolved ?? [],
      indexingRecrawled: indexingCheck?.newlyRecrawled ?? [],
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
    if (indexingCheck && delivered) await saveIndexingState(indexingCheck);

    // Messaggio separato, al massimo una volta a settimana: idee di contenuti.
    await safely("Idee contenuti", async () => {
      const r = await sendContentIfDue();
      console.log(
        r.sent
          ? `Idee contenuti inviate (${r.count}).`
          : `Idee contenuti: ${r.reason}.`,
      );
    });
    // Report mensile con Analytics e Core Web Vitals, se le chiavi sono configurate.
    await safely("Report mensile", async () => {
      const r = await sendMonthlyReportIfDue();
      console.log(r.sent ? "Report mensile inviato." : `Report mensile: ${r.reason}.`);
    });
    // Snapshot per la sezione SEO dell'admin. Riusa il controllo indicizzazione già fatto sopra.
    await safely("Panoramica SEO", async () => {
      await publishOverview({ indexing: indexingCheck ?? null });
      console.log("Panoramica SEO aggiornata.");
    });
  } else if (command === "overview") {
    // Solo anteprima: stampa lo snapshot senza salvarlo sul backend.
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    console.log(JSON.stringify(await buildOverview(), null, 2));
  } else if (command === "content") {
    assertEnv(REQUIRED);
    await previewContent();
  } else if (command === "indexing") {
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    const r = await checkIndexing();
    console.log(`URL controllate: ${r.checked}, errori: ${r.errors}.`);
    for (const i of r.issues) console.log(`- ${i.path}: ${i.coverageState}`);
  } else if (command === "analytics") {
    assertEnv(["GOOGLE_SERVICE_ACCOUNT_FILE"]);
    console.log((await buildMonthlyReport()) ?? "Nessuna fonte configurata (GA4_PROPERTY_ID, CRUX_API_KEY).");
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
  } else if (command === "check") {
    // Solo log: nessun messaggio WhatsApp, nessuno stato salvato, nessun invio a Search Console.
    const r = await runChecks();
    console.log(`URL sitemap controllate: ${r.checked}.`);
    console.log(
      r.pagespeed
        ? `PageSpeed home mobile: ${r.pagespeed.score}/100, LCP ${Math.round(r.pagespeed.lcpMs / 100) / 10} s.`
        : "PageSpeed: non disponibile.",
    );
    for (const p of r.problems) console.log(`Problema: ${p.text}`);
    for (const w of r.warnings) console.warn(`::warning::${w}`);
    if (!r.problems.length) console.log("Nessun problema tecnico rilevato.");
  } else {
    console.log(
      "Uso: node src/index.mjs <run|evaluate|cron|content|indexing|analytics|report|monitor|opportunities|history|overview|check> [--apply]",
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Errore: ${err.message}`);
  process.exitCode = 1;
}
