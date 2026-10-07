import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowRight, Loader2, Brain, Goal } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { generateAdaptivePmu, generateAdaptiveLoto, generateAdaptiveFoot } from "@/lib/ai-adaptive.functions";
import { cn } from "@/lib/utils";
import { nigerParts } from "@/lib/schedule";
import ogAsset from "@/assets/og-pronostics.jpg.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Pronostics — Coup Sûr" },
      { name: "description", content: "Pronostics et tendances calculés à partir des données réelles disponibles." },
      { property: "og:title", content: "Pronostics — Coup Sûr" },
      { property: "og:description", content: "Analyses statistiques adaptatives et tendances." },
      { property: "og:image", content: OG },
      { property: "og:url", content: "/pronostics" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: SITE_ORIGIN + "/pronostics" }],
  }),
  component: Pronos,
});

type PmuPrediction = {
  summary: string;
  tierce: number[];
  quinte: number[];
  confidence: string;
  rationale: string;
};

type LotoPrediction = {
  summary: string;
  hot: number[];
  cold: number[];
  rotation: string;
  suggestions: Array<{ balls: number[]; rationale: string }>;
};

type FootPrediction = {
  outcome: "1" | "X" | "2";
  probabilities: { home: number; draw: number; away: number };
  confidence: string;
  summary: string;
  keyFactors: string[];
};

function Pronos() {
  const { t } = useI18n();
  const { authed } = useAuth();
  const runPmu = useServerFn(generateAdaptivePmu);
  const runLoto = useServerFn(generateAdaptiveLoto);
  const runFoot = useServerFn(generateAdaptiveFoot);

  const [raceId, setRaceId] = useState<string | null>(null);
  const [drawDate, setDrawDate] = useState(() => {
    const p = nigerParts();
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  });
  const [footMatches, setFootMatches] = useState<Array<{ id: string; league: string; home: string; away: string; kickoff: string }>>([]);
  const [pmu, setPmu] = useState<PmuPrediction | null>(null);
  const [loto, setLoto] = useState<LotoPrediction | null>(null);
  const [foot, setFoot] = useState<Record<string, FootPrediction | "loading" | "error">>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const todayParts = nigerParts();
      const today = `${todayParts.year}-${String(todayParts.month).padStart(2, "0")}-${String(todayParts.day).padStart(2, "0")}`;
      setDrawDate(today);
      const [{ data: races }, { data: fixtures }] = await Promise.all([
        supabase.from("pmu_races").select("id").eq("race_date", today).in("status", ["scheduled", "open"]).order("start_at").limit(1),
        supabase.from("foot_fixtures").select("id,league_name,home_team,away_team,kickoff_at").eq("status", "scheduled").gte("kickoff_at", new Date().toISOString()).order("kickoff_at").limit(6),
      ]);
      setRaceId(races?.[0]?.id ?? null);
      setFootMatches((fixtures ?? []).map((x) => ({ id: x.id, league: x.league_name, home: x.home_team, away: x.away_team, kickoff: x.kickoff_at })));
      setLoading(false);
    };
    void load();
  }, []);

  const doPmu = async () => {
    if (!raceId) return;
    setBusy("pmu"); setError(null);
    try { setPmu((await runPmu({data:{raceId}})).prediction); } catch(e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const doLoto = async () => {
    setBusy("loto"); setError(null);
    try { setLoto((await runLoto({data:{drawDate}})).prediction); } catch(e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const doFoot = async (id:string) => {
    if (foot[id] && foot[id] !== "error") return;
    setFoot((s) => ({ ...s, [id]: "loading" }));
    setError(null);
    try {
      const r = await runFoot({ data: { fixtureId: id } });
      setFoot((s) => ({ ...s, [id]: r.prediction }));
    } catch {
      setFoot((s) => ({ ...s, [id]: "error" }));
    }
  };

  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <>
      <PageHeader title={t("predictions")} icon={<Sparkles className="h-5 w-5" />} subtitle="Analyses adaptatives, tendances et données réelles" />
      <section className="mx-auto max-w-6xl px-4 pt-4">
        <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/15 via-card to-card p-5 shadow-gold">
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-gradient text-[var(--gold-foreground)]"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-xl font-extrabold">{t("aiPronos")}</h2>
              <p className="text-xs text-muted-foreground">{t("pronos.description")}</p>
            </div>
          </div>
          {error && <p className="mt-3 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-border bg-background/40 p-4">
              {!authed && <p className="mb-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">{t("shell.login")}</p>}
              <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">PMU</h3><button disabled={!authed || !raceId || !!busy} onClick={()=>void doPmu()} className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-3 py-1.5 text-xs font-bold disabled:opacity-50">{busy==="pmu"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Sparkles className="h-3.5 w-3.5"/>} Analyser</button></div>
              {!raceId && <p className="mt-2 text-sm text-muted-foreground">{t("pronos.noPmuRace")}</p>}
              {pmu && <div className="mt-3 space-y-3 text-sm"><p className="text-muted-foreground">{pmu.summary}</p><div><b>{t("pronos.tierce")}</b> {pmu.tierce.join(" · ")}</div><div><b>{t("pronos.quinte")}</b> {pmu.quinte.join(" · ")}</div><p className="text-xs text-muted-foreground">{t("pronos.confidence", { confidence: pmu.confidence, rationale: pmu.rationale })}</p></div>}
            </section>
            <section className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">Loto Balsa</h3><button disabled={!authed || !!busy || loading} onClick={()=>void doLoto()} className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50">{busy==="loto"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Sparkles className="h-3.5 w-3.5"/>} Analyser</button></div>
              {loto && <div className="mt-3 space-y-3 text-sm"><p className="text-muted-foreground">{loto.summary}</p><div><b>{t("pronos.hot")}</b> {loto.hot.join(" · ")}</div><div><b>{t("pronos.cold")}</b> {loto.cold.join(" · ")}</div><div className="space-y-1"><b>{t("pronos.suggestions")}</b>{loto.suggestions.map((s, i)=><div key={i} className="rounded-lg bg-card px-2 py-1.5">{s.balls.join(" · ")} <span className="text-xs text-muted-foreground">— {s.rationale}</span></div>)}</div></div>}
            </section>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-5">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="font-display text-lg font-bold">{t("pronos.footTrends")}</h2><p className="text-xs text-muted-foreground">{t("pronos.footDesc")}</p></div><Link to="/pari-foot" className="inline-flex items-center gap-1 text-xs font-bold text-primary">{t("pronos.viewMatches")} <ArrowRight className="h-3.5 w-3.5"/></Link></div>
        {loading ? <div className="rounded-2xl border border-border p-5 text-center text-sm text-muted-foreground">{t("pronos.loadingMatches")}</div> :
        footMatches.length===0 ? <div className="rounded-2xl border border-border p-5 text-center text-sm text-muted-foreground">{t("pronos.noMatches")}</div> :
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{footMatches.map(m=><article key={m.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{m.league}</div><div className="mt-2 font-display font-bold">{m.home} <span className="text-muted-foreground">{t("pronos.vs")}</span> {m.away}</div>{foot[m.id] && foot[m.id]!=="loading" && foot[m.id]!=="error" ? <div className="mt-3 space-y-2 text-xs"><div className="grid grid-cols-3 gap-1"><span className={cn("rounded-lg bg-secondary p-2 text-center",(foot[m.id] as FootPrediction).outcome==="1"&&"ring-2 ring-primary")}>1 {pct((foot[m.id] as FootPrediction).probabilities.home)}</span><span className={cn("rounded-lg bg-secondary p-2 text-center",(foot[m.id] as FootPrediction).outcome==="X"&&"ring-2 ring-primary")}>X {pct((foot[m.id] as FootPrediction).probabilities.draw)}</span><span className={cn("rounded-lg bg-secondary p-2 text-center",(foot[m.id] as FootPrediction).outcome==="2"&&"ring-2 ring-primary")}>2 {pct((foot[m.id] as FootPrediction).probabilities.away)}</span></div><p className="text-muted-foreground">{(foot[m.id] as FootPrediction).summary}</p><p className="font-semibold">{t("pronos.trend", { outcome: (foot[m.id] as FootPrediction).outcome, confidence: (foot[m.id] as FootPrediction).confidence })}</p></div> : <button onClick={()=>void doFoot(m.id)} disabled={foot[m.id]==="loading"} className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50">{foot[m.id]==="loading"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Goal className="h-3.5 w-3.5"/>} Analyser la tendance</button>}</article>)}</div>}
      </section>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-center text-[11px] text-muted-foreground">{t("pronos.disclaimer")}</div>
    </>
  );
}
