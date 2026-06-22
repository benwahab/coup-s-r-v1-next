import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loto-balsa")({
  head: () => ({
    meta: [
      { title: "Loto Balsa — LoNaNi" },
      { name: "description", content: "Choisissez vos numéros du Loto Balsa et jouez en ligne avec paiement mobile." },
      { property: "og:title", content: "Loto Balsa — Jouez en ligne" },
      { property: "og:description", content: "Sélectionnez 6 numéros sur 49 et tentez votre chance." },
    ],
  }),
  component: LotoPage,
});

const MAX_PICK = 6;
const RANGE = 49;

function LotoPage() {
  const { t } = useI18n();
  const [picks, setPicks] = useState<number[]>([]);

  const toggle = (n: number) =>
    setPicks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < MAX_PICK ? [...prev, n] : prev,
    );

  const sorted = [...picks].sort((a, b) => a - b);
  const picksLabel = sorted.length ? sorted.join(" · ") : "—";

  return (
    <>
      <PageHeader title="Loto Balsa" subtitle={t("selectNumbers")} icon={<Sparkles className="h-5 w-5" />} />
      <BetFlow
        gameId="loto"
        gameName="Loto Balsa"
        drawDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()}
        selection={sorted}
        picksLabel={picksLabel}
        canContinue={picks.length === MAX_PICK}
        renderSelection={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectNumbers")}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground tabular-nums">
                {picks.length}/{MAX_PICK}
              </span>
            </div>

            <div className="mb-4 flex min-h-[64px] flex-wrap gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 p-3">
              {Array.from({ length: MAX_PICK }).map((_, i) =>
                sorted[i] != null ? (
                  <span key={i} className="number-ball">{sorted[i]}</span>
                ) : (
                  <span key={i} className="number-ball-empty">?</span>
                ),
              )}
            </div>

            <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
              {Array.from({ length: RANGE }, (_, i) => i + 1).map((n) => {
                const active = picks.includes(n);
                const disabled = !active && picks.length >= MAX_PICK;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    disabled={disabled}
                    className={cn(
                      "aspect-square rounded-full font-display font-bold tabular-nums transition",
                      active
                        ? "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold scale-105"
                        : "border border-border bg-card text-foreground hover:border-primary hover:text-primary",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {picks.length < MAX_PICK && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("needMin")} {MAX_PICK} numéros — {picks.length} {t("selected")}.
              </p>
            )}
          </div>
        }
      />
    </>
  );
}