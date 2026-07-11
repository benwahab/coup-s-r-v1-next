import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Goal, Trophy, X, ChevronDown, ChevronUp, Lock, Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { useFootFixtures } from "@/lib/foot-fixtures";
import { analyzeFootMatch, type FootAnalysis } from "@/lib/ai-foot.functions";
import { marketsForMatch, oddForPick, labelForPick } from "@/lib/foot-markets";
import { cn } from "@/lib/utils";
import { z } from "zod";
import ogAsset from "@/assets/og-foot.jpg.asset.json";
import { absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

/** Petites icônes par championnat suivi (purement cosmétique). */
const LEAGUE_FLAGS: Record<string, string> = {
  "Coupe du Monde FIFA": "🌍",
  "Ligue 1": "🇫🇷",
  "Premier League": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "La Liga": "🇪🇸",
  "Serie A": "🇮🇹",
  "UEFA Champions League": "🏆",
};

/** Validation client des paris foot : au moins 1 sélection, format `matchId:market:option`. */
const PickKeySchema = z.string().regex(/^[^:]+:[^:]+:[^:]+$/, "Format de sélection invalide.");
const FootBetSchema = z.object({
  picks: z.array(PickKeySchema).min(1, "Sélectionnez au moins 1 pronostic pour continuer."),
  mode: z.enum(["combi", "simple"]),
});

export const Route = createFileRoute("/pari-foot")({
  head: () => ({
    meta: [
      { title: "Pari Foot — Pronostics matchs | Coup Sûr" },
      { name: "description", content: "Pronostiquez les matchs de foot et pariez en ligne au Niger avec paiement mobile." },
      { property: "og:title", content: "Pari Foot — Coup Sûr" },
      { property: "og:description", content: "1, X ou 2 — choisissez vos pronostics." },
      { property: "og:image", content: OG },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Coup Sûr Pari Foot — ballon et stade" },
      { property: "og:url", content: "/pari-foot" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: "/pari-foot" }],
  }),
  component: FootPage,
});

function FootPage() {
  const { t } = useI18n();
  const { matches, pickedFixtureIds, loading } = useFootFixtures();
  // clé pick = "matchId:marketId:optionKey" (permet marchés multiples par match)
  const [picks, setPicks] = useState<Record<string, true>>({});
  const [league, setLeague] = useState<string>("all");
  const [openMatch, setOpenMatch] = useState<string | null>(null);
  const [mode, setMode] = useState<"combi" | "simple">("combi");
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, FootAnalysis | "loading" | "error">>({});

  const loadAnalysis = async (fixtureId: string) => {
    if (aiAnalyses[fixtureId] && aiAnalyses[fixtureId] !== "error") return;
    setAiAnalyses((s) => ({ ...s, [fixtureId]: "loading" }));
    try {
      const res = await analyzeFootMatch({ data: { fixtureId } });
      setAiAnalyses((s) => ({ ...s, [fixtureId]: res.analysis }));
    } catch {
      setAiAnalyses((s) => ({ ...s, [fixtureId]: "error" }));
    }
  };

  const togglePick = (matchId: string, key: string) => {
    if (pickedFixtureIds.has(matchId)) return; // déjà parié sur ce match, pour toujours
    setPicks((p) => {
      if (p[key]) { const { [key]: _, ...rest } = p; return rest; }
      return { ...p, [key]: true };
    });
  };
  const removePick = (key: string) => setPicks((p) => { const { [key]: _, ...rest } = p; return rest; });

  const list = Object.keys(picks);
  const validation = FootBetSchema.safeParse({ picks: list, mode });
  const validationError = validation.success ? null : validation.error.issues[0]?.message ?? null;
  const picksLabel = list.length
    ? list.map((k) => {
        const [mid] = k.split(":");
        const m = matches.find((x) => x.id === mid);
        return m ? labelForPick(k, m) : k;
      }).join(" • ")
    : "—";

  const totalOdds = useMemo(
    () => mode === "combi"
      ? list.reduce((acc, k) => {
          const [mid] = k.split(":");
          const m = matches.find((x) => x.id === mid);
          return acc * (m ? oddForPick(k, m) : 1);
        }, 1)
      : 1,
    [list, mode, matches],
  );

  const visibleMatches = league === "all" ? matches : matches.filter((m) => m.league === league);

  // Compétitions avec compteur de matchs, dérivées des championnats réellement synchronisés.
  const distinctLeagues = Array.from(new Set(matches.map((m) => m.league)));
  const leagueTabs = [
    { id: "all", name: t("game.all"), country: "🌐", count: matches.length },
    ...distinctLeagues.map((name) => ({ id: name, name, country: LEAGUE_FLAGS[name] ?? "🏆", count: matches.filter((m) => m.league === name).length })),
  ];

  return (
    <>
      <PageHeader title="Pari Foot" subtitle={t("selectMatches")} icon={<Goal className="h-5 w-5" />} />

      {/* Tabs Compétitions */}
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {leagueTabs.map((l) => {
            const active = league === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLeague(l.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition whitespace-nowrap",
                  active ? "border-primary bg-primary/15 text-primary shadow-green" : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{l.country}</span> {l.name}
                <span className={cn("ml-1 rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-primary/20" : "bg-muted")}>{l.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <BetFlow
        gameId="foot"
        gameName="Pari Foot"
        drawDate={new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString()}
        selection={list}
        picksLabel={`[${mode === "combi" ? t("game.combined") : t("game.simple")}] ${picksLabel} | ${t("odds")} ×${totalOdds.toFixed(2)}`}
        canContinue={validation.success}
        gameOpen={true}
        openHour={0}
        odds={totalOdds}
        renderSelection={
          <div>
            {validationError && list.length === 0 && (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                {validationError}
              </div>
            )}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectMatches")}</h2>
              <div className="flex items-center gap-1.5">
                <div className="flex rounded-full border border-border bg-card p-0.5">
                  {(["combi", "simple"] as const).map((mo) => (
                    <button key={mo} onClick={() => setMode(mo)} className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition",
                      mode === mo ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                    )}>{mo === "combi" ? t("game.combined") : t("game.simple")}</button>
                  ))}
                </div>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums">
                  {list.length} {list.length > 1 ? t("game.betsPlural") : t("game.betSingular")}
                </span>
              </div>
            </div>

            {/* Bet slip */}
            {list.length > 0 && (
              <div className="mb-4 rounded-2xl border border-gold/40 bg-gold/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold">
                    <Trophy className="h-3.5 w-3.5" /> {t("betSlip")} ({list.length})
                  </span>
                  <span className="font-display text-base font-extrabold text-gold tabular-nums">
                    {t("totalOdds")} ×{totalOdds.toFixed(2)}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((k) => {
                    const [mid] = k.split(":");
                    const m = matches.find((x) => x.id === mid);
                    if (!m) return null;
                    const odd = oddForPick(k, m);
                    return (
                      <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2.5 py-1.5 text-xs">
                        <span className="truncate">{labelForPick(k, m)}</span>
                        <span className="tabular-nums font-bold">{odd.toFixed(2)}</span>
                        <button onClick={() => removePick(k)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {loading && matches.length === 0 && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />)}
              </div>
            )}
            {!loading && visibleMatches.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                Aucun match disponible pour le moment. Revenez un peu plus tard.
              </div>
            )}
            <ul className="space-y-3">
              {visibleMatches.map((m) => {
                const isOpen = openMatch === m.id;
                const alreadyPicked = pickedFixtureIds.has(m.id);
                const matchPicks = list.filter((k) => k.startsWith(m.id + ":")).length;
                const markets = marketsForMatch(m);
                return (
                  <li key={m.id} className={cn("rounded-2xl border border-border bg-card p-3 shadow-soft", alreadyPicked && "opacity-60")}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">{LEAGUE_FLAGS[m.league] ?? "🏆"} <span className="font-semibold">{m.league}</span></span>
                      <span>{m.date}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-bold">{m.home}</span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="min-w-0 truncate font-bold text-right">{m.away}</span>
                    </div>
                    {alreadyPicked && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        <Lock className="h-3 w-3" /> Déjà parié sur ce match
                      </div>
                    )}
                    {/* 1X2 rapide toujours visible */}
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(["1", "X", "2"] as const).map((o) => {
                        const key = `${m.id}:1x2:${o}`;
                        const active = !!picks[key];
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={alreadyPicked}
                            onClick={() => togglePick(m.id, key)}
                            className={cn(
                              "rounded-xl border-2 px-3 py-3 text-center font-display font-bold transition",
                              alreadyPicked ? "cursor-not-allowed border-border bg-background/50" :
                              active
                                ? "border-primary bg-primary/10 text-primary shadow-soft"
                                : "border-border bg-background hover:border-primary/40",
                            )}
                          >
                            <div className="text-lg">{o}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                              {m.odds[o].toFixed(2)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Toggle marchés étendus */}
                    <button
                      type="button"
                      onClick={() => setOpenMatch(isOpen ? null : m.id)}
                      className="mt-3 flex w-full items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40"
                    >
                      <span className="inline-flex items-center gap-2">
                        {t("game.moreMarkets", { count: markets.length - 1 })}
                        {matchPicks > 1 && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] text-primary">{t("game.selections", { count: matchPicks })}</span>
                        )}
                      </span>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {isOpen && (
                      <div className="mt-3 space-y-3">
                        {markets.slice(1).map((mk) => (
                          <div key={mk.id}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-foreground">{mk.name}</span>
                              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{mk.group}</span>
                            </div>
                            <div className={cn(
                              "grid gap-1.5",
                              mk.options.length > 4 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4",
                            )}>
                              {mk.options.map((opt) => {
                                const key = `${m.id}:${mk.id}:${opt.key}`;
                                const active = !!picks[key];
                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    disabled={alreadyPicked}
                                    onClick={() => togglePick(m.id, key)}
                                    className={cn(
                                      "rounded-lg border-2 px-2 py-1.5 text-center text-[11px] transition",
                                      alreadyPicked ? "cursor-not-allowed border-border bg-background/50" :
                                      active
                                        ? "border-primary bg-primary/10 text-primary"
                                        : "border-border bg-background hover:border-primary/40",
                                    )}
                                  >
                                    <div className="font-semibold truncate leading-tight">{opt.label}</div>
                                    <div className="text-[10px] font-bold tabular-nums text-muted-foreground">{opt.odd.toFixed(2)}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Analyse IA */}
                    <div className="mt-2">
                      {!aiAnalyses[m.id] && (
                        <button
                          type="button"
                          onClick={() => loadAnalysis(m.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Voir l'analyse IA
                        </button>
                      )}
                      {aiAnalyses[m.id] === "loading" && (
                        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse en cours…
                        </div>
                      )}
                      {aiAnalyses[m.id] === "error" && (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
                          <span>Analyse indisponible pour l'instant.</span>
                          <button type="button" onClick={() => loadAnalysis(m.id)} className="underline">Réessayer</button>
                        </div>
                      )}
                      {aiAnalyses[m.id] && typeof aiAnalyses[m.id] === "object" && (() => {
                        const a = aiAnalyses[m.id] as FootAnalysis;
                        return (
                          <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                              <Sparkles className="h-3 w-3" /> Analyse IA
                            </div>
                            <p className="text-xs text-foreground">{a.summary}</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="font-bold">{m.home}</span> — {a.homeStrength}</div>
                              <div><span className="font-bold">{m.away}</span> — {a.awayStrength}</div>
                            </div>
                            <p className="text-[11px] text-muted-foreground">{a.headToHead}</p>
                            <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                              {a.keyFactors.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                            <div className="rounded-xl bg-card px-3 py-2 text-xs">
                              <span className="font-bold">Prédiction : {a.prediction.outcome}</span>{" "}
                              <span className="text-muted-foreground">(confiance {a.prediction.confidence})</span>
                              <p className="mt-0.5 text-muted-foreground">{a.prediction.rationale}</p>
                            </div>
                            <p className="text-[10px] italic text-muted-foreground">{a.dataLimitations}</p>
                          </div>
                        );
                      })()}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        }
      />
    </>
  );
}
