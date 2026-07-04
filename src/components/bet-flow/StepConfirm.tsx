import { useI18n } from "@/lib/i18n";
import { useBetFlow } from "./context";
import { Card, Footer } from "./atoms";

export function StepConfirm() {
  const { t } = useI18n();
  const {
    gameName, drawName, allLegs, odds, totalStake, potentialWin, validated, setValidated,
    goBackFrom, goNextFrom,
  } = useBetFlow();

  return (
    <Card title={t("finalReview")}>
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">{gameName}{drawName ? ` — ${drawName}` : ""}</div>
        <ul className="space-y-2">
          {allLegs.map((l, i) => (
            <li key={l.legId} className="flex items-start justify-between gap-3 rounded-xl bg-card px-3 py-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary">{t("grid")} {i + 1}</div>
                <div className="text-sm font-semibold break-words">{l.picksLabel}</div>
                {odds > 1 && (
                  <div className="text-[11px] text-muted-foreground">{t("potentialWin")}: <b className="text-success tabular-nums">{Math.round(l.stake * odds).toLocaleString()} {t("fcfa")}</b></div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-base font-extrabold tabular-nums">{l.stake.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">{t("fcfa")}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("totalStake")}</span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-primary">{totalStake.toLocaleString()} <span className="text-xs font-semibold text-muted-foreground">{t("fcfa")}</span></span>
        </div>
        {odds > 1 && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-gold/10 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gold">{t("potentialWin")}</span>
            <span className="font-display text-2xl font-extrabold tabular-nums text-gold">{potentialWin.toLocaleString()} <span className="text-xs">{t("fcfa")}</span></span>
          </div>
        )}
        {odds > 1 && (
          <div className="mt-1 text-[11px] text-muted-foreground text-right">{t("bet.globalOdds", { odds: odds.toFixed(2) })}</div>
        )}
      </div>
      <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
        <span className="text-sm">{t("validateSelection")}</span>
      </label>
      <Footer onBack={() => goBackFrom(3)} onNext={() => goNextFrom(3)} disabled={!validated} />
    </Card>
  );
}