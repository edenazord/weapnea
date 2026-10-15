import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiGet, apiSend } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, BarChart2, RefreshCw, Save } from "lucide-react";
import SeoBotActivity from "@/components/admin/SeoBotActivity";

interface SiteConfig {
  gtm_id: string;
  ga4_id: string;
  gsc_verification: string;
}

interface Totals { clicks: number; impressions: number; ctr: number; position: number }
interface RankedRow { key: string; clicks: number; impressions: number; position: number }

// Snapshot prodotto dal cron del seo-agent (src/overview.mjs). Ogni sezione può essere null se la fonte non era disponibile.
interface Snapshot {
  generatedAt: string;
  gsc: {
    period: { start: string; end: string };
    current: Totals;
    previous: Totals;
    topQueries: RankedRow[];
    topPages: RankedRow[];
  } | null;
  ga4: {
    sessions: number;
    users: number;
    topPages: { path: string; views: number; users: number; engagementRate: number }[];
  } | null;
  cwv: { lcpMs: number | null; inpMs: number | null; cls: number | null } | null;
  sitemaps: { path: string; lastDownloaded: string | null; errors: number; warnings: number; submitted: number; indexed: number }[];
  indexing: {
    checked: number;
    indexed: number;
    notIndexed: number;
    errors: number;
    technicalProblems: string[];
    diagnosis: { path: string; coverageState: string; userCanonical: string | null; googleCanonical: string | null }[];
  } | null;
  agent: {
    lastRun: { at: string; mode: string; applied: number; errors: number; skipped: number } | null;
    evaluations: { total: number; verdicts: Record<string, number> };
  } | null;
  errors: string[];
}

type Rating = "buono" | "da migliorare" | "scarso";
const RATING_STYLE: Record<Rating, string> = {
  buono: "bg-green-100 text-green-700",
  "da migliorare": "bg-yellow-100 text-yellow-700",
  scarso: "bg-red-100 text-red-700",
};
const VERDICT_STYLE: Record<string, string> = {
  migliorato: "bg-green-100 text-green-700",
  peggiorato: "bg-red-100 text-red-700",
  neutro: "bg-gray-100 text-gray-700",
  "dati-insufficienti": "bg-yellow-100 text-yellow-700",
};

// Soglie Core Web Vitals di Google (p75): buono fino alla prima soglia, scarso oltre la seconda.
const CWV_THRESHOLDS = {
  lcpMs: { good: 2500, poor: 4000 },
  inpMs: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

const nf = new Intl.NumberFormat("it-IT");
const fmtNum = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));
const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};
const rate = (value: number, t: { good: number; poor: number }): Rating =>
  value <= t.good ? "buono" : value <= t.poor ? "da migliorare" : "scarso";

function MetricCard({ label, value, footer }: { label: string; value: string; footer?: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}

// Differenza rispetto al periodo precedente. Per la posizione un valore più basso è un miglioramento.
function Delta({ now, before, lowerIsBetter = false, suffix = "" }: { now: number; before: number | null | undefined; lowerIsBetter?: boolean; suffix?: string }) {
  if (before == null) return null;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return <span className="text-xs text-gray-400">invariato vs 28 gg prec.</span>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs ${good ? "text-green-600" : "text-red-600"}`}>
      {diff > 0 ? "+" : ""}{nf.format(diff)}{suffix} vs 28 gg prec.
    </span>
  );
}

function SectionCard({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-800">{title}</CardTitle>
        {note && <p className="text-xs text-gray-500">{note}</p>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Unavailable({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{text}</p>;
}

export default function SeoOverview() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({ gtm_id: "", ga4_id: "", gsc_verification: "" });
  const [siteConfigSaving, setSiteConfigSaving] = useState(false);

  const loadOverview = useCallback(() => {
    setLoading(true);
    return apiGet("/api/admin/seo-overview")
      .then((r: { data: Snapshot | null }) => setSnapshot(r.data))
      .catch(() => toast.error("Errore nel caricamento della panoramica SEO"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadOverview();
    apiGet("/api/admin/site-config")
      .then((d: SiteConfig) => setSiteConfig({ gtm_id: d.gtm_id || "", ga4_id: d.ga4_id || "", gsc_verification: d.gsc_verification || "" }))
      .catch(() => {});
  }, [loadOverview]);

  const handleSiteConfigSave = async () => {
    setSiteConfigSaving(true);
    try {
      await apiSend("/api/admin/site-config", "PUT", siteConfig);
      toast.success("Impostazioni tracking salvate");
    } catch (e: any) {
      toast.error(e?.message || "Errore nel salvataggio");
    } finally {
      setSiteConfigSaving(false);
    }
  };

  const gsc = snapshot?.gsc ?? null;
  const ga4 = snapshot?.ga4 ?? null;
  const cwv = snapshot?.cwv ?? null;
  const indexing = snapshot?.indexing ?? null;
  const agent = snapshot?.agent ?? null;
  const diagnosisByPath = new Map((indexing?.diagnosis ?? []).map((d) => [d.path, d]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Panoramica SEO</h2>
          <p className="text-xs text-gray-500">
            {snapshot
              ? `Dati generati il ${fmtDateTime(snapshot.generatedAt)}. Il bot li aggiorna a ogni run (08:00 e 18:00 UTC).`
              : "Sola lettura: nessun dato ancora."}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={loadOverview} disabled={loading} className="h-8 px-3 text-xs">
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </Button>
      </div>

      {!loading && !snapshot && (
        <Unavailable text="Nessuno snapshot ancora. Viene creato al prossimo run del cron del bot SEO, oppure con `npm run overview` in seo-agent." />
      )}

      {snapshot && snapshot.errors.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Alcune fonti non sono disponibili nell&apos;ultimo snapshot:</p>
            <ul className="list-disc pl-5 text-xs">
              {snapshot.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* Search Console: ultimi 28 giorni (con ritardo di 3 giorni) */}
      <SectionCard title="Google Search Console" note={gsc ? `Periodo: ${gsc.period.start} → ${gsc.period.end}, confrontato con i 28 giorni precedenti.` : undefined}>
        {gsc ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Clic" value={fmtNum(gsc.current.clicks)} footer={<Delta now={gsc.current.clicks} before={gsc.previous.clicks} />} />
              <MetricCard label="Impressioni" value={fmtNum(gsc.current.impressions)} footer={<Delta now={gsc.current.impressions} before={gsc.previous.impressions} />} />
              <MetricCard label="CTR medio" value={`${gsc.current.ctr}%`} footer={<Delta now={gsc.current.ctr} before={gsc.previous.ctr} suffix=" pt" />} />
              <MetricCard label="Posizione media" value={String(gsc.current.position)} footer={<Delta now={gsc.current.position} before={gsc.previous.position} lowerIsBetter />} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Query principali</p>
                {gsc.topQueries.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Query</TableHead><TableHead className="text-right">Clic</TableHead><TableHead className="text-right">Impr.</TableHead><TableHead className="text-right">Pos.</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {gsc.topQueries.map((q) => (
                        <TableRow key={q.key}>
                          <TableCell className="text-sm">{q.key}</TableCell>
                          <TableCell className="text-right">{fmtNum(q.clicks)}</TableCell>
                          <TableCell className="text-right">{fmtNum(q.impressions)}</TableCell>
                          <TableCell className="text-right">{q.position}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <Unavailable text="Nessuna query nel periodo." />}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Pagine principali</p>
                {gsc.topPages.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Pagina</TableHead><TableHead className="text-right">Clic</TableHead><TableHead className="text-right">Impr.</TableHead><TableHead className="text-right">Pos.</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {gsc.topPages.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell className="text-sm font-mono break-all">{pathOf(p.key)}</TableCell>
                          <TableCell className="text-right">{fmtNum(p.clicks)}</TableCell>
                          <TableCell className="text-right">{fmtNum(p.impressions)}</TableCell>
                          <TableCell className="text-right">{p.position}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : <Unavailable text="Nessuna pagina nel periodo." />}
              </div>
            </div>
          </>
        ) : <Unavailable text="Dati Search Console non disponibili nell'ultimo snapshot." />}
      </SectionCard>

      {/* Google Analytics 4 */}
      <SectionCard title="Google Analytics 4" note="Ultimi 28 giorni.">
        {ga4 ? (
          <>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <MetricCard label="Sessioni" value={fmtNum(ga4.sessions)} />
              <MetricCard label="Utenti attivi" value={fmtNum(ga4.users)} />
            </div>
            {ga4.topPages.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Pagina</TableHead><TableHead className="text-right">Visualizzazioni</TableHead><TableHead className="text-right">Utenti</TableHead><TableHead className="text-right">Engagement</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {ga4.topPages.map((p) => (
                    <TableRow key={p.path}>
                      <TableCell className="text-sm font-mono break-all">{p.path}</TableCell>
                      <TableCell className="text-right">{fmtNum(p.views)}</TableCell>
                      <TableCell className="text-right">{fmtNum(p.users)}</TableCell>
                      <TableCell className="text-right">{p.engagementRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Unavailable text="Nessuna visita registrata negli ultimi 28 giorni. Se il sito ha traffico, controlla che il tag GA4 sia attivo." />}
          </>
        ) : <Unavailable text="GA4 non disponibile. Controlla GA4_PROPERTY_ID e che il service account abbia accesso alla proprietà." />}
      </SectionCard>

      {/* Core Web Vitals */}
      <SectionCard title="Core Web Vitals (mobile, dati reali)" note="Valore p75 di Chrome UX Report. Richiede abbastanza traffico per essere disponibile.">
        {cwv ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {([
              { label: "LCP", value: cwv.lcpMs, t: CWV_THRESHOLDS.lcpMs, fmt: (v: number) => `${(v / 1000).toFixed(2).replace(".", ",")} s` },
              { label: "INP", value: cwv.inpMs, t: CWV_THRESHOLDS.inpMs, fmt: (v: number) => `${Math.round(v)} ms` },
              { label: "CLS", value: cwv.cls, t: CWV_THRESHOLDS.cls, fmt: (v: number) => v.toFixed(2).replace(".", ",") },
            ]).map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value == null ? "—" : m.fmt(m.value)}
                footer={m.value == null ? undefined : (
                  <Badge variant="secondary" className={`text-xs ${RATING_STYLE[rate(m.value, m.t)]}`}>{rate(m.value, m.t)}</Badge>
                )}
              />
            ))}
          </div>
        ) : <Unavailable text="Core Web Vitals non disponibili (traffico insufficiente per il Chrome UX Report, o chiave CRUX_API_KEY assente)." />}
      </SectionCard>

      {/* Indicizzazione e problemi tecnici */}
      <SectionCard title="Indicizzazione" note="Stato delle pagine in sitemap, dal controllo URL Inspection del bot.">
        {indexing ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Controllate" value={fmtNum(indexing.checked)} />
              <MetricCard label="Indicizzate" value={fmtNum(indexing.indexed)} />
              <MetricCard label="Non indicizzate" value={fmtNum(indexing.notIndexed)} />
              <MetricCard label="Problemi tecnici" value={fmtNum(indexing.technicalProblems.length)} />
            </div>
            {indexing.technicalProblems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Pagina</TableHead><TableHead>Stato Google</TableHead><TableHead>Canonical dichiarata</TableHead><TableHead>Canonical di Google</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {indexing.technicalProblems.map((p) => {
                    const d = diagnosisByPath.get(p);
                    return (
                      <TableRow key={p}>
                        <TableCell className="text-sm font-mono break-all">{p}</TableCell>
                        <TableCell className="text-sm">{d?.coverageState ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono break-all">{d?.userCanonical ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono break-all">{d?.googleCanonical ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : <Unavailable text="Nessuna pagina con problemi tecnici." />}
            {indexing.errors > 0 && <p className="text-xs text-gray-500">{indexing.errors} URL non ispezionate per errori temporanei di Google.</p>}
          </>
        ) : <Unavailable text="Controllo indicizzazione non disponibile nell'ultimo snapshot." />}
      </SectionCard>

      {/* Sitemap */}
      <SectionCard title="Sitemap" note="Le URL indicizzate arrivano dai dati di Search Console e possono restare a 0 finché Google non elabora la sitemap.">
        {snapshot && snapshot.sitemaps.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Sitemap</TableHead><TableHead className="text-right">Inviate</TableHead><TableHead className="text-right">Indicizzate</TableHead><TableHead className="text-right">Errori</TableHead><TableHead>Ultimo download</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.sitemaps.map((s) => (
                <TableRow key={s.path}>
                  <TableCell className="text-sm font-mono break-all">{s.path}</TableCell>
                  <TableCell className="text-right">{fmtNum(s.submitted)}</TableCell>
                  <TableCell className="text-right">{fmtNum(s.indexed)}</TableCell>
                  <TableCell className="text-right">{fmtNum(s.errors)}</TableCell>
                  <TableCell className="text-xs">{fmtDateTime(s.lastDownloaded)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <Unavailable text="Nessuna sitemap disponibile nell'ultimo snapshot." />}
      </SectionCard>

      {/* Agente */}
      <SectionCard title="Bot SEO">
        {agent ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Ultimo run" value={agent.lastRun ? fmtDateTime(agent.lastRun.at) : "—"} footer={agent.lastRun && <span className="text-xs text-gray-500">modalità {agent.lastRun.mode}</span>} />
            <MetricCard label="Modifiche applicate (ultimo run)" value={fmtNum(agent.lastRun?.applied)} footer={agent.lastRun && <span className="text-xs text-gray-500">{agent.lastRun.skipped} saltate, {agent.lastRun.errors} errori</span>} />
            <MetricCard label="Valutazioni" value={fmtNum(agent.evaluations.total)} />
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500 mb-2">Esiti</p>
              <div className="flex flex-wrap gap-1">
                {Object.keys(agent.evaluations.verdicts).length === 0 && <span className="text-xs text-gray-400">nessuna ancora</span>}
                {Object.entries(agent.evaluations.verdicts).map(([verdict, n]) => (
                  <Badge key={verdict} variant="secondary" className={`text-xs ${VERDICT_STYLE[verdict] ?? ""}`}>{verdict}: {n}</Badge>
                ))}
              </div>
            </div>
          </div>
        ) : <Unavailable text="Dati del bot non disponibili nell'ultimo snapshot." />}
      </SectionCard>

      {/* Attività del bot (dettaglio run, modifiche e valutazioni) */}
      <SeoBotActivity />

      {/* Tracking / Analytics */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <BarChart2 className="h-4 w-4 text-green-600" />
            Analytics & Tracking
          </div>
          <Button size="sm" onClick={handleSiteConfigSave} disabled={siteConfigSaving} className="h-7 px-3 text-xs">
            <Save className="h-3.5 w-3.5 mr-1" />
            {siteConfigSaving ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Google Tag Manager ID</label>
            <Input
              value={siteConfig.gtm_id}
              placeholder="GTM-XXXXXXX"
              className="text-sm font-mono"
              onChange={e => setSiteConfig(p => ({ ...p, gtm_id: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Google Analytics 4 ID</label>
            <Input
              value={siteConfig.ga4_id}
              placeholder="G-XXXXXXXXXX"
              className="text-sm font-mono"
              onChange={e => setSiteConfig(p => ({ ...p, ga4_id: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Google Search Console</label>
            <Input
              value={siteConfig.gsc_verification}
              placeholder="codice verifica"
              className="text-sm font-mono"
              onChange={e => setSiteConfig(p => ({ ...p, gsc_verification: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
