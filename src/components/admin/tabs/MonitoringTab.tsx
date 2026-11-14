import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Activity, AlertTriangle, Database, RefreshCw, Server, Sparkles, Timer, XCircle } from "lucide-react";
import { adminAnalyzeMonitoring, adminGetMonitoringSnapshot, type MonitoringAnalysis, type MonitoringSnapshot } from "@/lib/admin.functions";

const AI_ERRORS: Record<string, string> = {
  ai_credits_exhausted: "Crédits IA épuisés. Rechargez-les dans les réglages de l'espace de travail.",
  ai_rate_limited: "Trop de demandes IA. Réessayez dans une minute.",
  ai_access_denied: "Accès au modèle IA refusé.",
  selection_not_found: "Sélection introuvable. Actualisez la page.",
};

function pct(v: number) { return `${v.toFixed(2)}%`; }

export function MonitoringTab() {
  const { t } = useI18n();
  const [data, setData] = useState<MonitoringSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MonitoringAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else if (n.size < 50) n.add(id); return n; });
  const analyze = async () => {
    setAnalyzing(true); setAiError(null); setAnalysis(null);
    try { setAnalysis(await adminAnalyzeMonitoring({ data: { eventIds: [...selected], incidentId } })); }
    catch (e) { const m = e instanceof Error ? e.message : ""; setAiError(AI_ERRORS[m] ?? "Analyse IA indisponible pour le moment. Réessayez."); }
    finally { setAnalyzing(false); }
  };

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try { setData(await adminGetMonitoringSnapshot()); }
    catch { setError("Impossible de charger la supervision technique."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const healthy = data ? data.errorRate < 5 && data.timeoutRate < 3 && data.p95LatencyMs < 1000 && data.incidents.length === 0 : false;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{t("admin.static.supervision")}</h2>
          <p className="text-xs text-muted-foreground">{t("admin.static.supervisionWindow")}</p>
        </div>
        <button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold">
          <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualiser
        </button>
      </div>
      {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {data && (
        <>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              {healthy ? <Activity className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              <span className="font-bold">{healthy ? "État global stable" : "Points d'attention détectés"}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{data.totalEvents} événements observés sur la période.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Taux d'erreur", pct(data.errorRate), XCircle],
              ["Timeouts", pct(data.timeoutRate), Timer],
              ["Latence moyenne", `${data.avgLatencyMs} ms`, Activity],
              ["P95 latence", `${data.p95LatencyMs} ms`, Server],
            ].map(([label, value, Icon]) => {
              const I = Icon as typeof Activity;
              return <div key={String(label)} className="rounded-2xl border border-border bg-card p-4"><I className="h-4 w-4 text-primary" /><div className="mt-2 text-xs text-muted-foreground">{String(label)}</div><div className="text-xl font-bold">{String(value)}</div></div>;
            })}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-bold">{t("admin.static.services")}</h3>
              <div className="mt-3 space-y-2">{data.services.length ? data.services.map(s => <div key={s.service} className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2 text-xs"><span>{s.service}</span><span>{s.events} év. · {s.errors} err. · {s.avgLatencyMs} ms</span></div>) : <p className="text-xs text-muted-foreground">{t("admin.static.none")}</p>}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-bold">{t("admin.static.openIncidents")}</h3>
              <div className="mt-3 space-y-2">{data.incidents.length ? data.incidents.map(i => <label key={i.id} className="flex cursor-pointer gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs"><input type="radio" name="incident" checked={incidentId === i.id} onChange={() => setIncidentId(i.id)} aria-label={`Sélectionner l'incident ${i.title}`} /><div><div className="font-semibold">{i.title}</div><div className="mt-1 text-muted-foreground">{i.service} · {i.metric} · {i.severity} · {i.status}</div></div></label>) : <p className="text-xs text-muted-foreground">{t("admin.static.noIncident")}</p>}</div>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="font-bold" >{t("admin.static.thresholds")}</h3>
              <div className="mt-3 space-y-2">{data.alertRules.map(r => <div key={r.id} className="flex justify-between rounded-xl bg-secondary/30 px-3 py-2 text-xs"><span>{r.metric}</span><span>{r.enabled ? r.threshold : "désactivé"}</span></div>)}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><h3 className="font-bold">{t("admin.static.database")}</h3></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(data.dbStats).map(([k,v]) => <div key={k} className="rounded-xl bg-secondary/30 p-2"><div className="text-muted-foreground">{k}</div><div className="font-semibold">{String(v)}</div></div>)}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{t("admin.static.recentEvents")}</h3><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{selected.size} journal(aux){incidentId ? " + 1 incident" : ""}</span>{(selected.size > 0 || incidentId) && <button onClick={() => { setSelected(new Set()); setIncidentId(null); }} className="underline">{t("admin.static.clear")}</button>}<button onClick={() => void analyze()} disabled={analyzing || (selected.size === 0 && !incidentId)} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50"><Sparkles className={analyzing ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />{analyzing ? "Analyse…" : "Analyser avec l'IA"}</button></div></div>
            {aiError && <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{aiError}</p>}
            {analysis && <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"><div className="mb-2 text-xs text-muted-foreground">Analyse IA · {analysis.eventCount} journal(aux){analysis.incidentTitle ? ` · ${analysis.incidentTitle}` : ""} · suggestion à vérifier</div><div className="whitespace-pre-wrap">{analysis.summary}</div></div>}
            <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-2"></th><th className="p-2">{t("admin.static.hour")}</th><th className="p-2">{t("admin.static.service")}</th><th className="p-2">{t("admin.static.endpoint")}</th><th className="p-2">{t("admin.static.status")}</th><th className="p-2">{t("admin.static.duration")}</th><th className="p-2">{t("admin.static.trace")}</th></tr></thead><tbody>{data.recentEvents.slice(0,50).map(e => <tr key={e.id} className="border-b border-border/50"><td className="p-2"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Sélectionner ${e.traceId}`} /></td><td className="p-2 whitespace-nowrap">{new Date(e.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Niamey" })}</td><td className="p-2">{e.service}</td><td className="p-2 max-w-[240px] truncate">{e.endpoint ?? "—"}</td><td className="p-2">{e.status ?? "—"} · {e.level}</td><td className="p-2">{e.durationMs ?? "—"} ms</td><td className="p-2 font-mono">{e.traceId}</td></tr>)}</tbody></table></div>
          </div>
        </>
      )}
    </section>
  );
}
