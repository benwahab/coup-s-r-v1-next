import { Check, Smartphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { regions, paymentMethods } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useBetFlow } from "./context";
import { Card, Footer } from "./atoms";

export function StepIdentity() {
  const { t } = useI18n();
  const {
    account, phone, region, setRegion, simpleMode, setSimpleMode,
    paymentId, setPaymentId, phoneOk,
    goBackFrom, goNextFrom,
  } = useBetFlow();

  return (
    <Card title={t("identity")}>
      <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{account ? t("bet.greetConfirmPhone", { name: account.firstName }) : t("bet.enterPhoneInstruction")}</p>
        <button type="button" onClick={() => setSimpleMode((v) => !v)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition", simpleMode ? "border-success/40 bg-success/10 text-success" : "border-border bg-card text-muted-foreground")}>
          {simpleMode ? t("bet.simpleMode") : t("bet.detailedMode")}
        </button>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("phone")}</span>
        <div className={cn("mt-1 w-full rounded-2xl border border-input bg-muted/40 px-4 py-3 text-muted-foreground", simpleMode ? "text-2xl font-extrabold tracking-wider" : "text-base")}>
          +227 {phone}
        </div>
      </label>
      <div className="mt-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("bet.paymentMode")} *</span>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {paymentMethods.map((p) => {
            const sel = p.id === paymentId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentId(p.id)}
                className={cn(
                  "flex min-h-14 items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left font-semibold transition",
                  sel ? "border-primary bg-primary/10 shadow-soft" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: p.color }}>
                  <Smartphone className="h-4 w-4" />
                </span>
                <span className="min-w-0 truncate text-sm">{p.name}</span>
                {sel && <Check className="ml-auto h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block mt-5">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("region")} *</span>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none">
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <Footer onBack={() => goBackFrom(4)} onNext={() => goNextFrom(4)} disabled={!phoneOk || !paymentId || !region} />
    </Card>
  );
}