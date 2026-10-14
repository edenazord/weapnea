import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.mjs";

const memoryDir = path.join(config.dataDir, "memory");

async function readRecords(name) {
  try {
    const text = await readFile(path.join(memoryDir, name), "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function appendRecord(name, record) {
  await mkdir(memoryDir, { recursive: true });
  await appendFile(
    path.join(memoryDir, name),
    `${JSON.stringify(record)}\n`,
    "utf8",
  );
}

export async function writeRecords(name, records) {
  await mkdir(memoryDir, { recursive: true });
  const text = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(path.join(memoryDir, name), text ? `${text}\n` : "", "utf8");
}

export const readActions = () => readRecords("actions.jsonl");
export const readEvaluations = () => readRecords("evaluations.jsonl");
export const readRuns = () => readRecords("runs.jsonl");

export async function saveProposal(proposal) {
  const dir = path.join(config.dataDir, "proposals");
  await mkdir(dir, { recursive: true });
  const file = path.join(
    dir,
    `${proposal.createdAt.replace(/[:.]/g, "-")}.json`,
  );
  await writeFile(file, JSON.stringify(proposal, null, 2), "utf8");
  return path.relative(process.cwd(), file);
}

export async function historyForPrompt(paths, limit = 5) {
  const actions = await readActions();
  const outcomes = new Map(
    (await readEvaluations()).map((e) => [e.actionId, e]),
  );

  return paths.map((p) => ({
    path: p,
    past: actions
      .filter((a) => a.path === p)
      .slice(-limit)
      .map((a) => {
        const evaluation = outcomes.get(a.id);
        return {
          appliedAt: a.appliedAt,
          status: a.status,
          changes: a.changes.map((c) => ({
            lang: c.lang,
            field: c.field,
            from: c.before,
            to: c.after,
          })),
          reason: a.reason,
          outcome: evaluation
            ? {
                verdict: evaluation.verdict,
                delta: evaluation.delta,
                lesson: evaluation.lesson,
              }
            : "in attesa",
        };
      }),
  }));
}
