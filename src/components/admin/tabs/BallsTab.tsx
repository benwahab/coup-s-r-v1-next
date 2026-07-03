import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { BallStat } from "@/lib/mock-stats";

interface Props {
  ballStats: BallStat[];
  maxBall: number;
  selectedBall: number | null;
  setSelectedBall: (v: number | null) => void;
  selBallStat: BallStat | null;
}

export function BallsTab({ ballStats, maxBall, selectedBall, setSelectedBall, selBallStat }: Props) {
  const { t } = useI18n();
  return (
    <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-display text-lg font-bold">Boules — fréquence de jeu</h2>
        <p className="text-xs text-muted-foreground">Cliquez une boule pour voir la répartition seule / combinaison et ses paires fréquentes.</p>
        <div className="mt-4 grid grid-cols-9 gap-1.5 sm:grid-cols-10">
          {ballStats.map((b) => {
            const intensity = b.total / maxBall;
            const active = selectedBall === b.ball;
            return (
              <button key={b.ball} onClick={() => setSelectedBall(b.ball)} className={cn(
                "flex flex-col items-center justify-center rounded-lg border p-1 transition",
                active ? "border-primary bg-primary/20" : "border-border bg-card/60 hover:border-primary/40",
              )} style={{ background: !active ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 35)}%, var(--card))` : undefined }}>
                <span className="font-display text-xs font-bold">{b.ball}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground">{b.total}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        {selBallStat ? (
          <>
            <div className="flex items-center gap-3">
              <span className="number-ball">{selBallStat.ball}</span>
              <div>
                <div className="font-display text-xl font-extrabold">{selBallStat.total} <span className="text-xs font-normal text-muted-foreground">{t("timesPlayed")}</span></div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("soloVsCombo")}</div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-secondary">
                <div className="bg-gold" style={{ width: `${(selBallStat.solo / Math.max(1, selBallStat.total)) * 100}%` }} />
                <div className="bg-primary" style={{ width: `${(selBallStat.combo / Math.max(1, selBallStat.total)) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] tabular-nums">
                <span className="text-gold">Seule : {selBallStat.solo}</span>
                <span className="text-primary">Combinée : {selBallStat.combo}</span>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Top paires</div>
              <ul className="space-y-1.5">
                {selBallStat.topPairs.map((p) => (
                  <li key={p.ball} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2"><span className="number-ball number-ball-sm">{p.ball}</span></span>
                    <span className="tabular-nums font-bold">×{p.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sélectionnez une boule pour afficher ses statistiques détaillées.</p>
        )}
      </div>
    </section>
  );
}