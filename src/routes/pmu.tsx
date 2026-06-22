import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { horses } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pmu")({
  head: () => ({
    meta: [
      { title: "PMU — Pariez sur les chevaux | LoNaNi" },
      { name: "description", content: "Pariez en ligne sur le PMU au Niger : choisissez votre tiercé et payez par mobile money." },
      { property: "og:title", content: "PMU — LoNaNi" },
      { property: "og:description", content: "Choisissez vos chevaux et jouez en quelques clics." },
    ],
  }),
  component: PmuPage,
});

const MAX = 5;

function PmuPage() {
  const { t } = useI18n();
  const [picks, setPicks] = useState<number[]>([]);

  const toggle = (n: number) =>
    setPicks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < MAX ? [...prev, n] : prev,
    );

  const picksLabel = picks.length
    ? picks.map((n) => `${n}. ${horses.find((h) => h.number === n)?.name ?? ""}`).join(" • ")
    : "—";

  return (
    <>
      <PageHeader title="PMU" subtitle={t("selectHorses")} icon={<Trophy className="h-5 w-5" />} />
      <BetFlow
        gameId="pmu"
        gameName="PMU"
        drawDate={new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()}
        selection={picks}
        picksLabel={picksLabel}
        canContinue={picks.length >= 3}
        renderSelection={
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectHorses")}</h2>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tabular-nums">
                {picks.length}/{MAX}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {horses.map((h) => {
                const active = picks.includes(h.number);
                const order = picks.indexOf(h.number) + 1;
                return (
                  <button
                    key={h.number}
                    type="button"
                    onClick={() => toggle(h.number)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition",
                      active
                        ? "border-primary bg-primary/10 shadow-soft"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold",
                        active ? "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold" : "bg-secondary text-secondary-foreground",
                      )}
                    >
                      {h.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{h.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{h.jockey}</span>
                    </span>
                    {active && (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {order}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {picks.length < 3 && <p className="mt-3 text-sm text-muted-foreground">{t("needMin")} 3 chevaux.</p>}
          </div>
        }
      />
    </>
  );
}