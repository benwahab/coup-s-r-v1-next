import { Download, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { AuthEvent, AuthEventKind } from "@/lib/auth-logs";

interface Props {
  filteredLog: AuthEvent[];
  logPhone: string; setLogPhone: (v: string) => void;
  logIp: string; setLogIp: (v: string) => void;
  logKind: AuthEventKind | "all"; setLogKind: (v: AuthEventKind | "all") => void;
  exportLogsCsv: () => void;
}

export function LogsTab(p: Props) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.logs.title")}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={p.logPhone} onChange={(e) => p.setLogPhone(e.target.value)} placeholder={t("admin.logs.filterPhone")} className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
          <input value={p.logIp} onChange={(e) => p.setLogIp(e.target.value)} placeholder={t("admin.logs.filterIp")} className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
          <select value={p.logKind} onChange={(e) => p.setLogKind(e.target.value as AuthEventKind | "all")} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]">
            <option value="all">{t("admin.ops.scopeAll")}</option>
            <option value="otp-request">{t("admin.logs.otpRequest")}</option>
            <option value="verify-ok">{t("admin.logs.verifyOk")}</option>
            <option value="verify-fail">{t("admin.logs.verifyFail")}</option>
            <option value="locked">{t("admin.logs.locked")}</option>
            <option value="rate-limited">{t("admin.logs.rateLimited")}</option>
            <option value="logout">{t("admin.logs.logout")}</option>
            <option value="session-expired">{t("admin.logs.sessionExpired")}</option>
          </select>
          <button onClick={p.exportLogsCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
            <Download className="h-3.5 w-3.5" /> {t("admin.logs.exportCsv")}
          </button>
        </div>
      </div>
      {p.filteredLog.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">{t("admin.claims.noEvent")}</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary/60 backdrop-blur text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">{t("admin.logs.timestamp")}</th>
                <th className="px-3 py-2 text-left">{t("admin.logs.number")}</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">{t("admin.logs.event")}</th>
                <th className="px-3 py-2 text-left">{t("admin.logs.note")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.filteredLog.slice(0, 200).map((e, i) => (
                <tr key={i} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR", { hour12: false })}</td>
                  <td className="px-3 py-2 font-mono">{e.phone || "—"}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{e.ip}</td>
                  <td className="px-3 py-2"><span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                    e.kind === "verify-ok" ? "bg-success/15 text-success" :
                    e.kind === "verify-fail" ? "bg-destructive/15 text-destructive" :
                    e.kind === "locked" || e.kind === "rate-limited" ? "bg-primary/15 text-primary" :
                    "bg-secondary text-muted-foreground",
                  )}>{e.kind}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{e.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}