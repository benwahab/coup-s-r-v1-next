// Système anti-double paiement + rate limiting adossé à la table `payments`.
// Chaque intention est une ligne : status pending → confirmed | failed.

import { supabase } from "@/integrations/supabase/client";
import { beginPayment as beginPaymentServer, checkPaymentDuplicate } from "./payment.functions";
import { updateMyPaymentStatus } from "./admin.functions";
import type { Ticket } from "./tickets";

const WINDOW_MS = 30_000; // fenêtre anti-doublon : 30s

export interface PaymentIntent {
  key: string;
  txRef: string;
  gameId: string | null;
  phone: string;
  amount: number;
  createdAt: number;
  status: "pending" | "confirmed" | "failed";
}

function toE164(local: string | undefined | null): string | null {
  if (!local) return null;
  const s = local.replace(/\D/g, "");
  if (s.length === 8) return `+227${s}`;
  if (s.startsWith("227")) return `+${s}`;
  return s.startsWith("+") ? s : `+${s}`;
}
function stripPrefix(e164: string | null | undefined): string {
  const s = (e164 ?? "").replace(/\D/g, "");
  if (s.startsWith("227") && s.length === 11) return s.slice(3);
  return s.slice(-8);
}

/** Empreinte cryptographique déterministe du paiement. */
export async function paymentKey(input: { phone: string; amount: number; gameId: string; selection: string }): Promise<string> {
  const normalizedPhone = input.phone.replace(/\D/g, "");
  const payload = `${normalizedPhone}|${input.amount}|${input.gameId}|${input.selection}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `pk_${hex}`;
}

/** Vérifie si un paiement identique est en cours ou a déjà été confirmé dans la fenêtre anti-doublon. */
export async function checkDuplicate(key: string): Promise<{ duplicate: boolean; intent?: PaymentIntent }> {
  return checkPaymentDuplicate({ data: { key } });
}

export async function beginPayment(input: {
  key: string;
  gameId: string | null;
  phone: string;
  amount: number;
  method?: string;
}): Promise<PaymentIntent> {
  const res = await beginPaymentServer({
    data: {
      key: input.key,
      gameId: input.gameId as "pmu" | "loto" | "foot",
      phone: input.phone,
      amount: input.amount,
      method: input.method ?? "mock",
    },
  });
  if (res.duplicate) {
    throw new Error("duplicate_payment:" + res.intent.txRef);
  }
  return res.intent;
}

/** Marque l'intention comme confirmée (ticket émis). */
export async function confirmPayment(txRef: string) {
  // The payment-to-ticket link is created atomically by the server-side
  // ticket creation RPC. The client never supplies a ticket id here.
  await updateMyPaymentStatus({ data: { reference: txRef, status: "confirmed" } });
}

/** Marque l'intention comme échouée (annule le blocage anti-doublon). */
export async function failPayment(txRef: string) {
  await updateMyPaymentStatus({ data: { reference: txRef, status: "failed" } });
}

/** Liste des intentions de paiement du joueur courant. */
export async function listMyIntents(): Promise<PaymentIntent[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data } = await supabase
    .from("payments")
    .select("payment_key, reference, amount, status, game_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    key: r.payment_key ?? "",
    txRef: r.reference,
    gameId: r.game_id ?? "",
    phone: "",
    amount: r.amount,
    createdAt: new Date(r.created_at).getTime(),
    status: r.status,
  }));
}

// Réexport de conversion pour l'admin (affichage des numéros courts).
export const paymentsHelpers = { toE164, stripPrefix };