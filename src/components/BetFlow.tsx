import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Smartphone, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTickets, type TicketLeg } from "@/lib/tickets";
import { regions, type GameId } from "@/lib/mock-data";
import { useAccount } from "@/lib/account";
import { detectOperator, mockAccountHolder } from "@/lib/schedule";
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
  /** Si fourni, le BetFlow part avec ces grilles déjà empilées (Loto multi-grilles). */
  legs?: TicketLeg[];
  /** Nom du tirage du jour (Loto) à attacher au ticket. */
  drawName?: string;
  /** Borne mise par jeu : Loto = 300/100000. */
  minStake?: number;
  maxStake?: number;
  /** Cote globale pour calcul du gain potentiel (PMU/Pari Foot). 1 par défaut. */
  odds?: number;
  /** Si fourni, force le montant (ex. PMU = combos × baseStake) et masque les chips. */
  lockedStake?: number;
}

const STAKES = [300, 500, 1000, 2000, 5000, 10000];

export function BetFlow({
  gameId, gameName, drawDate, selection, picksLabel, canContinue, renderSelection,
  defaultStake = 500, legs, drawName, minStake = 100, maxStake = 100_000, odds = 1, lockedStake,
}: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { addTicket } = useTickets();
  const { account } = useAccount();
  const [step, setStep] = useState(1);
  const [stake, setStake] = useState(lockedStake ?? defaultStake);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [validated, setValidated] = useState(false);
  const [mmPwd, setMmPwd] = useState("");
  const [mmError, setMmError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);

  // Si lockedStake change (PMU : nouveau type de pari ou autre nb de chevaux), on s'aligne.
  useEffect(() => {
    if (lockedStake != null) setStake(lockedStake);
  }, [lockedStake]);

  // 1 = sélection ; 2 = mise (sauté si legs fournies avec stakes) ; 3 = validation ; 4 = identité ; 5 = paiement
  const totalSteps = 5;
  const phoneOk = /^[+\d][\d\s]{6,}$/.test(phone);
  const operator = phone ? detectOperator(phone) : null;
  const holder = phone ? mockAccountHolder(phone) : "";

  const allLegs: TicketLeg[] = legs?.length
    ? legs
    : [{
        legId: `${Date.now()}-0`, gameId, gameName,
        picks: selection, picksLabel, stake, drawName, drawDate, status: "pending",
      }];
  const totalStake = allLegs.reduce((s, l) => s + l.stake, 0);
  const potentialWin = Math.round(totalStake * odds);

  // Simulation déterministe : "fonds insuffisants" si dernier chiffre du téléphone < 3
  const simulatedFundsOk = (() => {
    const last = Number((phone.match(/\d/g) ?? ["9"]).slice(-1)[0]);
    return last >= 3;
  })();

  const finish = async () => {
    setMmError(null);
    if (!/^\d{4,6}$/.test(mmPwd)) { setMmError(t("mmPasswordHint")); return; }
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1400));
    if (!simulatedFundsOk) {
      setPaying(false);
      setMmError(t("insufficientFunds"));
      return;
    }
    // Représentation legacy (1er leg) pour compat
    const first = allLegs[0];
    const ticket = addTicket({
      gameId: first.gameId, gameName: first.gameName,
      firstName: account?.firstName, lastName: account?.lastName, phone, region,
      picks: first.picks, picksLabel: allLegs.map(l => l.picksLabel).join(" | "),
      stake: totalStake,
      payment: operator?.name ?? "Mobile Money",
      drawDate: first.drawDate,
      drawName,
      legs: allLegs,
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
      <div className="mb-6 grid grid-cols-5 gap-1">
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
          <Footer onBack={() => setStep(1)} onNext={() => setStep(3)} disabled={lockedStake == null && !legs?.length && (stake < minStake || stake > maxStake)} />
        </Card>
      )}

      {step === 3 && (
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
              <div className="mt-1 text-[11px] text-muted-foreground text-right">Cote globale · ×{odds.toFixed(2)}</div>
            )}
          </div>
          <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={validated} onChange={(e) => setValidated(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span className="text-sm">{t("validateSelection")}</span>
          </label>
          <Footer onBack={() => setStep(2)} onNext={() => setStep(account ? 5 : 4)} disabled={!validated} />
        </Card>
      )}

      {step === 4 && (
        <Card title={t("identity")}>
          <div className="-mt-2 mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{account ? `Bonjour ${account.firstName}, confirmez votre numéro.` : "Entrez le numéro qui sera débité."}</p>
            <button type="button" onClick={() => setSimpleMode((v) => !v)} className={cn("shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition", simpleMode ? "border-success/40 bg-success/10 text-success" : "border-border bg-card text-muted-foreground")}>
              {simpleMode ? "🟢 Mode simple" : "Mode détaillé"}
            </button>
          </div>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("phone")} *</span>
            <input
              type="tel" inputMode="tel" autoComplete="tel" pattern="[0-9+ ]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+227 90 00 00 00"
              className={cn("mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 focus:border-primary outline-none", simpleMode ? "text-2xl font-extrabold tracking-wider" : "text-base")}
            />
          </label>
          {!simpleMode && (
            <label className="block mt-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("region")}</span>
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none">
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          )}
          <Footer onBack={() => setStep(3)} onNext={() => setStep(5)} disabled={!phoneOk} />
        </Card>
      )}

      {step === 5 && (
        <Card title={t("payment")}>
          {account && (
            <button type="button" onClick={() => setStep(4)} className="-mt-2 mb-3 text-[11px] font-bold text-primary underline">Modifier mon numéro</button>
          )}
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-bold text-white" style={{ backgroundColor: operator?.color }}>
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("operator")} · {t("accountDetected")}</div>
                <div className="font-display text-base font-extrabold truncate">{operator?.name}</div>
                <div className="text-xs text-muted-foreground truncate">{holder} · {phone}</div>
              </div>
              <button type="button" onClick={() => setStep(4)} className="text-xs font-bold text-primary underline">{t("changeNumber")}</button>
            </div>
          </div>

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

          <button
            type="button"
            disabled={paying || mmPwd.length < 4}
            onClick={finish}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-6 py-4 text-lg font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-105 disabled:opacity-70"
          >
            {paying ? <><Loader2 className="h-5 w-5 animate-spin" /> {t("paying")}</> : <><Check className="h-5 w-5" /> {t("confirmPayment")}</>}
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