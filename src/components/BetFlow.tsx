import { ArrowLeft, Clock, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BetFlowProvider, useBetFlow, type BetFlowConfig } from "./bet-flow/context";
import { StepPicks } from "./bet-flow/StepPicks";
import { StepStake } from "./bet-flow/StepStake";
import { StepConfirm } from "./bet-flow/StepConfirm";
import { StepIdentity } from "./bet-flow/StepIdentity";
import { StepPayment } from "./bet-flow/StepPayment";

export function BetFlow(cfg: BetFlowConfig) {
  return (
    <BetFlowProvider cfg={cfg}>
      <BetFlowShell />
    </BetFlowProvider>
  );
}

function BetFlowShell() {
  const { t } = useI18n();
  const {
    gameName, gameOpen, openHour, step, stepIndex, totalSteps,
    accountComplete, expressMode, setExpressMode, skipStake, goBackFrom,
  } = useBetFlow();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Stepper */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => goBackFrom(step)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("back")}
        </button>
        <div className="flex items-center gap-2">
          {accountComplete && (
            <button
              type="button"
              onClick={() => setExpressMode((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                expressMode
                  ? "border-gold/60 bg-gold/15 text-gold shadow-gold"
                  : "border-border bg-card text-muted-foreground",
              )}
              title="Parcours en 3 clics : validation → paiement"
            >
              <Zap className="h-3 w-3" /> {expressMode ? "Express 3 clics" : "Mode avancé"}
            </button>
          )}
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">{gameName}</span>
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span>{t("step")} {stepIndex} {t("of")} {totalSteps}</span>
        {!gameOpen && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            <Clock className="h-3 w-3" /> Jeu fermé · paiement à {String(openHour).padStart(2, "0")}h
          </span>
        )}
      </div>
      <div className="mb-6 grid gap-1" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={cn("h-1.5 rounded-full", i < stepIndex ? "bg-gold-gradient" : "bg-muted")} />
        ))}
      </div>

      {step === 1 && <StepPicks />}
      {step === 2 && !skipStake && <StepStake />}
      {step === 3 && <StepConfirm />}
      {step === 4 && <StepIdentity />}
      {step === 5 && <StepPayment />}
    </div>
  );
}