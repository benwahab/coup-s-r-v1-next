// Système anti-double paiement + rate limiting adossé à la table `payments`.
// Chaque intention est une ligne : status pending → confirmed | failed.

import { supabase } from "@/integrations/supabase/client";
import { updateMyPaymentStatus } from "./admin.functions";
import type { Ticket } from "./tickets";

const WINDOW_MS = 30_000; // fenêtre anti-doublon : 30s

export interface PaymentIntent {
  key: string;
  txRef: string;
  gameId: string;
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

/** Empreinte déterministe du paiement. */
export function paymentKey(input: { phone: string; amount: number; gameId: string; selection: string }): string {
  const s = `${input.phone}|${input.amount}|${input.gameId}|${input.selection}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return `pk_${(h >>> 0).toString(36)}`;
}

/** Vérifie si un paiement identique est en cours ou a déjà été confirmé dans la fenêtre anti-doublon. */
export async function checkDuplicate(key: string): Promise<{ duplicate: boolean; intent?: PaymentIntent }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { duplicate: false };
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data } = await supabase
    .from("payments")
    .select("payment_key, reference, method, amount, status, created_at")
    .eq("user_id", userId)
    .eq("payment_key", key)
    .or(`status.eq.confirmed,and(status.eq.pending,created_at.gte.${cutoff})`)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return { duplicate: false };
  return {
    duplicate: true,
    intent: {
      key: row.payment_key ?? key,
      txRef: row.reference,
      gameId: "",
      phone: "",
      amount: row.amount,
      createdAt: new Date(row.created_at).getTime(),
      status: row.status,
    },
  };
}

/** Crée une intention de paiement `pending`. À appeler juste avant l'appel à la MM API. */
export async function beginPayment(input: {
  key: string;
  gameId: string;
  phone: string;
  amount: number;
  method?: string;
}): Promise<PaymentIntent> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("not_authenticated");
  const now = Date.now();
  const txRef =
    `TX-${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();
  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: userId,
      amount: input.amount,
      method: input.method ?? "mock",
      status: "pending",
      reference: txRef,
      payment_key: input.key,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    key: input.key,
    txRef: data.reference,
    gameId: input.gameId,
    phone: input.phone,
    amount: input.amount,
    createdAt: new Date(data.created_at).getTime(),
    status: "pending",
  };
}

/** Marque l'intention comme confirmée (ticket émis). */
export async function confirmPayment(txRef: string, ticket?: Pick<Ticket, "id"> | null) {
  // Récupère l'uuid du ticket via son `code` public pour lier la ligne payments.
  let ticketId: string | undefined;
  if (ticket) {
    const { data } = await supabase
      .from("tickets")
      .select("id")
      .eq("code", ticket.id)
      .maybeSingle();
    ticketId = data?.id;
  }
  await updateMyPaymentStatus({ data: { reference: txRef, status: "confirmed", ticketId } });
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
    .select("payment_key, reference, amount, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    key: r.payment_key ?? "",
    txRef: r.reference,
    gameId: "",
    phone: "",
    amount: r.amount,
    createdAt: new Date(r.created_at).getTime(),
    status: r.status,
  }));
}

// Réexport de conversion pour l'admin (affichage des numéros courts).
export const paymentsHelpers = { toE164, stripPrefix };