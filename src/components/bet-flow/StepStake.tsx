import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBetFlow } from "./context";
import { Card, Footer } from "./atoms";

const STAKES = [300, 500, 1000, 2000, 5000, 10000];

export function StepStake() {
  const { t } = useI18n();
  const {
    lockedStake, legs, allLegs, totalStake, minStake, maxStake, stake, setStake,
    goBackFrom, goNextFrom,
  } = useBetFlow();

  return (
    <Card title={t("stake")}>
      {lockedStake != null ? (
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">
          Mise calculée automatiquement selon votre pari · <b className="tabular-nums">{lockedStake.toLocaleString()} {t("fcfa")}</b>
        </p>
      ) : legs?.length ? (
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">
          Mises définies par grille — {allLegs.length} {t("grids")} · {t("totalStake")}: <b className="tabular-nums">{totalStake.toLocaleString()} {t("fcfa")}</b>
        </p>
      ) : (<>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STAKES.filter(v => v >= minStake && v <= maxStake).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStake(v)}
              className={cn(
                "rounded-2xl border-2 px-3 py-4 font-display font-bold tabular-nums transition",
                stake === v ? "border-primary bg-primary/10 text-primary shadow-soft" : "border-border bg-card hover:border-primary/40",
              )}
            >
              {v.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Autre montant ({t("fcfa")}) — min {minStake.toLocaleString()} · max {maxStake.toLocaleString()}
          </label>
          <input
            type="number"
            min={minStake}
            max={maxStake}
            value={stake}
            onChange={(e) => setStake(Math.max(0, Math.min(maxStake, Number(e.target.value) || 0)))}
            className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-lg font-bold tabular-nums focus:border-primary outline-none"
          />
          {stake > 0 && stake < minStake && <p className="mt-1 text-xs text-destructive">{t("minStake")}</p>}
          {stake > maxStake && <p className="mt-1 text-xs text-destructive">{t("maxStake")}</p>}
        </div>
      </>)}
      <Footer onBack={() => goBackFrom(2)} onNext={() => goNextFrom(2)} disabled={lockedStake == null && !legs?.length && (stake < minStake || stake > maxStake)} />
    </Card>
  );
}