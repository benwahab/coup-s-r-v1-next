import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, ArrowRight, Loader2, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { analyzePmu, analyzeLoto } from "@/lib/ai-pronos.functions";
import { cn } from "@/lib/utils";
import ogAsset from "@/assets/og-pronostics.jpg.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Pronostics — Coup Sûr" },
      { name: "description", content: "Pronostics PMU, Loto Balsa et Pari Foot par les experts de la Loterie Nationale du Niger." },
      { property: "og:title", content: "Pronostics — Coup Sûr" },
      { property: "og:description", content: "Conseils, tendances et suggestions pour mieux jouer." },
      { property: "og:image", content: OG },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Coup Sûr pronostics — analyse et étoiles" },
      { property: "og:url", content: "/pronostics" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/pronostics` }],
  }),
  component: Pronos,
});

function Pronos() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("predictions")} icon={<Sparkles className="h-5 w-5" />} subtitle="Tendances, conseils & suggestions" />
      <AiSection />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 lg:grid-cols-3">
        {/* Live-data cards */}
        <Card title="PMU" linkTo="/pmu" linkLabel="Parier PMU">
          <div className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            Les partants et cotes apparaîtront ici uniquement lorsqu'une course PMU réelle sera disponible.
          </div>
        </Card>

        <Card title="Loto Balsa" linkTo="/loto-balsa" linkLabel="Jouer Loto">
          <div className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            Les analyses statistiques seront disponibles après réception de résultats réels du Loto Balsa.
          </div>
        </Card>

        <Card title="Pari Foot" linkTo="/pari-foot" linkLabel="Parier Foot">
          <div className="rounded-xl bg-secondary/50 px-3 py-3 text-sm text-muted-foreground">
            Les analyses apparaîtront lorsque les fixtures et cotes du fournisseur réel seront disponibles.
          </div>
        </Card>

        <section className="lg:col-span-3">
          <h2 className="mb-3 font-display text-lg font-bold">{t("expertTips")}</h2>
          <div className="rounded-2xl border border-border bg-card-gradient p-4 shadow-soft text-sm text-muted-foreground">
            Aucun conseil éditorial publié pour le moment.
          </div>
        </section>
      </div>
    </>
  );
}

function Card({ title, children, linkTo, linkLabel }: { title: string; children: React.ReactNode; linkTo: "/pmu" | "/loto-balsa" | "/pari-foot"; linkLabel: string }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">{title}</h3>
        <Link to={linkTo} className="inline-flex items-center gap-1 text-xs font-bold text-primary">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

type PmuOut = { summary: string; horses: { number: number; name: string; score: number; strength: string; weakness: string }[]; recommended: { tierce: number[]; quinte: number[]; rationale: string } };
type LotoOut = { summary: string; hot: number[]; cold: number[]; rotation: string; suggestions: { balls: number[]; rationale: string }[] };

function AiSection() {
  const { t } = useI18n();
  const runPmu = useServerFn(analyzePmu);
  const runLoto = useServerFn(analyzeLoto);
  const [horses, setHorses] = useState<{ number: number; name: string; jockey: string }[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      const today = new Date().toISOString().slice(0, 10);
      const { data: races } = await supabase.from("pmu_races").select("id").eq("race_date", today).in("status", ["scheduled", "open"]).order("start_at").limit(1);
      if (races?.[0]) {
        const { data } = await supabase.from("pmu_horses").select("number,name,jockey").eq("race_id", races[0].id).eq("status", "partant").order("number");
        setHorses((data ?? []) as typeof horses);
      } else setHorses([]);
      const { data: draws } = await supabase.from("draw_results").select("result").eq("game_id", "loto").eq("status", "published").order("draw_date", { ascending: false }).limit(8);
      const parsed = (draws ?? []).map((d) => {
        const r = d.result as Record<string, unknown>;
        const nums = Array.isArray(r?.numbers) ? r.numbers.filter((n): n is number => typeof n === "number") : [];
        return nums;
      }).filter((n) => n.length > 0);
      setHistory(parsed);
      setLoadingData(false);
    };
    void load();
  }, []);
  const [pmu, setPmu] = useState<PmuOut | null>(null);
  const [loto, setLoto] = useState<LotoOut | null>(null);
  const [loadingPmu, setLoadingPmu] = useState(false);
  const [loadingLoto, setLoadingLoto] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const doPmu = async () => {
    setLoadingPmu(true); setErr(null);
    try {
      if (horses.length === 0) throw new Error("Aucune course PMU réelle disponible.");
      const r = await runPmu({ data: { horses } });
      setPmu(r as PmuOut);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoadingPmu(false); }
  };

  const doLoto = async () => {
    setLoadingLoto(true); setErr(null);
    try {
      if (history.length === 0) throw new Error("Aucun tirage Loto Balsa réel disponible.");
      const counts = new Map<number, number>();
      for (const draw of history) for (const n of draw) counts.set(n, (counts.get(n) ?? 0) + 1);
      const hotSeed = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n);
      const r = await runLoto({ data: { history, hotSeed } });
      setLoto(r as LotoOut);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoadingLoto(false); }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pt-4">
      <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/15 via-card to-card p-5 shadow-gold">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold-gradient text-[var(--gold-foreground)]"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-xl font-extrabold">{t("aiPronos")}</h2>
              <p className="text-xs text-muted-foreground">{t("aiNote")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={doPmu} disabled={loadingPmu || loadingData || horses.length === 0} className={cn("inline-flex items-center gap-2 rounded-full bg-gold-gradient px-4 py-2 text-sm font-bold text-[var(--gold-foreground)] shadow-gold disabled:opacity-60")}>
              {loadingPmu ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} PMU
            </button>
            <button onClick={doLoto} disabled={loadingLoto || loadingData || history.length === 0} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-green disabled:opacity-60">
              {loadingLoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Loto
            </button>
          </div>
        </div>

        {err && <p className="mt-3 rounded-xl bg-destructive/15 px-3 py-2 text-sm text-destructive">{err}</p>}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <h3 className="font-display text-base font-bold">{t("aiPmuTitle")}</h3>
            {!pmu && !loadingPmu && <p className="mt-2 text-sm text-muted-foreground">Cliquez « PMU » pour générer une analyse IA des chevaux du jour.</p>}
            {loadingPmu && <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("aiThinking")}</p>}
            {pmu && (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">{pmu.summary}</p>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gold">Tiercé</div>
                  <div className="mt-1 flex gap-1.5">{pmu.recommended.tierce.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-gold">Quinté</div>
                  <div className="mt-1 flex gap-1.5">{pmu.recommended.quinte.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}</div>
                </div>
                <p className="text-xs italic text-muted-foreground">{pmu.recommended.rationale}</p>
                <details className="rounded-xl border border-border bg-card p-2">
                  <summary className="cursor-pointer text-xs font-bold">Score par cheval</summary>
                  <ul className="mt-2 space-y-1.5">
                    {pmu.horses.slice(0, 12).map((h) => (
                      <li key={h.number} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="number-ball number-ball-sm">{h.number}</span>
                        <span className="font-semibold">{h.name}</span>
                        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 font-bold text-primary tabular-nums">{h.score}/100</span>
                        <span className="basis-full pl-9 text-muted-foreground">+ {h.strength} · − {h.weakness}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <h3 className="font-display text-base font-bold">{t("aiLotoTitle")}</h3>
            {!loto && !loadingLoto && <p className="mt-2 text-sm text-muted-foreground">Cliquez « Loto » pour analyser la rotation des boules.</p>}
            {loadingLoto && <p className="mt-2 text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("aiThinking")}</p>}
            {loto && (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">{loto.summary}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-gold">Chaudes</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{loto.hot.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Froides</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{loto.cold.map((n) => <span key={n} className="number-ball-empty">{n}</span>)}</div>
                  </div>
                </div>
                <p className="text-xs italic text-muted-foreground">{loto.rotation}</p>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1">Grilles suggérées</div>
                  <ul className="space-y-2">
                    {loto.suggestions.map((s, i) => (
                      <li key={i} className="rounded-xl bg-card p-2">
                        <div className="flex flex-wrap gap-1.5">{s.balls.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{s.rationale}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}