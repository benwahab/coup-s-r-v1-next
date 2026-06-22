import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Shuffle, Eraser } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa } from "@/lib/utils";
import { lotoMultipliers } from "@/lib/mock-data";

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

const RANGE = 90;
const MODES = [1, 2, 3, 4, 5] as const;
type Mode = (typeof MODES)[number];
const DEFAULT_STAKE = 500;

function LotoPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(2);
  const [picks, setPicks] = useState<number[]>([]);
  const [stake, setStake] = useState(DEFAULT_STAKE);

  const changeMode = (m: Mode) => {
    setMode(m);
    setPicks((prev) => prev.slice(0, m));
  };

  const toggle = (n: number) =>
    setPicks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < mode ? [...prev, n] : prev,
    );

  const quickPick = () => {
    const pool = Array.from({ length: RANGE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicks(pool.slice(0, mode));
  };

  const sorted = [...picks].sort((a, b) => a - b);
  const picksLabel = sorted.length ? sorted.join(" · ") : "—";

  const multiplier = lotoMultipliers[mode];
  const potentialWin = useMemo(() => stake * multiplier, [stake, multiplier]);

  return (
    <>
      <PageHeader title="Loto Balsa" subtitle={t("selectNumbers")} icon={<Sparkles className="h-5 w-5" />} />
      <BetFlow
        gameId="loto"
        gameName="Loto Balsa"
        drawDate={new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString()}
        selection={sorted}
        picksLabel={`${mode} ${mode === 1 ? "boule" : "boules"} : ${picksLabel}`}
        canContinue={picks.length === mode}
        defaultStake={stake}
        renderSelection={
          <div>
            {/* Mode selector */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("pickMode")}</span>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  x{multiplier.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => changeMode(m)}
                    className={cn(
                      "rounded-xl border-2 py-2.5 text-center transition",
                      mode === m
                        ? "border-primary bg-primary/15 text-primary shadow-green"
                        : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <div className="font-display text-lg font-bold leading-none">{m}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider">x{lotoMultipliers[m].toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectNumbers")}</h2>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={quickPick} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
                  <Shuffle className="h-3 w-3" /> {t("quickPick")}
                </button>
                <button type="button" onClick={() => setPicks([])} disabled={!picks.length} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-40">
                  <Eraser className="h-3 w-3" /> {t("clear")}
                </button>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground tabular-nums">
                  {picks.length}/{mode}
                </span>
              </div>
            </div>

            <div className="mb-4 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 p-3">
              {Array.from({ length: mode }).map((_, i) =>
                sorted[i] != null ? (
                  <span key={i} className="number-ball">{sorted[i]}</span>
                ) : (
                  <span key={i} className="number-ball-empty">?</span>
                ),
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: RANGE }, (_, i) => i + 1).map((n) => {
                const active = picks.includes(n);
                const disabled = !active && picks.length >= mode;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    disabled={disabled}
                    className={cn(
                      "aspect-square rounded-full font-display text-sm font-bold tabular-nums transition",
                      active
                        ? "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold scale-105"
                        : "border border-border bg-card/60 text-foreground hover:border-primary hover:text-primary",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Potential win bar */}
            <div className="mt-5 grid gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-3">
              <label className="block sm:col-span-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("stake")} ({t("fcfa")})</span>
                <input
                  type="number"
                  min={100}
                  value={stake}
                  onChange={(e) => setStake(Math.max(100, Number(e.target.value) || 0))}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 font-display font-bold tabular-nums focus:border-primary outline-none"
                />
              </label>
              <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-background/40 px-4 py-2.5">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("potentialWin")}</div>
                  <div className="font-display text-2xl font-extrabold tabular-nums text-primary">
                    {formatFcfa(potentialWin)} <span className="text-sm font-semibold text-muted-foreground">{t("fcfa")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("multiplier")}</div>
                  <div className="font-display text-xl font-bold text-gold">x{multiplier.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {picks.length < mode && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("needMin")} {mode} {mode === 1 ? "boule" : "boules"} — {picks.length} {t("selected")}.
              </p>
            )}
          </div>
        }
      />
    </>
  );
}