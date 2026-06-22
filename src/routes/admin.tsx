import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, Trophy, Send, FileText, Settings2, Download } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa, formatDate } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — LoNaNi" }] }),
  component: AdminPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  losing: "bg-muted text-muted-foreground",
  winning: "bg-success/15 text-success",
  paid: "bg-success text-success-foreground",
};

function AdminPage() {
  const { t } = useI18n();
  const { tickets, updateStatus } = useTickets();

  const revenue = tickets.reduce((s, t) => s + t.stake, 0);
  const active = tickets.filter((t) => t.status === "pending").length;
  const winners = tickets.filter((t) => t.status === "winning" || t.status === "paid").length;
  const payouts = tickets.filter((t) => t.status === "paid").reduce((s, t) => s + (t.prize ?? 0), 0);

  // 7-day revenue bars (deterministic placeholder + real ticket data overlaid)
  const bars = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    const seedBase = [180_000, 220_000, 165_000, 310_000, 275_000, 420_000, 360_000];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const fromTickets = tickets
        .filter((t) => t.createdAt.slice(0, 10) === iso)
        .reduce((s, t) => s + t.stake, 0);
      days.push({
        label: ["D", "L", "M", "M", "J", "V", "S"][d.getDay()],
        value: seedBase[6 - i] + fromTickets,
      });
    }
    return days;
  }, [tickets]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  const exportCsv = () => {
    const header = ["id", "game", "phone", "picks", "stake_fcfa", "payment", "status", "prize_fcfa", "draw_date", "created_at"];
    const rows = tickets.map((t) => [
      t.id, t.gameName, t.phone, `"${t.picksLabel.replace(/"/g, "''")}"`,
      t.stake, t.payment, t.status, t.prize ?? 0, formatDate(t.drawDate), t.createdAt,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lonani-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cycle = (id: string, current: string) => {
    const next =
      current === "pending" ? "winning" :
      current === "winning" ? "paid" :
      current === "paid" ? "losing" : "pending";
    const prize = next === "winning" ? Math.round((tickets.find(t => t.id === id)?.stake ?? 0) * 12) : undefined;
    updateStatus(id, next as "pending" | "winning" | "paid" | "losing", prize);
  };

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle="Espace administrateur" icon={<ShieldCheck className="h-5 w-5" />} />

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={TrendingUp} label={t("totalRevenue")} value={`${formatFcfa(revenue)} FCFA`} />
          <Kpi icon={Users} label={t("activeTickets")} value={String(active)} />
          <Kpi icon={Trophy} label={t("winners")} value={String(winners)} accent />
          <Kpi icon={Wallet} label={t("payouts")} value={`${formatFcfa(payouts)} FCFA`} />
        </div>

        {/* Revenue chart */}
        <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">{t("revenue7d")}</h2>
            <span className="text-xs text-muted-foreground">simulation</span>
          </div>
          <div className="mt-4 grid grid-cols-7 items-end gap-2 h-40">
            {bars.map((b, i) => (
              <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                <div
                  className="w-full rounded-t-lg bg-green-gradient shadow-green"
                  style={{ height: `${Math.max(8, (b.value / maxBar) * 100)}%` }}
                  title={`${formatFcfa(b.value)} FCFA`}
                />
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{b.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-display text-lg font-bold">Tickets</h2>
              <button onClick={exportCsv} disabled={!tickets.length} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-40">
                <Download className="h-3.5 w-3.5" /> {t("exportCsv")}
              </button>
            </div>
            {tickets.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun ticket pour le moment.</p>
            ) : (
              <div className="divide-y divide-border">
                {tickets.map((tk) => (
                  <div key={tk.id} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold">{tk.id}</div>
                      <div className="truncate text-sm">{tk.gameName} • {tk.picksLabel}</div>
                      <div className="text-xs text-muted-foreground">{tk.phone}</div>
                    </div>
                    <div className="font-display text-sm font-bold tabular-nums">{formatFcfa(tk.stake)}</div>
                    <button
                      onClick={() => cycle(tk.id, tk.status)}
                      className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", statusColor[tk.status])}
                    >
                      {tk.status}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Actions</h2>
            <div className="mt-3 grid gap-2">
              {[
                { icon: Settings2, label: t("manageGames") },
                { icon: Trophy, label: t("manageDraws") },
                { icon: Send, label: t("publishResults") },
                { icon: Send, label: t("sendSms") },
                { icon: FileText, label: t("financialReport") },
              ].map((a, i) => (
                <button key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold hover:border-primary">
                  <a.icon className="h-4 w-4 text-primary" /> {a.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border p-4 shadow-soft", accent ? "bg-gold-gradient text-[var(--gold-foreground)]" : "bg-card")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-xs font-semibold uppercase tracking-widest", accent ? "text-[var(--gold-foreground)]/70" : "text-muted-foreground")}>{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}