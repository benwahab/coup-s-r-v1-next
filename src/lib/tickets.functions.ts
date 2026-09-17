import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const TicketStatus = z.literal("pending");

const ticketLegSchema = z.object({
  legId: z.string().min(1).max(100),
  gameId: z.string().min(1).max(50),
  gameName: z.string().min(1).max(200),
  picks: z.array(z.union([z.string().max(500), z.number().finite()])).max(500),
  picksLabel: z.string().max(5000),
  stake: z.number().int().min(1).max(10_000_000),
  drawName: z.string().max(200).optional(),
  drawDate: z.string().min(1).max(100),
  status: TicketStatus,
  prize: z.number().int().min(0).optional(),
});

const createTicketSchema = z.object({
  paymentReference: z.string().min(1).max(200),
  gameId: z.string().min(1).max(50),
  gameName: z.string().min(1).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().min(8).max(30),
  region: z.string().max(100).optional(),
  picks: z.array(z.union([z.string().max(500), z.number().finite()])).max(500),
  picksLabel: z.string().max(5000),
  stake: z.number().int().min(1).max(10_000_000),
  payment: z.string().min(1).max(300),
  drawDate: z.string().max(100),
  drawName: z.string().max(200).optional(),
  legs: z.array(ticketLegSchema).max(100).optional(),
});

function toE164(local: string): string | null {
  const s = local.replace(/\D/g, "");
  if (!s) return null;
  if (s.length === 8) return `+227${s}`;
  if (s.startsWith("227")) return `+${s}`;
  return s.startsWith("+") ? s : `+${s}`;
}

function newTicketCode(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return `LNN-${bytes[0].toString(36).toUpperCase()}${bytes[1].toString(36).toUpperCase()}`;
}

/**
 * Ticket creation is deliberately server-only and requires an already
 * confirmed payment belonging to the authenticated user.
 *
 * DEMO NOTE: the current payment confirmation itself is still simulated.
 * Once Mobile Money/LONANI is integrated, the confirmation authority must
 * move to a verified provider webhook/API; this function remains the
 * server-side gate that creates the ticket only after that confirmation.
 */
export const createTicketAfterPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createTicketSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, status, ticket_id, amount, game_id, reference")
      .eq("reference", data.paymentReference)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (paymentError) throw new Error(paymentError.message);
    if (!payment) throw new Error("payment_not_found");
    if (payment.status !== "confirmed") throw new Error("payment_not_confirmed");
    if (payment.ticket_id) throw new Error("payment_already_linked");
    if (payment.amount !== data.stake) throw new Error("payment_amount_mismatch");
    if (payment.game_id !== data.gameId) throw new Error("payment_game_mismatch");

    const code = newTicketCode();
    const legs = data.legs?.map((leg, index) => ({
      ...leg,
      legId: leg.legId || `${code}-${index}`,
    }));

    const insert: Database["public"]["Tables"]["tickets"]["Insert"] = {
      user_id: context.userId,
      code,
      game_id: data.gameId,
      game_name: data.gameName,
      picks: data.picks as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["picks"],
      picks_label: data.picksLabel,
      stake: data.stake,
      payment_method: data.payment,
      draw_date: data.drawDate ? data.drawDate.slice(0, 10) : null,
      draw_name: data.drawName ?? null,
      status: "pending",
      legs: (legs ?? []) as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["legs"],
      phone: toE164(data.phone),
      region: data.region ?? null,
    };

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .insert(insert)
      .select()
      .single();

    if (ticketError) throw new Error(ticketError.message);

    const { error: linkError } = await supabaseAdmin
      .from("payments")
      .update({ ticket_id: ticket.id })
      .eq("id", payment.id)
      .eq("user_id", context.userId)
      .eq("status", "confirmed")
      .is("ticket_id", null);

    if (linkError) {
      // Do not leave a confirmed payment silently pointing nowhere. The
      // ticket exists and can be recovered/reconciled by an admin.
      throw new Error(linkError.message);
    }

    return { ticket };
  });
