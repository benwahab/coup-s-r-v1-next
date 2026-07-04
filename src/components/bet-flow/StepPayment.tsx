import { Check, CheckCircle2, Clock, Loader2, Save, ShieldCheck, Smartphone, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBetFlow } from "./context";
import { Card } from "./atoms";

export function StepPayment() {
  const { t } = useI18n();
  const {
    selectedPayment, phone, region, holder, gameOpen, openHour, odds,
    totalStake, potentialWin, mmPwd, setMmPwd, mmError, setMmError,
    validated, setValidated, paying, saving, duplicateMsg,
    setStep, finish, saveDraft,
  } = useBetFlow();

  return (
    <Card title={t("payment")}>
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-3 text-[11px]">
        <button type="button" onClick={() => setStep(4)} className="font-bold text-primary underline">{t("bet.editPhoneOperator")}</button>
        <button type="button" onClick={() => setStep(3)} className="font-bold text-primary underline">{t("bet.editSelection")}</button>
      </div>
      <div className="rounded-2xl border border-border bg-secondary/40 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold text-white" style={{ backgroundColor: selectedPayment.color }}>
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("operator")} · {t("accountDetected")}</div>
            <div className="font-display text-base font-extrabold truncate">{selectedPayment.name}</div>
            <div className="text-sm font-bold truncate">{holder}</div>
            <div className="text-xs text-muted-foreground truncate">+227 {phone} · {region}</div>
          </div>
          <button type="button" onClick={() => setStep(4)} className="text-xs font-bold text-primary underline">{t("changeNumber")}</button>
        </div>
        <label className="mt-3 flex items-start gap-2.5 cursor-pointer rounded-xl bg-card/70 px-3 py-2">
          <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span className="text-sm">
            {t("bet.confirmHolder", { holder, operator: selectedPayment.name, phone })}
          </span>
        </label>
      </div>

      {!gameOpen && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-primary">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-sm">
            <b className="font-bold">{t("bet.gameClosed")}</b><br />
            {t("bet.reopenAt", { hour: String(openHour).padStart(2, "0") })}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("totalStake")}</span>
        <span className="font-display text-2xl font-extrabold tabular-nums text-gold">{totalStake.toLocaleString()} <span className="text-xs text-muted-foreground">{t("fcfa")}</span></span>
      </div>
      {odds > 1 && (
        <div className="mt-2 flex items-baseline justify-between rounded-2xl border border-success/30 bg-success/5 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-widest text-success">{t("potentialWin")}</span>
          <span className="font-display text-2xl font-extrabold tabular-nums text-success">{potentialWin.toLocaleString()} <span className="text-xs">{t("fcfa")}</span></span>
        </div>
      )}

      {gameOpen && (
        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("mmPassword")} · {t("mmPasswordHint")}</span>
          <input
            type="password" inputMode="numeric" autoComplete="off" maxLength={6}
            value={mmPwd}
            onChange={(e) => { setMmPwd(e.target.value.replace(/\D/g, "")); setMmError(null); }}
            className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-lg tracking-[0.5em] font-bold focus:border-primary outline-none"
            placeholder="••••"
          />
        </label>
      )}

      {mmError && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <X className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">{mmError}</div>
            {mmError === t("insufficientFunds") && (
              <button type="button" onClick={() => setStep(4)} className="mt-1 text-xs font-bold underline">{t("changeNumber")}</button>
            )}
          </div>
        </div>
      )}

      {duplicateMsg && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold">{t("bet.duplicateBlocked")}</div>
            <div className="text-xs">{duplicateMsg}</div>
          </div>
        </div>
      )}

      {gameOpen ? (
        <button
          type="button"
          disabled={paying || mmPwd.length < 4 || !validated}
          onClick={finish}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-6 py-4 text-lg font-extrabold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-105 disabled:opacity-70"
        >
          {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("paying")}</> : <><Check className="h-5 w-5" /> {t("confirmPayment")}</>}
        </button>
      ) : (
        <button
          type="button"
          disabled={saving || !validated}
          onClick={saveDraft}
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary/15 px-6 py-4 text-lg font-extrabold text-primary transition hover:bg-primary/25 disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {t("bet.saveDraft")}
        </button>
      )}

      {validated && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {t("bet.accountValidated")}
        </p>
      )}

      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> {t("secured")}
      </p>
    </Card>
  );
}