import { Dices } from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { BallStat } from "@/lib/mock-stats";
import type { LotoBallWagerStat, LotoCombinationWagerStat } from "@/lib/admin.functions";

interface Props {
  ballStats: BallStat[];
  maxBall: number;
  selectedBall: number | null;
  setSelectedBall: (v: number | null) => void;
  selBallStat: BallStat | null;
  wagerStats: LotoBallWagerStat[];
  combinationStats: LotoCombinationWagerStat[];
  live: boolean;
}

export function BallsTab({ ballStats, maxBall, selectedBall, setSelectedBall, selBallStat, wagerStats, combinationStats, live }: Props) {
  const { t } = useI18n();
  return (
    <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Dices className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.balls.title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground">{t("admin.balls.subtitle")}</p>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {live ? "Données de mises enregistrées" : "Aperçu démo — données réelles disponibles après activation de Supabase"}
        </div>
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
                <span className="text-[9px] tabular-nums text-muted-foreground">{wagerStats.find((s) => s.ball === b.ball)?.wagerCount ?? b.total} mises</span>
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
                <div className="font-display text-xl font-extrabold">
                  {wagerStats.find((s) => s.ball === selBallStat.ball)?.wagerCount ?? selBallStat.total}
                  <span className="text-xs font-normal text-muted-foreground"> mises sur cette boule</span>
                </div>
                <div className="mt-1 text-sm font-bold text-primary">
                  {formatFcfa(wagerStats.find((s) => s.ball === selBallStat.ball)?.stakedAmount ?? 0)} FCFA
                </div>
              </div>
            </div>
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("soloVsCombo")}</div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-secondary">
                <div className="bg-gold" style={{ width: `${(selBallStat.solo / Math.max(1, selBallStat.total)) * 100}%` }} />
                <div className="bg-primary" style={{ width: `${(selBallStat.combo / Math.max(1, selBallStat.total)) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-[11px] tabular-nums">
                <span className="text-gold">{t("admin.balls.solo")} : {selBallStat.solo}</span>
                <span className="text-primary">{t("admin.balls.combo")} : {selBallStat.combo}</span>
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Mises par combinaison</div>
              <div className="max-h-72 overflow-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-3 py-2">Combinaison</th>
                      <th className="px-3 py-2 text-right">Mises</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinationStats.map((row) => (
                      <tr key={row.combination} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 font-semibold tabular-nums">{row.combination}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.wagerCount}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums">{formatFcfa(row.stakedAmount)} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {combinationStats.length === 0 && <div className="p-4 text-center text-muted-foreground">Aucune mise enregistrée.</div>}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{t("admin.balls.topPairs")}</div>
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
          <p className="text-sm text-muted-foreground">{t("admin.balls.selectPrompt")}</p>
        )}
      </div>
    </section>
  );
}