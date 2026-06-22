import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, Trophy, Send, FileText, Settings2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

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
          <Kpi icon={TrendingUp} label={t("totalRevenue")} value={`${revenue.toLocaleString()} FCFA`} />
          <Kpi icon={Users} label={t("activeTickets")} value={String(active)} />
          <Kpi icon={Trophy} label={t("winners")} value={String(winners)} accent />
          <Kpi icon={Wallet} label={t("payouts")} value={`${payouts.toLocaleString()} FCFA`} />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="rounded-3xl border border-border bg-card shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-display text-lg font-bold">Tickets</h2>
              <span className="text-xs text-muted-foreground">Cliquez sur le statut pour changer</span>
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
                    <div className="font-display text-sm font-bold tabular-nums">{tk.stake.toLocaleString()}</div>
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