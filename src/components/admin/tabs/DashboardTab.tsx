import { lazy, Suspense } from "react";
import {
  Activity,
  Clock,
  Download,
  LifeBuoy,
  ListChecks,
  LogIn,
  Send,
  Settings,
  TrendingUp,
  Trophy,
  Users,
  Zap,
  MapPin,
  Circle,
  UserCog,
} from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Kpi, QuickAction } from "../shared";
import type { ChartColors } from "@/hooks/use-theme-chart-colors";

const DashboardCharts = lazy(() => import("@/components/admin/DashboardCharts"));

export interface ActivityItem {
  at: number;
  kind: string;
  label: string;
  sub: string;
  tone: "ok" | "warn" | "info" | "gold";
}

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
  byGameData: {
    id: string;
    name: string;
    value: number;
    fill: string;
    count: number;
    pct: number;
  }[];
  hourlyData: { hour: string; count: number }[];
  monthlyData: { month: string; mises: number; gains: number }[];
  peakHour: { hour: string; count: number };
  chart: ChartColors;
  activityFeed: ActivityItem[];
  allRowsCount: number;
  cashoutRequestsCount: number;
  csvFrom: string;
  csvTo: string;
  setTab: (
    t:
      | "dashboard"
      | "transactions"
      | "players"
      | "regions"
      | "balls"
      | "ops"
      | "results"
      | "claims"
      | "admins",
  ) => void;
  exportCsv: (scope?: "all" | "winners" | "cashout") => void;
  monthStart: string;
  todayIso: string;
  reportDate: string;
  setReportDate: (date: string) => void;
  exportDailyPdf: () => void;
  pdfLoading: boolean;
  pdfError: string | null;
}

export function DashboardTab(p: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Chiffre d’affaires du mois"
          value={`${formatFcfa(p.totalStaked)} FCFA`}
          sub={`Du ${p.monthStart} au ${p.todayIso}`}
        />
        <Kpi
          icon={Zap}
          label={t("admin.dash.todaySales")}
          value={`${formatFcfa(p.todayStake)} FCFA`}
          delta={p.growth}
          sub={t("admin.dash.vsYesterday")}
        />
        <Kpi
          icon={Users}
          label={t("admin.dash.registeredPlayers")}
          value={String(p.activePlayers)}
          sub={t("admin.dash.liveTickets", { count: p.ticketsCount })}
        />
        <Kpi
          icon={Trophy}
          label={t("admin.dash.winners")}
          value={String(p.winnersCount)}
          accent
          sub={t("admin.dash.paidOut", { amount: formatFcfa(p.totalPayout) })}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-bold">{t("admin.dash.stakesByGame")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {p.byGameData.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: g.fill }}
                  />
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {g.name}
                  </span>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                  {g.pct}%
                </span>
              </div>
              <div className="mt-2 font-display text-xl font-bold tabular-nums">
                {formatFcfa(g.value)} FCFA
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {t("admin.dash.ticketCount", { count: g.count })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Suspense
        fallback={
          <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
            <div className="h-72 rounded-3xl border border-border bg-card animate-pulse" />
            <div className="h-72 rounded-3xl border border-border bg-card animate-pulse" />
          </div>
        }
      >
        <DashboardCharts
          revenueSeries={p.revenueSeries}
          byGameData={p.byGameData}
          hourlyData={p.hourlyData}
          monthlyData={p.monthlyData}
          peakHour={p.peakHour}
          chart={p.chart}
        />
      </Suspense>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-bold">Rapport journalier PDF</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Choisissez une date pour obtenir le bilan complet des ventes, gains, paiements, régions et tickets.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Date du rapport</span>
            <input
              type="date"
              value={p.reportDate}
              max={p.todayIso}
              onChange={(event) => p.setReportDate(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={p.exportDailyPdf}
            disabled={p.pdfLoading || !p.reportDate}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {p.pdfLoading ? "Génération…" : "Télécharger le PDF"}
          </button>
        </div>
        {p.pdfError && <p role="alert" className="mt-2 text-xs font-semibold text-destructive">{p.pdfError}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">{t("admin.dash.liveActivity")}</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> live
            </span>
          </div>
          {p.activityFeed.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {t("admin.dash.waitingActivity")}
            </p>
          ) : (
            <ul className="divide-y divide-border max-h-[380px] overflow-y-auto">
              {p.activityFeed.map((it, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      it.tone === "ok"
                        ? "bg-success"
                        : it.tone === "warn"
                          ? "bg-destructive"
                          : it.tone === "gold"
                            ? "bg-gold"
                            : "bg-primary",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{it.label}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        {new Date(it.at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
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
            <h2 className="font-display text-lg font-bold">{t("admin.dash.quickActions")}</h2>
          </div>
          <div className="grid gap-2">
            <QuickAction
              onClick={() => p.setTab("transactions")}
              icon={ListChecks}
              label={t("admin.dash.viewAllTransactions")}
              hint={t("admin.dash.records", { count: p.allRowsCount })}
            />
            <QuickAction
              onClick={() => p.setTab("players")}
              icon={Users}
              label="Joueurs"
              hint="Statistiques joueurs"
            />
            <QuickAction
              onClick={() => p.setTab("regions")}
              icon={MapPin}
              label="Régions"
              hint="Statistiques régionales"
            />
            <QuickAction
              onClick={() => p.setTab("balls")}
              icon={Circle}
              label="Statistiques des boules"
              hint="Mises et combinaisons"
            />
            <QuickAction
              onClick={() => p.setTab("results")}
              icon={ListChecks}
              label="Résultats"
              hint="Publication PMU / Loto"
            />
            <QuickAction
              onClick={() => p.setTab("ops")}
              icon={Send}
              label="Opérations"
              hint="Horaires et opérations"
            />
            <QuickAction
              onClick={() => p.setTab("claims")}
              icon={LifeBuoy}
              label="Réclamations"
              hint="Suivi des réclamations"
            />
            <QuickAction
              onClick={() => p.setTab("ops")}
              icon={Send}
              label={t("cashoutRequests")}
              hint={t("admin.dash.requests", { count: p.cashoutRequestsCount })}
              tone="gold"
            />
            <QuickAction
              onClick={() => p.setTab("admins")}
              icon={Settings}
              label={t("admin.ops.title")}
              hint={t("admin.admins.title")}
            />
            <QuickAction
              onClick={() => p.setTab("claims")}
              icon={LifeBuoy}
              label={t("admin.dash.openClaim")}
              hint={t("admin.dash.searchByNumber")}
            />
            <QuickAction
              onClick={() => p.exportCsv("all")}
              icon={Download}
              label={t("admin.dash.exportAll")}
              hint={`${p.csvFrom} → ${p.csvTo}`}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
