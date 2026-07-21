import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Crown, Flame, Snowflake, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { coldNumbers, footMatches, hotNumbers, recentResults } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import ogAsset from "@/assets/og-resultats.jpg.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

export const Route = createFileRoute("/resultats")({
  head: () => ({
    meta: [
      { title: "Résultats — Coup Sûr" },
      { name: "description", content: "Résultats officiels du PMU, Loto Balsa et Pari Foot de la Loterie Nationale du Niger." },
      { property: "og:title", content: "Résultats officiels — Coup Sûr" },
      { property: "og:description", content: "Numéros gagnants, arrivées PMU et résultats foot." },
      { property: "og:image", content: OG },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Coup Sûr résultats — tableau lumineux" },
      { property: "og:url", content: "/resultats" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/resultats` }],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { t } = useI18n();
  const loto = recentResults.filter((r) => r.gameId === "loto").slice(0, 7);
  const pmu = recentResults.filter((r) => r.gameId === "pmu").slice(0, 7);
  const foot = recentResults.filter((r) => r.gameId === "foot").slice(0, 7);
  const [lastLoto, ...prevLoto] = loto;
  const [lastPmu, ...prevPmu] = pmu;
  const [lastFoot, ...prevFoot] = foot;

  return (
    <>
      <PageHeader title={t("results")} icon={<Trophy className="h-5 w-5" />} subtitle={t("last7days")} />
      <div className="mx-auto max-w-6xl px-4 py-4 space-y-8">
        {/* Loto Balsa */}
        <GameBlock title="Loto Balsa" subtitle={t("lotoWeekly")}>
          <Latest date={lastLoto?.date}>
            {lastLoto?.numbers && (
              <div className="flex flex-wrap gap-2">
                {lastLoto.numbers.map((n) => <span key={n} className="number-ball">{n}</span>)}
              </div>
            )}
          </Latest>
          <History>
            {prevLoto.map((r) => (
              <HistoryRow key={r.id} date={r.date}>
                <div className="flex flex-wrap gap-1.5">
                  {r.numbers!.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}
                </div>
              </HistoryRow>
            ))}
          </History>
          <StatsCard />
        </GameBlock>

        {/* PMU */}
        <GameBlock title="PMU" subtitle={t("pmuDaily")}>
          <Latest date={lastPmu?.date}>
            {lastPmu?.horses && (
              <div className="flex flex-wrap items-center gap-2">
                {lastPmu.horses.map((h, i) => (
                  <span key={h} className="inline-flex items-center gap-1.5">
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
                    <span className="number-ball">{h}</span>
                  </span>
                ))}
              </div>
            )}
          </Latest>
          <History>
            {prevPmu.map((r) => (
              <HistoryRow key={r.id} date={r.date}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r.horses!.map((h, i) => (
                    <span key={h} className="inline-flex items-center gap-1">
                      <span className="text-[10px] font-bold text-muted-foreground">{i + 1}.</span>
                      <span className="number-ball number-ball-sm">{h}</span>
                    </span>
                  ))}
                </div>
              </HistoryRow>
            ))}
          </History>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> {t("browse.bestHorses")}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[3, 7, 1, 10].map((n, i) => (
                <li key={n} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
                  <span>{t("browse.horseNo", { n })}</span>
                  <span className="font-mono text-xs text-primary">{t("browse.podiums", { count: 4 - i })}</span>
                </li>
              ))}
            </ul>
          </div>
        </GameBlock>

        {/* Foot */}
        <GameBlock title="Pari Foot" subtitle={t("browse.weekend")}>
          <Latest date={lastFoot?.date}>
            {lastFoot?.matches && (
              <ul className="space-y-1.5 text-sm">
                {lastFoot.matches.map((m) => {
                  const match = footMatches.find((x) => x.id === m.matchId);
                  return (
                    <li key={m.matchId} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                      <span className="min-w-0 truncate">{match ? `${match.home} – ${match.away}` : m.matchId}</span>
                      <span className="font-display font-bold text-primary">{m.result}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Latest>
          <History>
            {prevFoot.map((r) => (
              <HistoryRow key={r.id} date={r.date}>
                <div className="flex flex-wrap gap-1.5">
                  {r.matches!.map((m) => (
                    <span key={m.matchId} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold">
                      <span className="text-muted-foreground">{m.matchId}</span> <span className="text-primary">{m.result}</span>
                    </span>
                  ))}
                </div>
              </HistoryRow>
            ))}
          </History>
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("trends")}</div>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>• {t("browse.trendGoals")}</li>
              <li>• {t("browse.trendSahel")}</li>
              <li>• {t("browse.trendDraw")}</li>
            </ul>
          </div>
        </GameBlock>
      </div>
    </>
  );
}

function GameBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{subtitle}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
        {children}
      </div>
    </section>
  );
}

function Latest({ date, children }: { date?: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/10 via-card to-card p-5 shadow-gold">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gold">
        <Crown className="h-3.5 w-3.5" /> {t("browse.lastDraw")}
        {date && <span className="ml-auto tabular-nums text-muted-foreground">{formatDate(date)}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function History({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("last7days")}</div>
      <ul className="divide-y divide-border">{children}</ul>
    </div>
  );
}

function HistoryRow({ date, children }: { date: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="shrink-0 text-[11px] font-mono tabular-nums text-muted-foreground">{formatDate(date)}</span>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </li>
  );
}

function StatsCard() {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Flame className="h-3.5 w-3.5 text-gold" /> {t("hotNumbers")}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hotNumbers.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Snowflake className="h-3.5 w-3.5 text-teal" /> {t("coldNumbers")}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {coldNumbers.map((n) => <span key={n} className="number-ball-empty">{n}</span>)}
      </div>
    </div>
  );
}
