import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  losing: "bg-muted text-muted-foreground",
  winning: "bg-success/15 text-success",
  paid: "bg-success text-success-foreground",
};

export const gameLabel: Record<string, string> = { pmu: "PMU", loto: "Loto Balsa", foot: "Pari Foot" };

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function Kpi({ icon: Icon, label, value, accent, delta, sub }: { icon: LucideIcon; label: string; value: string; accent?: boolean; delta?: number; sub?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("rounded-2xl border border-border p-4 shadow-soft", accent ? "bg-gold-gradient text-[var(--gold-foreground)]" : "bg-card")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-xs font-semibold uppercase tracking-widest", accent ? "text-[var(--gold-foreground)]/70" : "text-muted-foreground")}>{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {typeof delta === "number" && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
            accent ? "bg-black/10 text-[var(--gold-foreground)]" :
            positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {positive ? "+" : ""}{delta}%
          </span>
        )}
        {sub && <span className={cn(accent ? "text-[var(--gold-foreground)]/80" : "text-muted-foreground")}>{sub}</span>}
      </div>
    </div>
  );
}

export function QuickAction({ icon: Icon, label, hint, onClick, tone }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void; tone?: "gold" }) {
  return (
    <button onClick={onClick} className={cn(
      "group flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5",
      tone === "gold" ? "border-gold/30 bg-gold/5" : "border-border bg-background/50",
    )}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone === "gold" ? "bg-gold/20 text-gold" : "bg-primary/15 text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold truncate">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

export type TxRow = { id: string; date: string; game: string; phone: string; region: string; stake: number; status: string; prize: number; kind: "live" | "sim" };