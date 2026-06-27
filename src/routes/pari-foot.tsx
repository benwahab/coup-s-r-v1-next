import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Goal, Trophy, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { footMatches, leagues } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pari-foot")({
  head: () => ({
    meta: [
      { title: "Pari Foot — Pronostics matchs | LoNaNi" },
      { name: "description", content: "Pronostiquez les matchs de foot et pariez en ligne au Niger avec paiement mobile." },
      { property: "og:title", content: "Pari Foot — LoNaNi" },
      { property: "og:description", content: "1, X ou 2 — choisissez vos pronostics." },
    ],
  }),
  component: FootPage,
});

type Outcome = "1" | "X" | "2";

function FootPage() {
  const { t } = useI18n();
  const [picks, setPicks] = useState<Record<string, Outcome>>({});
  const [league, setLeague] = useState<string>("all");

  const select = (id: string, o: Outcome) => setPicks((p) => ({ ...p, [id]: o }));
  const removePick = (id: string) => setPicks((p) => { const { [id]: _, ...rest } = p; return rest; });

  const list = Object.entries(picks);
  const picksLabel = list.length
    ? list.map(([id, o]) => {
        const m = footMatches.find((x) => x.id === id)!;
        return `${m.home} v ${m.away}: ${o}`;
      }).join(" • ")
    : "—";

  const totalOdds = useMemo(
    () => list.reduce((acc, [id, o]) => acc * (footMatches.find((m) => m.id === id)?.odds[o] ?? 1), 1),
    [list],
  );

  const visibleMatches = league === "all" ? footMatches : footMatches.filter((m) => m.league === league);

  // Compétitions avec compteur de matchs
  const leagueTabs = [{ id: "all", name: "Tout", country: "🌐", count: footMatches.length }, ...leagues.map((l) => ({ ...l, count: footMatches.filter((m) => m.league === l.id).length }))];

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
        selection={list.map(([id, o]) => `${id}:${o}`)}
        picksLabel={`${picksLabel} | Cote totale ×${totalOdds.toFixed(2)}`}
        canContinue={list.length >= 1}
        gameOpen={isGameOpen(8, 22)}
        openHour={8}
        renderSelection={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectMatches")}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums">
                {list.length} {t("picks")}
              </span>
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
                  {list.map(([id, o]) => {
                    const m = footMatches.find((x) => x.id === id)!;
                    return (
                      <li key={id} className="flex items-center justify-between gap-2 rounded-lg bg-background/40 px-2.5 py-1.5 text-xs">
                        <span className="truncate"><span className="font-bold text-primary mr-1">{o}</span>{m.home} – {m.away}</span>
                        <span className="tabular-nums font-bold">{m.odds[o].toFixed(2)}</span>
                        <button onClick={() => removePick(id)} className="text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <ul className="space-y-3">
              {visibleMatches.map((m) => {
                const sel = picks[m.id];
                const lg = leagues.find((l) => l.id === m.league);
                return (
                  <li key={m.id} className="rounded-2xl border border-border bg-card p-3 shadow-soft">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">{lg?.country} <span className="font-semibold">{lg?.name}</span></span>
                      <span>{m.date}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-bold">{m.home}</span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="min-w-0 truncate font-bold text-right">{m.away}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(["1", "X", "2"] as Outcome[]).map((o) => {
                        const active = sel === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={() => select(m.id, o)}
                            className={cn(
                              "rounded-xl border-2 px-3 py-3 text-center font-display font-bold transition",
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