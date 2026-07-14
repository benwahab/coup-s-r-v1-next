import { lazy, Suspense } from "react";
import { Activity, Clock, Download, LifeBuoy, ListChecks, LogIn, Send, Settings, TrendingUp, Trophy, Users, Zap } from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { Kpi, QuickAction } from "../shared";
import type { ChartColors } from "@/hooks/use-theme-chart-colors";

const DashboardCharts = lazy(() => import("@/components/admin/DashboardCharts"));

export interface ActivityItem { at: number; kind: string; label: string; sub: string; tone: "ok" | "warn" | "info" | "gold" }

interface Props {
  totalStaked: number;
  todayStake: number;
  activePlayers: number;
  winnersCount: number;
  weekGrowth: number;
  growth: number;
  ticketsCount: number;
  totalPayout: number;
  revenueSeries: { date: string; label: string; mises: number; gains: number }[];
  byGameData: { id: string; name: string; value: number; fill: string; count: number; pct: number }[];
  hourlyData: { hour: string; count: number }[];
  monthlyData: { month: string; mises: number; gains: number }[];
  peakHour: { hour: string; count: number };
  chart: ChartColors;
  activityFeed: ActivityItem[];
  allRowsCount: number;
  cashoutRequestsCount: number;
  authLogCount: number;
  csvFrom: string;
  csvTo: string;
  setTab: (t: "dashboard" | "transactions" | "players" | "regions" | "balls" | "ops" | "logs" | "claims" | "admins") => void;
  exportCsv: (scope?: "all" | "winners" | "cashout") => void;
}

export function DashboardTab(p: Props) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={TrendingUp} label="Chiffre d'affaires" value={`${formatFcfa(p.totalStaked)} FCFA`} delta={p.weekGrowth} sub="vs 7j précédents" />
        <Kpi icon={Zap} label="Ventes du jour" value={`${formatFcfa(p.todayStake)} FCFA`} delta={p.growth} sub="vs hier" />
        <Kpi icon={Users} label="Joueurs inscrits" value={String(p.activePlayers)} sub={`+${p.ticketsCount} tickets live`} />
        <Kpi icon={Trophy} label="Gagnants" value={String(p.winnersCount)} accent sub={`${formatFcfa(p.totalPayout)} FCFA versés`} />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-bold">Mises par jeu</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {p.byGameData.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.fill }} />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.name}</span>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">{g.pct}%</span>
              </div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">{formatFcfa(g.value)} FCFA</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{g.count} ticket{g.count > 1 ? "s" : ""}</div>
            </div>
          ))}
        </div>
      </section>

      <Suspense fallback={<div className="grid gap-4 xl:grid-cols-[2fr_1fr]"><div className="h-72 rounded-3xl border border-border bg-card animate-pulse" /><div className="h-72 rounded-3xl border border-border bg-card animate-pulse" /></div>}>
        <DashboardCharts
          revenueSeries={p.revenueSeries}
          byGameData={p.byGameData}
          hourlyData={p.hourlyData}
          monthlyData={p.monthlyData}
          peakHour={p.peakHour}
          chart={p.chart}
        />
      </Suspense>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">Activité en temps réel</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> live</span>
          </div>
          {p.activityFeed.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">En attente d'activité…</p>
          ) : (
            <ul className="divide-y divide-border max-h-[380px] overflow-y-auto">
              {p.activityFeed.map((it, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    it.tone === "ok" ? "bg-success" : it.tone === "warn" ? "bg-destructive" : it.tone === "gold" ? "bg-gold" : "bg-primary",
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{it.label}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0"><Clock className="inline h-3 w-3 mr-0.5" />{new Date(it.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{it.sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-gold" />
            <h2 className="font-display text-lg font-bold">Actions rapides</h2>
          </div>
          <div className="grid gap-2">
            <QuickAction onClick={() => p.setTab("transactions")} icon={ListChecks} label="Voir toutes les transactions" hint={`${p.allRowsCount} enregistrements`} />
            <QuickAction onClick={() => p.setTab("ops")} icon={Send} label="Encaissements en attente" hint={`${p.cashoutRequestsCount} demande(s)`} tone="gold" />
            <QuickAction onClick={() => p.setTab("admins")} icon={Settings} label="Paramètres" hint="Gestion des administrateurs" />
            <QuickAction onClick={() => p.setTab("logs")} icon={LogIn} label="Journal des connexions" hint={`${p.authLogCount} événements`} />
            <QuickAction onClick={() => p.setTab("claims")} icon={LifeBuoy} label="Ouvrir une réclamation" hint="Recherche par numéro" />
            <QuickAction onClick={() => p.exportCsv("all")} icon={Download} label="Exporter toutes les données" hint={`${p.csvFrom} → ${p.csvTo}`} />
          </div>
        </div>
      </section>
    </div>
  );
}