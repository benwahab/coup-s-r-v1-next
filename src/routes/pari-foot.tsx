import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Goal } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { footMatches } from "@/lib/mock-data";
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

  const select = (id: string, o: Outcome) => setPicks((p) => ({ ...p, [id]: o }));

  const list = Object.entries(picks);
  const picksLabel = list.length
    ? list.map(([id, o]) => {
        const m = footMatches.find((x) => x.id === id)!;
        return `${m.home} v ${m.away}: ${o}`;
      }).join(" • ")
    : "—";

  return (
    <>
      <PageHeader title="Pari Foot" subtitle={t("selectMatches")} icon={<Goal className="h-5 w-5" />} />
      <BetFlow
        gameId="foot"
        gameName="Pari Foot"
        drawDate={new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString()}
        selection={list.map(([id, o]) => `${id}:${o}`)}
        picksLabel={picksLabel}
        canContinue={list.length >= 1}
        renderSelection={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectMatches")}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums">
                {list.length} {t("picks")}
              </span>
            </div>
            <ul className="space-y-3">
              {footMatches.map((m) => {
                const sel = picks[m.id];
                return (
                  <li key={m.id} className="rounded-2xl border border-border bg-card p-3 shadow-soft">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
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