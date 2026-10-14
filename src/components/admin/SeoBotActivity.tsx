import { useEffect, useState } from "react";
import { apiGet } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronDown, ExternalLink } from "lucide-react";

interface Change { lang: string; field: string; before: string | null; after: string }
interface ActionData {
  path: string;
  kind?: string;
  changes: Change[];
  reason: string;
  appliedAt: string;
}
interface RunData {
  at: string;
  mode: string;
  analysis: string;
  proposed: unknown[];
  applied: string[];
  errors?: string[];
  skipped?: number;
}
interface EvaluationData {
  path: string;
  verdict: string;
  lesson: string;
  evaluatedAt: string;
}
interface Row<T> { record_id: string; data: T; created_at: string }
interface Activity {
  counts: Record<string, number>;
  runs: Row<RunData>[];
  actions: Row<ActionData>[];
  evaluations: Row<EvaluationData>[];
}

const KIND_LABEL: Record<string, string> = { page: "Pagina", blog: "Articolo", event: "Evento" };
const VERDICT_STYLE: Record<string, string> = {
  migliorato: "bg-green-100 text-green-700",
  peggiorato: "bg-red-100 text-red-700",
  neutro: "bg-gray-100 text-gray-700",
  "dati-insufficienti": "bg-yellow-100 text-yellow-700",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const kindOf = (a: ActionData) =>
  KIND_LABEL[a.kind ?? (a.path.startsWith("/blog/") ? "blog" : "page")] ?? "Pagina";

export default function SeoBotActivity() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(true);
  const [openAction, setOpenAction] = useState<string | null>(null);

  useEffect(() => {
    apiGet("/api/admin/seo-agent/activity")
      .then((d: Activity) => setActivity(d))
      .catch(() => setError(true));
  }, []);

  const runs = activity?.runs ?? [];
  const actions = activity?.actions ?? [];
  const evaluations = activity?.evaluations ?? [];
  const applied = activity?.counts.action ?? 0;
  const evaluated = activity?.counts.evaluation ?? 0;
  const lastRun = runs[0]?.data;
  const lastRunAt = runs[0]?.created_at;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Bot className="h-4 w-4 text-purple-600" />
          Attività del bot SEO
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100">
          {error && <p className="text-sm text-gray-500">Registro attività non disponibile.</p>}
          {!error && !activity && <p className="text-sm text-gray-500">Caricamento…</p>}
          {activity && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Esecuzioni" value={activity.counts.run ?? 0} />
                <Stat label="Modifiche applicate" value={applied} />
                <Stat label="In attesa di esito" value={Math.max(applied - evaluated, 0)} />
                <Stat label="Valutate" value={evaluated} />
              </div>

              {lastRun && lastRunAt && (
                <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 text-sm text-purple-900">
                  <p className="font-medium">
                    Ultima esecuzione: {fmtDate(lastRunAt)} · {lastRun.mode === "apply" ? "modifiche applicate" : "solo proposta"} ·{" "}
                    {lastRun.applied.length} pagine aggiornate
                    {lastRun.skipped ? ` · ${lastRun.skipped} rimandate` : ""}
                  </p>
                  {lastRun.analysis && <p className="mt-1 text-xs text-purple-800 line-clamp-3">{lastRun.analysis}</p>}
                  {!!lastRun.errors?.length && <p className="mt-1 text-xs text-red-600">Errori: {lastRun.errors.length}</p>}
                </div>
              )}

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ultime modifiche</h3>
                {!actions.length && <p className="text-sm text-gray-500">Nessuna modifica registrata.</p>}
                {actions.slice(0, 10).map(({ record_id, data, created_at }) => {
                  const expanded = openAction === record_id;
                  return (
                    <div key={record_id} className="border border-gray-100 rounded-md">
                      <button
                        type="button"
                        onClick={() => setOpenAction(expanded ? null : record_id)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2 flex-wrap min-w-0">
                          <Badge variant="secondary" className="text-xs">{kindOf(data)}</Badge>
                          <code className="text-xs text-gray-600 truncate max-w-[16rem] sm:max-w-md">{data.path}</code>
                          <span className="text-xs text-gray-400">
                            {fmtDate(created_at)} · {data.changes.length} campi
                          </span>
                        </span>
                        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="px-3 pb-3 space-y-2 text-xs text-gray-700 border-t border-gray-100">
                          <a
                            href={`https://www.weapnea.com${data.path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline mt-2"
                          >
                            Apri pagina <ExternalLink className="h-3 w-3" />
                          </a>
                          <ul className="space-y-1">
                            {data.changes.map((c) => (
                              <li key={`${c.lang}.${c.field}`}>
                                <span className="font-mono text-gray-500">{c.lang}.{c.field}</span>
                                {c.before ? <span className="line-through text-gray-400"> {c.before}</span> : null}
                                <span> → {c.after}</span>
                              </li>
                            ))}
                          </ul>
                          {data.reason && <p className="text-gray-500">Motivo: {data.reason}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Esiti delle modifiche</h3>
                {!evaluations.length && (
                  <p className="text-sm text-gray-500">Le prime valutazioni arriveranno circa 3 settimane dopo le modifiche.</p>
                )}
                {evaluations.slice(0, 8).map(({ record_id, data }) => (
                  <div key={record_id} className="text-xs flex items-start gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${VERDICT_STYLE[data.verdict] ?? "bg-gray-100 text-gray-700"}`}>
                      {data.verdict}
                    </span>
                    <span className="text-gray-600"><code>{data.path}</code> – {data.lesson}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-100 rounded-lg px-3 py-2">
      <p className="text-xl font-semibold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
