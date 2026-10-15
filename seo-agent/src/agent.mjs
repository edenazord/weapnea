import { randomUUID } from "node:crypto";
import { config } from "./config.mjs";
import { chatJson } from "./deepseek.mjs";
import { searchAnalytics } from "./google.mjs";
import { fetchTopPages } from "./analytics.mjs";
import { LESSON_PROMPT, SYSTEM_PROMPT } from "./prompt.mjs";
import { notifyRecap } from "./whatsapp.mjs";
import { findOpportunities, opportunitiesForPage } from "./opportunities.mjs";
import { inspectPages, sitemapStatus } from "./technical.mjs";
import {
  appendRecord,
  historyForPrompt,
  readActions,
  readEvaluations,
  readRuns,
  saveProposal,
  writeRecords,
} from "./memory.mjs";
import { getSeoSettings, logActivity, saveSeoSetting } from "./site-api.mjs";
import { loadTargets } from "./targets.mjs";

const DAY_MS = 86_400_000;
const GSC_LAG_DAYS = 3;
const MIN_EVAL_DAYS = 14;
// CTR organica indicativa per posizione media (1-10), da usare come riferimento.
const CTR_BY_POSITION = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.02];

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
  if (!page) return "path non presente tra i target";
  if (!page.languages.includes(c.lang)) return "lingua non supportata";
  if (!["title", "description"].includes(c.field))
    return "campo non consentito";
  const value = typeof c.new_value === "string" ? c.new_value.trim() : "";
  if (!value) return "valore vuoto";
  const { titleMin, titleMax, descMin, descMax } = config.limits;
  const [min, max] =
    c.field === "title" ? [titleMin, titleMax] : [descMin, descMax];
  if (value.length < min || value.length > max)
    return `lunghezza ${value.length} fuori da ${min}-${max}`;
  if (c.field === "title" && /weapnea/i.test(value))
    return "brand WeApnea nel title (viene aggiunto automaticamente)";
  if (value === currentValue(page.setting, c.lang, c.field))
    return "nessuna variazione";
  return null;
}

// "cap" e' il numero di modifiche ancora consentite nell'intero run.
export function validatePlan(plan, pages, cap = Infinity) {
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
  for (const extra of list.splice(Math.max(0, cap))) {
    rejected.push({
      change: extra,
      reason: "oltre il limite massimo per esecuzione",
    });
  }
  return { accepted: list, rejected };
}

function expectedCtr(position) {
  if (position == null) return null;
  const rounded = Math.round(position);
  if (rounded > 10) return 0.01;
  return CTR_BY_POSITION[Math.max(rounded, 1) - 1];
}

function withCtrReference(metrics) {
  if (!metrics) return null;
  const expected = expectedCtr(metrics.position);
  return {
    ...metrics,
    ctrExpected: expected,
    ctrGap:
      expected == null ? null : round((metrics.ctr - expected) * 100, 2),
  };
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
      kind: page.kind,
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

const KIND_ORDER = { page: 0, blog: 1, event: 2 };

function missingLanguages(target) {
  return target.languages.filter(
    (l) =>
      !currentValue(target.setting, l, "title") ||
      !currentValue(target.setting, l, "description"),
  );
}

// Salta i target modificati da meno di evalDays, salvo traduzioni ancora mancanti.
function selectCandidates(targets, actions) {
  const lastApplied = new Map();
  for (const a of actions)
    if (a.status === "applied") lastApplied.set(a.path, a.appliedAt);
  const today = todayUtc();

  return [...targets.values()].filter((t) => {
    const last = lastApplied.get(t.path);
    const recent =
      last &&
      daysBetween(new Date(`${last.slice(0, 10)}T00:00:00Z`), today) <
        config.evalDays;
    return !recent || missingLanguages(t).length > 0;
  });
}

function toBatches(candidates) {
  const byKind = new Map();
  for (const t of candidates) {
    if (!byKind.has(t.kind)) byKind.set(t.kind, []);
    byKind.get(t.kind).push(t);
  }
  const batches = [];
  for (const kind of [...byKind.keys()].sort(
    (a, b) => KIND_ORDER[a] - KIND_ORDER[b],
  )) {
    const list = byKind.get(kind);
    for (let i = 0; i < list.length; i += config.batchSize)
      batches.push(list.slice(i, i + config.batchSize));
  }
  return batches;
}

async function planBatch(batch, range, remaining) {
  const input = {
    today: fmt(todayUtc()),
    metricsWindow: range,
    languages: config.languages,
    limits: config.limits,
    ...(Number.isFinite(remaining) && { maxChanges: remaining }),
    targets: batch.map((t) => ({
      kind: t.kind,
      path: t.path,
      baseLanguage: t.baseLanguage,
      languages: t.languages,
      current: {
        title: t.setting.title,
        description: t.setting.description,
        translations: t.setting.translations ?? {},
      },
      fallback: t.fallback,
      context: t.context,
      metrics28d: withCtrReference(t.metrics),
      topQueries: t.topQueries,
      ga4: t.ga4,
      ...(t.opportunities && { opportunities: t.opportunities }),
    })),
    history: await historyForPrompt(batch.map((t) => t.path)),
  };
  const plan = await chatJson({
    system: SYSTEM_PROMPT,
    user: JSON.stringify(input),
  });
  const targets = new Map(batch.map((t) => [t.path, t]));
  const { accepted, rejected } = validatePlan(plan, targets, remaining);
  return {
    targets,
    actions: buildActions(accepted, targets),
    rejected,
    accepted: accepted.length,
    analysis: String(plan?.analysis ?? ""),
  };
}

const REMOTE_KINDS = {
  "runs.jsonl": ["run", "at"],
  "actions.jsonl": ["action", "appliedAt"],
  "evaluations.jsonl": ["evaluation", "evaluatedAt"],
};

// Salva su file e nel registro remoto mostrato nella sezione SEO dell'admin.
async function record(name, data) {
  await appendRecord(name, data);
  const [kind, dateField] = REMOTE_KINDS[name];
  await logActivity(kind, data, data[dateField]);
}

export async function syncActivity() {
  const sources = {
    "runs.jsonl": await readRuns(),
    "actions.jsonl": await readActions(),
    "evaluations.jsonl": await readEvaluations(),
  };
  for (const [name, records] of Object.entries(sources)) {
    const [kind, dateField] = REMOTE_KINDS[name];
    for (const data of records) await logActivity(kind, data, data[dateField]);
    console.log(`Sincronizzati ${records.length} record (${kind})`);
  }
}

async function applyActions(actions, targets, run) {
  for (const action of actions) {
    const next = mergeSetting(
      targets.get(action.path).setting,
      action.changes.map((c) => ({
        lang: c.lang,
        field: c.field,
        value: c.after,
      })),
    );
    await saveSeoSetting(next);
    await record("actions.jsonl", {
      id: randomUUID(),
      ...action,
      status: "applied",
      appliedAt: new Date().toISOString(),
    });
    run.applied.push(action.path);
    console.log(`Applicato: ${action.path} (${action.changes.length} campi)`);
  }
}

// excludePaths: pagine con problemi tecnici che non vanno ottimizzate in questo run.
// notify: se false il chiamante invia il proprio riepilogo (es. il digest del cron).
export async function runOptimization({
  apply,
  notify = true,
  excludePaths = new Set(),
}) {
  const startedAt = Date.now();
  const range = rangeEndingOn(latestGscDay(), 28);
  const [metrics, queries, settings, opportunities, ga4Pages] = await Promise.all([
    pageMetrics(range),
    topQueries(range),
    getSeoSettings(),
    findOpportunities().catch((err) => {
      console.warn(`::warning::Opportunità non disponibili: ${err.message}`);
      return null;
    }),
    fetchTopPages(100).catch((err) => {
      console.warn(`::warning::Visite GA4 non disponibili: ${err.message}`);
      return [];
    }),
  ]);
  const ga4ByPath = new Map(ga4Pages.map((p) => [p.path, p]));

  const targets = await loadTargets(settings);
  for (const t of targets.values()) {
    const url = pageUrl(t.path);
    t.metrics = metrics.get(url) ?? null;
    t.topQueries = (queries.get(url) ?? []).slice(0, 10);
    t.ga4 = ga4ByPath.get(t.path) ?? null;
    t.opportunities = opportunities
      ? opportunitiesForPage(t.path, opportunities)
      : null;
  }

  const eligible = selectCandidates(targets, await readActions());
  const technicalSkipped = eligible
    .filter((t) => excludePaths.has(t.path))
    .map((t) => t.path);
  const candidates = eligible
    .filter((t) => !excludePaths.has(t.path))
    .sort(
      (a, b) =>
        (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0) ||
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
    );
  const batches = toBatches(candidates);
  console.log(
    `Target totali: ${targets.size}, da analizzare: ${candidates.length} in ${batches.length} gruppi.` +
      (technicalSkipped.length
        ? ` Saltati per problemi tecnici: ${technicalSkipped.join(", ")}.`
        : ""),
  );

  const run = {
    id: randomUUID(),
    at: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    range,
    analysis: "",
    totals: sumMetrics(metrics),
    proposed: [],
    rejected: [],
    applied: [],
    errors: [],
    skipped: 0,
    technicalSkipped,
  };
  const proposal = { actions: [], rejected: [] };
  const analyses = [];
  const budgetMs = config.runBudgetMinutes * 60_000;
  const changeLimit =
    config.maxChangesPerRun > 0 ? config.maxChangesPerRun : Infinity;
  let remaining = changeLimit;

  for (const [i, batch] of batches.entries()) {
    if (Date.now() - startedAt > budgetMs) {
      run.skipped = batches.slice(i).reduce((n, b) => n + b.length, 0);
      console.log(
        `\nBudget di tempo esaurito: ${run.skipped} target rimandati al prossimo run.`,
      );
      break;
    }
    if (remaining <= 0) {
      run.skipped = batches.slice(i).reduce((n, b) => n + b.length, 0);
      console.log(
        `\nLimite di ${changeLimit} modifiche per run raggiunto: ${run.skipped} target rimandati al prossimo run.`,
      );
      break;
    }
    console.log(`\n### Gruppo ${i + 1}/${batches.length} (${batch[0].kind})`);

    let result;
    try {
      result = await planBatch(batch, range, remaining);
    } catch (err) {
      console.error(`Gruppo ${i + 1} fallito: ${err.message}`);
      run.errors.push(err.message);
      continue;
    }
    remaining -= result.accepted;
    const { actions, rejected, analysis } = result;
    printSummary({ analysis, actions, rejected });
    if (analysis) analyses.push(analysis);
    proposal.actions.push(...actions);
    proposal.rejected.push(...rejected);
    run.proposed.push(
      ...actions.map((a) => ({
        path: a.path,
        fields: a.changes.map((c) => `${c.lang}.${c.field}`),
        confidence: a.confidence,
        reason: a.reason,
      })),
    );
    run.rejected.push(
      ...rejected.map((r) => ({
        path: r.change?.path,
        lang: r.change?.lang,
        field: r.change?.field,
        reason: r.reason,
      })),
    );

    if (apply) {
      try {
        await applyActions(actions, result.targets, run);
      } catch (err) {
        console.error(`Applicazione gruppo ${i + 1} fallita: ${err.message}`);
        run.errors.push(err.message);
      }
    }
  }

  run.analysis = analyses.join(" | ");
  const proposalFile = await saveProposal({
    createdAt: run.at,
    mode: run.mode,
    range,
    analysis: run.analysis,
    ...proposal,
  });
  await record("runs.jsonl", run);
  if (apply && notify) await notifyRecap(run);

  if (!apply)
    console.log(
      `\nDry-run: nessuna modifica applicata. Proposta salvata in ${proposalFile}`,
    );
  if (batches.length && run.errors.length === batches.length)
    throw new Error(`tutti i gruppi sono falliti: ${run.errors[0]}`);
  return run;
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
  if (b.impressions + a.impressions < 2 * config.minImpressions)
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
    await record("evaluations.jsonl", evaluation);
    console.log(`${action.path}: ${verdict} - ${evaluation.lesson}`);

    const laterChange = actions.some(
      (b) =>
        b !== action &&
        b.status === "applied" &&
        b.path === action.path &&
        b.appliedAt > action.appliedAt,
    );
    if (verdict === "peggiorato" && config.autoRollback && laterChange) {
      console.log(
        `Rollback saltato: ${action.path} ha modifiche successive, ripristinarla sovrascriverebbe il lavoro più recente.`,
      );
    } else if (verdict === "peggiorato" && config.autoRollback) {
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

  const technical = await technicalChecks();
  console.log("\n== Controlli tecnici");
  if (technical.sitemaps === null) {
    console.log("Sitemap non verificate (vedi avviso).");
  } else if (!technical.sitemaps.length) {
    console.log("Nessuna sitemap inviata a Search Console.");
  } else {
    for (const s of technical.sitemaps)
      console.log(
        `Sitemap ${s.path}: ${s.indexed}/${s.submitted} indicizzate, ${s.errors} errori, ${s.warnings} avvisi`,
      );
  }
  const notIndexed = technical.pages.filter(
    (p) => p.error || p.verdict !== "PASS",
  );
  console.log(
    `Pagine statiche indicizzate: ${technical.pages.length - notIndexed.length}/${technical.pages.length}`,
  );
  for (const p of notIndexed)
    console.log(
      `  ${p.path}: ${p.error ? `errore (${p.error})` : `${p.verdict} - ${p.coverage ?? "stato sconosciuto"}`}`,
    );

  await appendRecord("snapshots.jsonl", {
    at: new Date().toISOString(),
    current,
    previous,
    trend,
    technical,
  });
}

async function technicalChecks() {
  const sitemaps = await sitemapStatus().catch((err) => {
    console.warn(`::warning::Sitemap non verificate: ${err.message}`);
    return null;
  });
  const pages = await inspectPages(config.allowedPaths);
  return { sitemaps, pages };
}
