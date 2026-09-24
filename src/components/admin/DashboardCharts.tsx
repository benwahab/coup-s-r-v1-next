import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ChartColors } from "@/hooks/use-theme-chart-colors";
import { formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { ReactNode } from "react";

type Revenue = { date: string; label: string; mises: number; gains: number };
type ByGame = { id: string; name: string; value: number; fill: string };
type Hourly = { hour: string; count: number };
type Monthly = { month: string; mises: number; gains: number };

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export default function DashboardCharts({
  revenueSeries,
  byGameData,
  hourlyData,
  monthlyData,
  peakHour,
  chart,
}: {
  revenueSeries: Revenue[];
  byGameData: ByGame[];
  hourlyData: Hourly[];
  monthlyData: Monthly[];
  peakHour: Hourly;
  chart: ChartColors;
}) {
  const { t } = useI18n();
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartCard title={t("admin.charts.salesTrend")} hint={t("admin.charts.stakesVsPrizes")}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mises" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.teal} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={chart.teal} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gains" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chart.gold} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={chart.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.border} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  stroke={chart.mutedForeground}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke={chart.mutedForeground}
                  tickFormatter={(v) => `${(v / 1000) | 0}k`}
                  width={40}
                />
                <RTooltip
                  contentStyle={{
                    background: chart.card,
                    border: `1px solid ${chart.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${formatFcfa(v)} FCFA`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  name={t("admin.charts.stakes")}
                  dataKey="mises"
                  stroke={chart.teal}
                  fill="url(#mises)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  name={t("admin.charts.prizes")}
                  dataKey="gains"
                  stroke={chart.gold}
                  fill="url(#gains)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={t("admin.charts.byGame")} hint={t("admin.charts.stakeVolume")}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byGameData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {byGameData.map((entry) => (
                    <Cell key={entry.id} fill={entry.fill} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    background: chart.card,
                    border: `1px solid ${chart.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${formatFcfa(v)} FCFA`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={t("admin.charts.peakHours")}
          hint={t("admin.charts.peakAt", { hour: peakHour.hour, count: peakHour.count })}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ left: 0, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.border} vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9 }}
                  stroke={chart.mutedForeground}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 10 }} stroke={chart.mutedForeground} width={30} />
                <RTooltip
                  contentStyle={{
                    background: chart.card,
                    border: `1px solid ${chart.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill={chart.teal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title={t("admin.charts.monthlyComparison")}
          hint={t("admin.charts.stakesVsPrizes6m")}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={chart.mutedForeground} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke={chart.mutedForeground}
                  tickFormatter={(v) => `${(v / 1000) | 0}k`}
                  width={40}
                />
                <RTooltip
                  contentStyle={{
                    background: chart.card,
                    border: `1px solid ${chart.border}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => `${formatFcfa(v)} FCFA`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="mises"
                  name={t("admin.charts.stakes")}
                  fill={chart.teal}
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="gains"
                  name={t("admin.charts.prizes")}
                  fill={chart.gold}
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>
    </>
  );
}
