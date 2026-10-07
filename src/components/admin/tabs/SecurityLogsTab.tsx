import { useCallback, useEffect, useState } from "react";
import { Download, FileSearch, RefreshCw } from "lucide-react";
import { adminListSecurityLogs, type SecurityLogRow } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { downloadCsv } from "@/components/admin/shared";

export function SecurityLogsTab() {
  const { t } = useI18n();
  const [logs, setLogs] = useState<SecurityLogRow[]>([]);
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const r = await adminListSecurityLogs({ data: { days, search, action, page } });
      setLogs(r.logs); setHasMore(r.hasMore);
    } catch { setError(t("admin.static.securityLoadError")); }
    finally { setBusy(false); }
  }, [days, search, action, page]);

  useEffect(() => { void load(); }, [load]);

  const exportCsv = () => {
    const rows = logs.map(l => [l.createdAt, l.action, l.phone ?? "", l.ip ?? "", l.detail]);
    downloadCsv(["date,action,telephone,ip,detail", ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n"), `coupsur-security-logs-page-${page}.csv`);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-xl font-bold">{t("admin.static.securityLogs")}</h2><p className="text-xs text-muted-foreground">{t("admin.static.auditDesc")}</p></div>
        <div className="flex gap-2"><button onClick={exportCsv} disabled={!logs.length} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold"><Download className="h-4 w-4" /> CSV</button><button onClick={() => void load()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs font-semibold"><RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Actualiser</button></div>
      </div>
      <div className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-3">
        <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} placeholder={t("admin.static.searchAction") } className="rounded-xl border border-border bg-background px-3 py-2 text-xs" />
        <input value={action} onChange={e => { setPage(1); setAction(e.target.value); }} placeholder={t("admin.static.actionType") } className="rounded-xl border border-border bg-background px-3 py-2 text-xs" />
        <select value={days} onChange={e => { setPage(1); setDays(Number(e.target.value)); }} className="rounded-xl border border-border bg-background px-3 py-2 text-xs"><option value={1}>{t("admin.static.hours24")}</option><option value={7}>{t("admin.static.days7")}</option><option value={30}>{t("admin.static.days30")}</option></select>
      </div>
      {error && <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-primary" /><span className="font-bold">{busy ? t("auth.checkingServer") : t("admin.static.displayedEvents", { count: logs.length })}</span></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="p-2">{t("admin.static.date")}</th><th className="p-2">{t("admin.static.action")}</th><th className="p-2">{t("admin.static.user")}</th><th className="p-2">IP</th><th className="p-2">{t("admin.static.detail")}</th></tr></thead><tbody>{logs.map(l => <tr key={l.id} className="border-b border-border/50"><td className="p-2 whitespace-nowrap">{new Date(l.createdAt).toLocaleString("fr-FR")}</td><td className="p-2 font-medium">{l.action}</td><td className="p-2">{l.phone ?? (l.userId ? l.userId.slice(0,8) : "système")}</td><td className="p-2">{l.ip ?? "—"}</td><td className="p-2 max-w-[420px] truncate">{l.detail}</td></tr>)}</tbody></table></div>
        <div className="mt-3 flex justify-end gap-2"><button disabled={page<=1 || busy} onClick={() => setPage(p => p-1)} className="rounded-full border border-border px-3 py-1.5 text-xs">{t("admin.static.previous")}</button><span className="px-2 py-1.5 text-xs text-muted-foreground">{t("admin.static.page", { page })}</span><button disabled={!hasMore || busy} onClick={() => setPage(p => p+1)} className="rounded-full border border-border px-3 py-1.5 text-xs">{t("admin.static.next")}</button></div>
      </div>
    </section>
  );
}
