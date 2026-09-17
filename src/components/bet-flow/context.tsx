import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useTickets, type TicketLeg } from "@/lib/tickets";
import { regions, paymentMethods, type GameId } from "@/lib/mock-data";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { mockAccountHolder } from "@/lib/schedule";
import { useDrafts } from "@/lib/drafts";
import { beginPayment, checkDuplicate, confirmPayment, failPayment, paymentKey } from "@/lib/payments";
import { createTicketAfterPayment } from "@/lib/tickets.functions";
import { supabase } from "@/integrations/supabase/client";
import { fixtureOdds1x2 } from "@/lib/foot-fixtures";

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
  const { session } = useAuth();

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
  const [mmPwd, setMmPwd] = useState("");
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
  const holder = phone ? mockAccountHolder(phone) : "";

  const allLegs: TicketLeg[] = legs?.length
    ? legs
    : [{
        legId: `${Date.now()}-0`, gameId, gameName,
        picks: selection, picksLabel, stake, drawName, drawDate, status: "pending",
      }];
  const totalStake = allLegs.reduce((s, l) => s + l.stake, 0);
  const potentialWin = Math.round(totalStake * odds);

  const simulatedFundsOk = (() => {
    const last = Number((phone.match(/\d/g) ?? ["9"]).slice(-1)[0]);
    return last >= 3;
  })();

  const finish = async () => {
    setMmError(null);
    setDuplicateMsg(null);
    if (!/^\d{4,6}$/.test(mmPwd)) { setMmError(t("mmPasswordHint")); return; }
    try {
      const selectionKey = allLegs.map((l) => `${l.gameId}#${l.picksLabel}`).join("||");
      const pk = paymentKey({ phone, amount: totalStake, gameId, selection: selectionKey });
      const dup = await checkDuplicate(pk);
      if (dup.duplicate) {
        const msg = dup.intent?.status === "confirmed"
          ? `Paiement déjà encaissé (${dup.intent.txRef}). Consultez « Mes tickets ».`
          : `Un paiement identique est déjà en cours. Patientez quelques secondes.`;
        setDuplicateMsg(msg);
        toast.error(msg);
        return;
      }
      const intent = await beginPayment({
        key: pk,
        gameId,
        phone,
        amount: totalStake,
        method: selectedPayment.name,
      });
      setPaying(true);
      await new Promise((r) => setTimeout(r, 1400));
      if (!simulatedFundsOk) {
        await failPayment(intent.txRef);
        setPaying(false);
        setMmError(t("insufficientFunds"));
        toast.error(t("insufficientFunds"));
        return;
      }

      // Demo payment confirmation happens before ticket creation. The ticket
      // itself is then created only by a server function that re-checks the
      // authenticated user, payment ownership/state, amount and game.
      await confirmPayment(intent.txRef);

      const first = allLegs[0];
      const ticketRes = await createTicketAfterPayment({
        data: {
          paymentReference: intent.txRef,
          gameId: first.gameId,
          gameName: first.gameName,
          firstName: account?.firstName,
          lastName: account?.lastName,
          phone,
          region,
          picks: first.picks,
          picksLabel: allLegs.map(l => l.picksLabel).join(" | "),
          stake: totalStake,
          payment: `${selectedPayment.name} · ${intent.txRef}`,
          drawDate: first.drawDate,
          drawName,
          legs: allLegs,
        },
      });
      const ticket = ticketRes.ticket;

      if (first.gameId === "foot" && session) {
        // Une ligne par MATCH (pas par marché) : un ticket peut parier sur
        // plusieurs marchés d'un même match (ex: 1X2 + plus de 2.5 buts sur
        // Arsenal-Chelsea) en une seule soumission. La contrainte UNIQUE
        // (user_id, fixture_id) en base fait respecter "une seule fois par
        // match, pour toujours" au niveau du match entier, pas du marché.
        //
        // Mode démo actuel : les matchs affichés sont fictifs (mock-data),
        // avec des identifiants simples ("epl1", etc.) et non des UUID de
        // vraies rencontres synchronisées — on n'essaie donc pas d'écrire
        // dans foot_picks pour eux (la contrainte de clé étrangère
        // rejetterait l'insertion). Cette logique se réactivera automatiquement
        // dès que la page repassera sur de vraies rencontres (UUID valides).
        const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const pickKeys = (first.picks as string[]).filter((k) => isUuid(k.split(":")[0]));
        if (pickKeys.length > 0) {
          const byFixture = new Map<string, { marketId: string; selection: string; odds: number; status: "pending" }[]>();
          for (const k of pickKeys) {
            const [fixtureId, marketId, selection] = k.split(":");
            const odds = marketId === "1x2" ? fixtureOdds1x2(fixtureId)[selection as "1" | "X" | "2"] : 1;
            const list = byFixture.get(fixtureId) ?? [];
            list.push({ marketId, selection, odds, status: "pending" });
            byFixture.set(fixtureId, list);
          }
          const rows = Array.from(byFixture.entries()).map(([fixtureId, picksArr]) => ({
            user_id: session.userId,
            fixture_id: fixtureId,
            ticket_id: ticket.id,
            picks: picksArr,
            status: "pending" as const,
          }));
          const { error: pickErr } = await supabase.from("foot_picks").insert(rows);
          if (pickErr) {
            toast.error("Un des matchs sélectionnés a déjà été parié entre-temps.");
          }
        }
      }

      toast.success("Paiement confirmé, ticket enregistré ✓");
      setPaying(false);
      navigate({ to: "/ticket/$id", params: { id: ticket.code } });
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
    validated, setValidated, mmPwd, setMmPwd, mmError, setMmError,
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
