import { randomUUID } from "node:crypto";
import { config } from "./config.mjs";
import { chatJson } from "./deepseek.mjs";
import { searchAnalytics } from "./google.mjs";
import { LESSON_PROMPT, SYSTEM_PROMPT } from "./prompt.mjs";
import {
  appendRecord,
  historyForPrompt,
  readActions,
  readEvaluations,
  readRuns,
  saveProposal,
  writeRecords,
} from "./memory.mjs";
import { getSeoSettings, saveSeoSetting } from "./site-api.mjs";

const DAY_MS = 86_400_000;
const GSC_LAG_DAYS = 3;
const MIN_IMPRESSIONS = 100;
const MIN_EVAL_DAYS = 14;

const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
const daysBetween = (a, b) => Math.round((b - a) / DAY_MS);
const round = (n, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
const todayUtc = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};
const latestGscDay = () => addDays(todayUtc(), -GSC_LAG_DAYS);
const rangeEndingOn = (end, length) => ({
  startDate: fmt(addDays(end, 1 - length)),
  endDate: fmt(end),
});
const pageUrl = (p) => `${config.publicBaseUrl}${p}`;

const gsc = (range, dimensions) =>
  searchAnalytics({
    siteUrl: config.siteUrl,
    keyFile: config.googleKeyFile,
    ...range,
    dimensions,
  });

async function pageMetrics(range) {
  const rows = await gsc(range, ["page"]);
  return new Map(
    rows.map((r) => [
      r.keys[0],
      {
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: round(r.position),
      },
    ]),
  );
}

async function topQueries(range) {
  const rows = await gsc(range, ["page", "query"]);
  const map = new Map();
  for (const r of rows) {
    const [page, query] = r.keys;
    if (!map.has(page)) map.set(page, []);
    map.get(page).push({
      query,
      clicks: r.clicks,
      impressions: r.impressions,
      position: round(r.position),
    });
  }
  for (const list of map.values())
    list.sort((a, b) => b.impressions - a.impressions);
  return map;
}

async function pageMetricsFor(range, p) {
  const metrics = await pageMetrics(range);
  return (
    metrics.get(pageUrl(p)) ?? {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: null,
    }
  );
}

function currentValue(setting, lang, field) {
  if (lang === "it") return setting[field] ?? null;
  return setting.translations?.[lang]?.[field] ?? null;
}

export function mergeSetting(setting, changes) {
  const next = {
    path: setting.path,
    title: setting.title ?? null,
    description: setting.description ?? null,
    og_image: setting.og_image ?? null,
    translations: structuredClone(setting.translations ?? {}),
  };
  for (const { lang, field, value } of changes) {
    if (lang === "it") {
      next[field] = value || null;
    } else {
      next.translations[lang] = {
        ...next.translations[lang],
        [field]: value || null,
      };
    }
  }
  return next;
}

function checkChange(c, pages) {
  const page = pages.get(c?.path);
  if (!page) return "path non consentito";
  if ((page.metrics?.impressions ?? 0) < MIN_IMPRESSIONS)
    return "meno di 100 impressioni";
  if (!config.languages.includes(c.lang)) return "lingua non supportata";
  if (!["title", "description"].includes(c.field))
    return "campo non consentito";
  const value = typeof c.new_value === "string" ? c.new_value.trim() : "";
  if (!value) return "valore vuoto";
  const { titleMin, titleMax, descMin, descMax } = config.limits;
  const [min, max] =
    c.field === "title" ? [titleMin, titleMax] : [descMin, descMax];
  if (value.length < min || value.length > max)
    return `lunghezza ${value.length} fuori da ${min}-${max}`;
  if (value === currentValue(page.setting, c.lang, c.field))
    return "nessuna variazione";
  return null;
}

function validatePlan(plan, pages) {
  const accepted = new Map();
  const rejected = [];
  const candidates = Array.isArray(plan?.changes) ? plan.changes : [];
  for (const c of candidates) {
    const reason = checkChange(c, pages);
    if (reason) {
      rejected.push({ change: c, reason });
      continue;
    }
    accepted.set(`${c.path}|${c.lang}|${c.field}`, {
      path: c.path,
      lang: c.lang,
      field: c.field,
      value: c.new_value.trim(),
      reason: String(c.reason ?? ""),
      confidence: Number(c.confidence ?? 0),
    });
  }
  const list = [...accepted.values()];
  for (const extra of list.splice(config.maxChangesPerRun)) {
    rejected.push({
      change: extra,
      reason: "oltre il limite massimo per esecuzione",
    });
  }
  return { accepted: list, rejected };
}

function buildActions(accepted, pages) {
  const groups = new Map();
  for (const c of accepted) {
    if (!groups.has(c.path)) groups.set(c.path, []);
    groups.get(c.path).push(c);
  }
  return [...groups].map(([p, items]) => {
    const page = pages.get(p);
    return {
      path: p,
      changes: items.map((c) => ({
        lang: c.lang,
        field: c.field,
        before: currentValue(page.setting, c.lang, c.field),
        after: c.value,
      })),
      reason: items.map((c) => `${c.lang}.${c.field}: ${c.reason}`).join(" | "),
      confidence: round(
        items.reduce((sum, c) => sum + c.confidence, 0) / items.length,
        2,
      ),
      baseline: page.metrics,
    };
  });
}

function printSummary({ analysis, actions, rejected }) {
  console.log(`\nAnalisi: ${analysis || "-"}\n`);
  for (const a of actions) {
    console.log(`- ${a.path} (confidenza ${a.confidence}): ${a.reason}`);
    for (const c of a.changes)
      console.log(
        `    ${c.lang}.${c.field}: "${c.before ?? ""}" -> "${c.after}"`,
      );
  }
  if (!actions.length) console.log("Nessuna modifica proposta.");
  for (const r of rejected) {
    console.log(
      `- scartata (${r.reason}): ${r.change?.path} ${r.change?.lang}.${r.change?.field}`,
    );
  }
}

function sumMetrics(metrics) {
  const totals = { clicks: 0, impressions: 0 };
  for (const m of metrics.values()) {
    totals.clicks += m.clicks;
    totals.impressions += m.impressions;
  }
  return totals;
}

export async function runOptimization({ apply }) {
  const range = rangeEndingOn(latestGscDay(), 28);
  const [metrics, queries, settings] = await Promise.all([
    pageMetrics(range),
    topQueries(range),
    getSeoSettings(),
  ]);

  const pages = new Map(
    config.allowedPaths.map((p) => {
      const url = pageUrl(p);
      const setting = settings.get(p) ?? {
        path: p,
        title: null,
        description: null,
        og_image: null,
        translations: {},
      };
      return [
        p,
        {
          path: p,
          setting,
          metrics: metrics.get(url) ?? null,
          topQueries: (queries.get(url) ?? []).slice(0, 10),
        },
      ];
    }),
  );

  const input = {
    today: fmt(todayUtc()),
    metricsWindow: range,
    languages: config.languages,
    limits: config.limits,
    maxChanges: config.maxChangesPerRun,
    pages: [...pages.values()].map((p) => ({
      path: p.path,
      current: {
        title: p.setting.title,
        description: p.setting.description,
        translations: p.setting.translations ?? {},
      },
      metrics28d: p.metrics,
      topQueries: p.topQueries,
    })),
    history: await historyForPrompt(config.allowedPaths),
  };

  const plan = await chatJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(input),
  });
  const { accepted, rejected } = validatePlan(plan, pages);
  const actions = buildActions(accepted, pages);
  const analysis = String(plan?.analysis ?? "");

  printSummary({ analysis, actions, rejected });
  const proposalFile = await saveProposal({
    createdAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    range,
    analysis,
    actions,
    rejected,
  });

  const run = {
    id: randomUUID(),
    at: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    range,
    analysis,
    totals: sumMetrics(metrics),
    proposed: actions.map((a) => ({
      path: a.path,
      fields: a.changes.map((c) => `${c.lang}.${c.field}`),
      confidence: a.confidence,
      reason: a.reason,
    })),
    rejected: rejected.map((r) => ({
      path: r.change?.path,
      lang: r.change?.lang,
      field: r.change?.field,
      reason: r.reason,
    })),
    applied: [],
  };

  if (!apply) {
    console.log(
      `\nDry-run: nessuna modifica applicata. Proposta salvata in ${proposalFile}`,
    );
    await appendRecord("runs.jsonl", run);
    return;
  }

  for (const action of actions) {
    const page = pages.get(action.path);
    const next = mergeSetting(
      page.setting,
      action.changes.map((c) => ({
        lang: c.lang,
        field: c.field,
        value: c.after,
      })),
    );
    await saveSeoSetting(next);
    await appendRecord("actions.jsonl", {
      id: randomUUID(),
      ...action,
      status: "applied",
      appliedAt: new Date().toISOString(),
    });
    run.applied.push(action.path);
    console.log(`Applicato: ${action.path} (${action.changes.length} campi)`);
  }
  await appendRecord("runs.jsonl", run);
}

function compare(b, a) {
  const pct = (x, y) => (x ? round(((y - x) / x) * 100) : null);
  return {
    clicksPct: pct(b.clicks, a.clicks),
    impressionsPct: pct(b.impressions, a.impressions),
    ctrDeltaPp: round((a.ctr - b.ctr) * 100, 2),
    positionDelta:
      b.position != null && a.position != null
        ? round(a.position - b.position)
        : null,
  };
}

function judge(b, a) {
  if (b.impressions + a.impressions < 2 * MIN_IMPRESSIONS)
    return "dati-insufficienti";
  const posWorse =
    b.position != null && a.position != null ? a.position - b.position : 0;
  const clicksDown = b.clicks >= 10 && a.clicks < b.clicks * 0.85;
  if (clicksDown || posWorse > 1.5) return "peggiorato";
  const clicksUp = a.clicks >= b.clicks * 1.15 && a.clicks - b.clicks >= 3;
  if (clicksUp || -posWorse > 1.5) return "migliorato";
  return "neutro";
}

export async function evaluateActions() {
  const actions = await readActions();
  const evaluated = new Set((await readEvaluations()).map((e) => e.actionId));
  const latest = latestGscDay();
  let changed = false;

  for (const action of actions) {
    if (action.status !== "applied" || evaluated.has(action.id)) continue;

    const appliedDay = new Date(`${action.appliedAt.slice(0, 10)}T00:00:00Z`);
    if (daysBetween(appliedDay, todayUtc()) < config.evalDays) continue;

    const length = Math.min(
      config.evalDays,
      daysBetween(appliedDay, latest) + 1,
    );
    if (length < MIN_EVAL_DAYS) {
      console.log(`Saltata (dati GSC insufficienti): ${action.path}`);
      continue;
    }

    const after = await pageMetricsFor(
      {
        startDate: fmt(appliedDay),
        endDate: fmt(addDays(appliedDay, length - 1)),
      },
      action.path,
    );
    const before = await pageMetricsFor(
      rangeEndingOn(addDays(appliedDay, -1), length),
      action.path,
    );
    const delta = compare(before, after);
    const verdict = judge(before, after);

    const judged = await chatJson({
      system: LESSON_PROMPT,
      user: JSON.stringify({
        action: {
          path: action.path,
          appliedAt: action.appliedAt,
          changes: action.changes,
          reason: action.reason,
        },
        before,
        after,
        delta,
        verdict,
      }),
    });
    const evaluation = {
      id: randomUUID(),
      actionId: action.id,
      path: action.path,
      evaluatedAt: new Date().toISOString(),
      before,
      after,
      delta,
      verdict,
      was_right: Boolean(judged.was_right),
      lesson: String(judged.lesson ?? ""),
    };
    await appendRecord("evaluations.jsonl", evaluation);
    console.log(`${action.path}: ${verdict} - ${evaluation.lesson}`);

    if (verdict === "peggiorato" && config.autoRollback) {
      const current = (await getSeoSettings()).get(action.path) ?? {
        path: action.path,
      };
      await saveSeoSetting(
        mergeSetting(
          current,
          action.changes.map((c) => ({
            lang: c.lang,
            field: c.field,
            value: c.before,
          })),
        ),
      );
      action.status = "reverted";
      changed = true;
      console.log(`Ripristinato: ${action.path}`);
    }
  }

  if (changed) await writeRecords("actions.jsonl", actions);
}

export async function printHistory() {
  const actions = await readActions();
  if (!actions.length) {
    console.log("Nessuna modifica registrata.");
    return;
  }
  const outcomes = new Map(
    (await readEvaluations()).map((e) => [e.actionId, e]),
  );
  for (const a of actions) {
    const e = outcomes.get(a.id);
    console.log(
      `${a.appliedAt.slice(0, 10)}  ${a.path.padEnd(20)} ${a.status.padEnd(9)} ${e ? e.verdict : "in attesa"}  ${e?.lesson ?? ""}`,
    );
  }
}

async function dailySeries(days) {
  const rows = await gsc(rangeEndingOn(latestGscDay(), days), ["date"]);
  return rows.map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
  }));
}

function summarize(rows) {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const posWeighted = rows.reduce((s, r) => s + r.position * r.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? round(clicks / impressions, 4) : 0,
    position: impressions ? round(posWeighted / impressions) : null,
  };
}

function weeklySeries(rows, weeks) {
  const latest = latestGscDay();
  const buckets = Array.from({ length: weeks }, () => []);
  for (const r of rows) {
    const idx = Math.floor(
      daysBetween(new Date(`${r.date}T00:00:00Z`), latest) / 7,
    );
    if (idx >= 0 && idx < weeks) buckets[idx].push(r);
  }
  return buckets
    .map((b, weeksAgo) => ({ weeksAgo, ...summarize(b) }))
    .reverse();
}

const pctChange = (from, to) =>
  from ? round(((to - from) / from) * 100) : null;
const signed = (n) => (n === null ? "n.d." : `${n > 0 ? "+" : ""}${n}%`);

function trendVerdict(cur, prev) {
  const signals = [];
  const pct = pctChange(prev.clicks, cur.clicks);
  if (pct !== null) signals.push(pct >= 5 ? 1 : pct <= -5 ? -1 : 0);
  if (cur.position != null && prev.position != null) {
    const gain = prev.position - cur.position;
    signals.push(gain >= 1 ? 1 : gain <= -1 ? -1 : 0);
  }
  if (!signals.length) return "dati insufficienti";
  const score = signals.reduce((s, x) => s + x, 0);
  const verdict = score > 0 ? "progresso" : score < 0 ? "regresso" : "stabile";
  const small = prev.clicks < 30 || cur.clicks < 30;
  return small ? `${verdict} (campione piccolo, pochi clic)` : verdict;
}

export async function progressReport() {
  const days = await dailySeries(84);
  const latest = latestGscDay();
  const currentFrom = fmt(addDays(latest, -27));
  const previousFrom = fmt(addDays(latest, -55));
  const current = summarize(days.filter((r) => r.date >= currentFrom));
  const previous = summarize(
    days.filter((r) => r.date >= previousFrom && r.date < currentFrom),
  );
  const trend = trendVerdict(current, previous);

  console.log(`== Ultimi 28 giorni, fino al ${fmt(latest)}`);
  console.log(
    `Clic: ${current.clicks} (${signed(pctChange(previous.clicks, current.clicks))} vs 28 giorni precedenti)`,
  );
  console.log(
    `Impressioni: ${current.impressions} (${signed(pctChange(previous.impressions, current.impressions))})`,
  );
  console.log(
    `Posizione media: ${current.position ?? "n.d."} (precedente ${previous.position ?? "n.d."})`,
  );
  console.log(`Andamento del sito: ${trend}`);

  console.log("\n== Settimane (dalla più vecchia)");
  for (const w of weeklySeries(days, 12)) {
    const label =
      w.weeksAgo === 0 ? "ultima settimana" : `${w.weeksAgo} sett. fa`;
    console.log(
      `${label}: clic ${w.clicks}, impressioni ${w.impressions}, posizione ${w.position ?? "n.d."}`,
    );
  }

  const actions = await readActions();
  const evaluations = await readEvaluations();
  const count = (v) => evaluations.filter((e) => e.verdict === v).length;
  const evaluatedIds = new Set(evaluations.map((e) => e.actionId));
  const pending = actions.filter(
    (a) => a.status === "applied" && !evaluatedIds.has(a.id),
  ).length;
  console.log(
    `\n== Interventi: ${actions.length} applicati, ${count("migliorato")} migliorati, ${count("peggiorato")} peggiorati, ${count("neutro")} neutri, ${count("dati-insufficienti")} con dati insufficienti, ${pending} in attesa`,
  );

  const runs = await readRuns();
  console.log(`\n== Ultime esecuzioni (${runs.length} totali)`);
  for (const r of runs.slice(-5))
    console.log(
      `${r.at.slice(0, 10)} ${r.mode}: ${r.applied.length} applicate, ${r.proposed.length} proposte, ${r.rejected.length} scartate. ${r.analysis || "-"}`,
    );

  await appendRecord("snapshots.jsonl", {
    at: new Date().toISOString(),
    current,
    previous,
    trend,
  });
}
