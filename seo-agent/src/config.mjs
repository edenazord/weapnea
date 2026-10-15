import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const env = (name, fallback) => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

const fileEnv = (name) => {
  const value = env(name);
  return value ? path.resolve(ROOT, value) : undefined;
};

const listEnv = (name, fallback) => {
  const value = env(name);
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : fallback;
};

export const config = {
  dataDir: path.join(ROOT, "data"),
  siteUrl: env("GSC_SITE_URL", "sc-domain:weapnea.com"),
  googleKeyFile: fileEnv("GOOGLE_SERVICE_ACCOUNT_FILE"),
  publicBaseUrl: env("PUBLIC_BASE_URL", "https://www.weapnea.com"),
  apiBaseUrl: env("API_BASE_URL", "https://weapnea-api.onrender.com"),
  apiToken: env("API_TOKEN"),
  botApiUrl: env("BOT_API_URL", "https://wz-pro.it/ollama/api"),
  botApiToken: env("BOT_API_TOKEN"),
  botGroupJid: env("BOT_GROUP_JID"),
  indexNowKey: env("INDEXNOW_KEY"),
  pagespeedApiKey: env("PAGESPEED_API_KEY"),
  ga4PropertyId: env("GA4_PROPERTY_ID"),
  cruxApiKey: env("CRUX_API_KEY"),
  deepseekApiKey: env("DEEPSEEK_API_KEY"),
  deepseekBaseUrl: env("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
  deepseekModel: env("DEEPSEEK_MODEL", "deepseek-flash"),
  languages: listEnv("SEO_LANGUAGES", ["it", "en", "es", "fr", "pl", "ru"]),
  allowedPaths: listEnv("SEO_ALLOWED_PATHS", [
    "/",
    "/chi-siamo",
    "/contattaci",
    "/eventi-imminenti",
    "/blog",
    "/forum",
    "/organizer-packages",
    "/sponsor-packages",
    "/privacy-policy",
    "/cookie-policy",
  ]),
  maxChangesPerRun: Number(env("SEO_MAX_CHANGES_PER_RUN", "5")),
  batchSize: Number(env("SEO_BATCH_SIZE", "6")),
  runBudgetMinutes: Number(env("SEO_RUN_BUDGET_MINUTES", "40")),
  evalDays: Number(env("SEO_EVAL_DAYS", "21")),
  minImpressions: Number(env("SEO_MIN_IMPRESSIONS", "30")),
  contentIntervalDays: Number(env("SEO_CONTENT_INTERVAL_DAYS", "7")),
  autoRollback: env("SEO_AUTO_ROLLBACK", "true") === "true",
  limits: { titleMin: 20, titleMax: 60, descMin: 50, descMax: 160 },
};

export function assertEnv(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length)
    throw new Error(`variabili mancanti nel file .env: ${missing.join(", ")}`);
}
