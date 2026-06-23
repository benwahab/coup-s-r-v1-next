import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { paymentMethods, regions, type GameId } from "@/lib/mock-data";
import { useAccount } from "@/lib/account";
import { cn } from "@/lib/utils";

interface Props {
  gameId: GameId;
  gameName: string;
  drawDate: string;
  selection: (string | number)[];
  picksLabel: string;
  canContinue: boolean;
  renderSelection: ReactNode;
  defaultStake?: number;
}

const STAKES = [100, 200, 500, 1000, 2000, 5000];

export function BetFlow({ gameId, gameName, drawDate, selection, picksLabel, canContinue, renderSelection, defaultStake = 500 }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { addTicket } = useTickets();
  const { account } = useAccount();
  const [step, setStep] = useState(1);
  const [stake, setStake] = useState(defaultStake);
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [email, setEmail] = useState("");
  const [payment, setPayment] = useState(paymentMethods[0].id);
  const [paying, setPaying] = useState(false);

  const totalSteps = 4;
  const phoneOk = /^[+\d][\d\s]{6,}$/.test(phone);

  const finish = async () => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1500));
    const ticket = addTicket({
      gameId, gameName, firstName, lastName, phone, email, region,
      picks: selection, picksLabel,
      stake, payment: paymentMethods.find((p) => p.id === payment)!.name,
      drawDate,
    });
    navigate({ to: "/ticket/$id", params: { id: ticket.id } });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Stepper */}
      <div className="mb-5 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span>{t("step")} {step} {t("of")} {totalSteps}</span>
        <span className="text-primary">{gameName}</span>
      </div>
      <div className="mb-6 grid grid-cols-4 gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={cn("h-1.5 rounded-full", i < step ? "bg-gold-gradient" : "bg-muted")} />
        ))}
      </div>

      {step === 1 && (
        <Card>
          {renderSelection}
          <Footer onBack={() => history.back()} onNext={() => setStep(2)} disabled={!canContinue} />
        </Card>
      )}

      {step === 2 && (
        <Card title={t("stake")}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STAKES.map((v) => (
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
              Autre montant ({t("fcfa")})
            </label>
            <input
              type="number"
              min={100}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-lg font-bold tabular-nums focus:border-primary outline-none"
            />
          </div>
          <Footer onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={stake < 100} />
        </Card>
      )}

      {step === 3 && (
        <Card title={t("identity")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${t("firstName")} (${t("optional")})`} value={firstName} onChange={setFirstName} />
            <Field label={`${t("lastName")} (${t("optional")})`} value={lastName} onChange={setLastName} />
            <Field label={t("phone")} value={phone} onChange={setPhone} type="tel" placeholder="+227 90 00 00 00" required wide />
            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("region")}</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none"
              >
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <Field label={`${t("email")} (${t("optional")})`} value={email} onChange={setEmail} type="email" wide />
          </div>
          <Footer onBack={() => setStep(2)} onNext={() => setStep(4)} disabled={!phoneOk} />
        </Card>
      )}

      {step === 4 && (
        <Card title={t("payment")}>
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">{t("choosePayment")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {paymentMethods.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPayment(m.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition",
                  payment === m.id ? "border-primary bg-primary/5 shadow-soft" : "border-border bg-card hover:border-primary/40",
                )}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold text-white" style={{ backgroundColor: m.color }}>
                  {m.name.charAt(0)}
                </span>
                <span className="font-semibold">{m.name}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("summary")}</div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-semibold">{gameName}</span>
              <span className="font-display text-2xl font-bold tabular-nums">{stake.toLocaleString()} {t("fcfa")}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{picksLabel}</div>
          </div>

          <button
            type="button"
            disabled={paying}
            onClick={finish}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-6 py-4 text-lg font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-105 disabled:opacity-70"
          >
            {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("paying")}</> : <>{t("confirm")} <ArrowRight className="h-5 w-5" /></>}
          </button>

          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("secured")}
          </p>
        </Card>
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-soft">
      {title && <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>}
      {children}
    </div>
  );
}

function Footer({ onBack, onNext, disabled }: { onBack: () => void; onNext: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button onClick={onBack} type="button" className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </button>
      <button
        onClick={onNext}
        type="button"
        disabled={disabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-base font-bold text-primary-foreground shadow-soft transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("continue")} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, wide }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; wide?: boolean }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}{required && " *"}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none"
      />
    </label>
  );
}