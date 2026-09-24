import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { type TicketLeg } from "@/lib/tickets";
import { regions, paymentMethods, type GameId } from "@/lib/game-config";
import { useAccount } from "@/lib/account";
import { useDrafts } from "@/lib/drafts";
import { checkDuplicate, paymentKey } from "@/lib/payments";

export interface BetFlowConfig {
  gameId: GameId;
  gameName: string;
  drawDate: string;
  selection: (string | number)[];
  picksLabel: string;
  canContinue: boolean;
  renderSelection: ReactNode;
  defaultStake?: number;
  legs?: TicketLeg[];
  drawName?: string;
  minStake?: number;
  maxStake?: number;
  odds?: number;
  lockedStake?: number;
  skipStake?: boolean;
  gameOpen?: boolean;
  openHour?: number;
}

type Ctx = ReturnType<typeof useProviderValue>;
const BetFlowCtx = createContext<Ctx | null>(null);

function useProviderValue(cfg: BetFlowConfig) {
  const {
    gameId, gameName, drawDate, selection, picksLabel, canContinue, renderSelection,
    defaultStake = 500, legs, drawName, minStake = 100, maxStake = 100_000, odds = 1, lockedStake,
    skipStake = false, gameOpen = true, openHour = 8,
  } = cfg;

  const { t } = useI18n();
  const navigate = useNavigate();
  const { addDraft } = useDrafts();
  const { account } = useAccount();

  const accountComplete = !!(account && account.phone && account.region);
  const [expressMode, setExpressMode] = useState(accountComplete);
  useEffect(() => {
    if (accountComplete) setExpressMode(true);
  }, [accountComplete]);
  const [step, setStep] = useState(1);
  const [stake, setStake] = useState(lockedStake ?? defaultStake);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [validated, setValidated] = useState(false);
  const [mmError, setMmError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [paymentId, setPaymentId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lockedStake != null) setStake(lockedStake);
  }, [lockedStake]);

  // 1 = sélection ; 3 = validation ; 4 = choix de l'opérateur de paiement
  // (numéro non modifiable, plus de détection auto : l'utilisateur doit
  // toujours choisir lui-même) ; 5 = paiement.
  const visibleSteps = useMemo(() => [1, 3, 5], []);
  const totalSteps = visibleSteps.length;
  const stepIndex = Math.max(1, visibleSteps.indexOf(step) + 1);
  const goNextFrom = (s: number) => {
    const i = visibleSteps.indexOf(s);
    if (i >= 0 && i < visibleSteps.length - 1) setStep(visibleSteps[i + 1]);
  };
  const goBackFrom = (s: number) => {
    const i = visibleSteps.indexOf(s);
    if (i > 0) setStep(visibleSteps[i - 1]);
    else if (typeof window !== "undefined") window.history.back();
  };

  const phoneOk = /^[+\d][\d\s]{6,}$/.test(phone);
  const selectedPayment = paymentMethods.find((p) => p.id === paymentId) ?? paymentMethods[0];
  const holder = "";

  const allLegs: TicketLeg[] = legs?.length
    ? legs
    : [{
        legId: `${Date.now()}-0`, gameId, gameName,
        picks: selection, picksLabel, stake, drawName, drawDate, status: "pending",
      }];
  const totalStake = allLegs.reduce((s, l) => s + l.stake, 0);
  const potentialWin = Math.round(totalStake * odds);

  const finish = async () => {
    setMmError(null);
    setDuplicateMsg(null);
    try {
      const selectionKey = allLegs.map((l) => `${l.gameId}#${l.picksLabel}`).join("||");
      const pk = await paymentKey({ phone, amount: totalStake, gameId, selection: selectionKey });
      const dup = await checkDuplicate(pk);
      if (dup.duplicate) {
        const msg = dup.intent?.status === "confirmed"
          ? `Paiement déjà encaissé (${dup.intent.txRef}). Consultez « Mes tickets ».`
          : `Un paiement identique est déjà en cours. Patientez quelques secondes.`;
        setDuplicateMsg(msg);
        toast.error(msg);
        return;
      }
      const unavailable = "Le paiement mobile n'est pas encore connecté à un fournisseur réel.";
      setMmError(unavailable);
      toast.error(unavailable);
      return;

    } catch (e) {
      setPaying(false);
      const msg = e instanceof Error ? e.message : "Erreur réseau — réessayez.";
      setMmError("Le paiement n'a pas pu être finalisé. Réessayez.");
      toast.error(msg);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    addDraft({
      gameId, gameName, drawName, drawDate,
      legs: allLegs,
      picksLabel: allLegs.map((l) => l.picksLabel).join(" | "),
      totalStake,
      phone, region,
      paymentId: selectedPayment.id, paymentName: selectedPayment.name,
      openHour,
    });
    navigate({ to: "/mes-tickets" });
  };

  return {
    gameId, gameName, drawDate, selection, picksLabel, canContinue, renderSelection,
    legs, drawName, minStake, maxStake, odds, lockedStake, skipStake, gameOpen, openHour,
    account, accountComplete, expressMode, setExpressMode,
    step, setStep, stake, setStake, phone, setPhone, region, setRegion,
    validated, setValidated, mmError, setMmError,
    paying, simpleMode, setSimpleMode, paymentId, setPaymentId,
    saving, duplicateMsg,
    visibleSteps, totalSteps, stepIndex, goNextFrom, goBackFrom,
    phoneOk, selectedPayment, holder, allLegs, totalStake, potentialWin,
    finish, saveDraft,
  };
}

export function BetFlowProvider({ cfg, children }: { cfg: BetFlowConfig; children: ReactNode }) {
  const value = useProviderValue(cfg);
  return <BetFlowCtx.Provider value={value}>{children}</BetFlowCtx.Provider>;
}

export function useBetFlow() {
  const c = useContext(BetFlowCtx);
  if (!c) throw new Error("useBetFlow must be used within BetFlowProvider");
  return c;
}
