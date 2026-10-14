import { assertEnv } from "./config.mjs";
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

try {
  if (command === "run") {
    assertEnv(REQUIRED);
    await runOptimization({ apply });
  } else if (command === "evaluate") {
    assertEnv(REQUIRED);
    await evaluateActions();
  } else if (command === "cron") {
    assertEnv(REQUIRED);
    await runOptimization({ apply: true });
    await evaluateActions();
    await progressReport();
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
      "Uso: node src/index.mjs <run|evaluate|cron|report|history> [--apply]",
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`Errore: ${err.message}`);
  process.exitCode = 1;
}
