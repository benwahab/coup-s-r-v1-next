import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Crown, Flame, Snowflake } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
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
  const [rows, setRows] = useState<DrawResultRow[]>([]);
  const [footFixtures, setFootFixtures] = useState<FootFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    const [{ data: results, error: resultsError }, { data: fixtures, error: fixturesError }] = await Promise.all([
      supabase.from("draw_results").select("id,game_id,draw_date,draw_name,result").eq("status", "published").order("draw_date", { ascending: false }).limit(30),
      supabase.from("foot_fixtures").select("id,home_team,away_team").order("kickoff_at", { ascending: false }).limit(100),
    ]);
    if (resultsError || fixturesError) {
      setError(true);
      setRows([]);
      setFootFixtures([]);
    } else {
      setRows((results ?? []) as DrawResultRow[]);
      setFootFixtures((fixtures ?? []) as FootFixture[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const loto = rows.filter((r) => r.game_id === "loto").slice(0, 7);
  const pmu = rows.filter((r) => r.game_id === "pmu").slice(0, 7);
  const foot = rows.filter((r) => r.game_id === "foot").slice(0, 7);
  const [lastLoto, ...prevLoto] = loto;
  const [lastPmu, ...prevPmu] = pmu;
  const [lastFoot, ...prevFoot] = foot;

  const numberCounts = new Map<number, number>();
  for (const row of loto) {
    const numbers = Array.isArray(row.result?.numbers) ? row.result.numbers : [];
    for (const value of numbers) {
      if (typeof value === "number") numberCounts.set(value, (numberCounts.get(value) ?? 0) + 1);
    }
  }
  const orderedNumbers = [...numberCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const hot = orderedNumbers.slice(0, 6).map(([n]) => n);
  const cold = Array.from({ length: 90 }, (_, i) => i + 1)
    .filter((n) => !numberCounts.has(n))
    .slice(0, 6);

  const renderNumbers = (row?: DrawResultRow) => {
    const numbers = Array.isArray(row?.result?.numbers) ? row.result.numbers : [];
    return <div className="flex flex-wrap gap-2">{numbers.map((n) => <span key={n} className="number-ball">{String(n)}</span>)}</div>;
  };

  const renderHorses = (row?: DrawResultRow) => {
    const horses = Array.isArray(row?.result?.horses) ? row.result.horses : [];
    return <div className="flex flex-wrap items-center gap-2">{horses.map((h, i) => (
      <span key={`${h}-${i}`} className="inline-flex items-center gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
        <span className="number-ball">{String(h)}</span>
      </span>
    ))}</div>;
  };

  const renderFoot = (row?: DrawResultRow) => {
    const matches = Array.isArray(row?.result?.matches) ? row.result.matches : [];
    return <ul className="space-y-1.5 text-sm">{matches.map((m, i) => {
      const id = typeof m?.matchId === "string" ? m.matchId : typeof m?.fixtureId === "string" ? m.fixtureId : "";
      const fixture = footFixtures.find((f) => f.id === id);
      const result = typeof m?.result === "string" ? m.result : "—";
      return <li key={`${id}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
        <span className="min-w-0 truncate">{fixture ? `${fixture.home_team} – ${fixture.away_team}` : id || "Match"}</span>
        <span className="font-display font-bold text-primary">{result}</span>
      </li>;
    })}</ul>;
  };

  return (
    <>
      <PageHeader title={t("results")} icon={<Trophy className="h-5 w-5" />} subtitle={t("last7days")} />
      <div className="mx-auto max-w-6xl px-4 py-4 space-y-8">
        {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{t("account.loadTicketsError")} <button onClick={() => void load()} className="ml-2 font-bold underline">{t("account.retry")}</button></div>}
        {loading ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{t("account.loadingTickets")}</div>
        ) : (
          <>
            <GameBlock title="Loto Balsa" subtitle={t("lotoWeekly")}>
              <Latest date={lastLoto?.draw_date}>{renderNumbers(lastLoto)}</Latest>
              <History>{prevLoto.map((r) => <HistoryRow key={r.id} date={r.draw_date}>{renderNumbers(r)}</HistoryRow>)}</History>
              <StatsCard hot={hot} cold={cold} />
            </GameBlock>

            <GameBlock title="PMU" subtitle={t("pmuDaily")}>
              <Latest date={lastPmu?.draw_date}>{renderHorses(lastPmu)}</Latest>
              <History>{prevPmu.map((r) => <HistoryRow key={r.id} date={r.draw_date}>{renderHorses(r)}</HistoryRow>)}</History>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm text-muted-foreground">
                {lastPmu?.draw_name ?? "Résultat PMU officiel"}
              </div>
            </GameBlock>

            <GameBlock title="Pari Foot" subtitle={t("browse.weekend")}>
              <Latest date={lastFoot?.draw_date}>{renderFoot(lastFoot)}</Latest>
              <History>{prevFoot.map((r) => <HistoryRow key={r.id} date={r.draw_date}>{renderFoot(r)}</HistoryRow>)}</History>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft text-sm text-muted-foreground">
                {lastFoot?.draw_name ?? "Résultats football officiels"}
              </div>
            </GameBlock>
          </>
        )}
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

type DrawResultRow = { id: string; game_id: string; draw_date: string; draw_name: string | null; result: { numbers?: unknown; horses?: unknown; matches?: unknown } };
type FootFixture = { id: string; home_team: string; away_team: string };

function StatsCard({ hot, cold }: { hot: number[]; cold: number[] }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Flame className="h-3.5 w-3.5 text-gold" /> {t("hotNumbers")}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {hot.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Snowflake className="h-3.5 w-3.5 text-teal" /> {t("coldNumbers")}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {cold.map((n) => <span key={n} className="number-ball-empty">{n}</span>)}
      </div>
    </div>
  );
}
