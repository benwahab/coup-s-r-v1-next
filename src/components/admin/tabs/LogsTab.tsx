import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthEvent, AuthEventKind } from "@/lib/auth-logs";

interface Props {
  filteredLog: AuthEvent[];
  logPhone: string; setLogPhone: (v: string) => void;
  logIp: string; setLogIp: (v: string) => void;
  logKind: AuthEventKind | "all"; setLogKind: (v: AuthEventKind | "all") => void;
  exportLogsCsv: () => void;
}

export function LogsTab(p: Props) {
  return (
    <section className="rounded-3xl border border-border bg-card shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-display text-lg font-bold">Journal des connexions</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <input value={p.logPhone} onChange={(e) => p.setLogPhone(e.target.value)} placeholder="Filtrer numéro" className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
          <input value={p.logIp} onChange={(e) => p.setLogIp(e.target.value)} placeholder="Filtrer IP" className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
          <select value={p.logKind} onChange={(e) => p.setLogKind(e.target.value as AuthEventKind | "all")} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]">
            <option value="all">Tous</option>
            <option value="otp-request">OTP demandé</option>
            <option value="verify-ok">Vérification OK</option>
            <option value="verify-fail">Vérification échec</option>
            <option value="locked">Verrouillage</option>
            <option value="rate-limited">Rate limit</option>
            <option value="logout">Déconnexion</option>
            <option value="session-expired">Session expirée</option>
          </select>
          <button onClick={p.exportLogsCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>
      {p.filteredLog.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun événement.</p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-secondary/60 backdrop-blur text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Horodatage</th>
                <th className="px-3 py-2 text-left">Numéro</th>
                <th className="px-3 py-2 text-left">IP</th>
                <th className="px-3 py-2 text-left">Événement</th>
                <th className="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {p.filteredLog.slice(0, 200).map((e, i) => (
                <tr key={i}>
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