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

const footPickSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[^:]{1,40}:.{1,100}$/i);

const FOOT_MARKETS: Record<string, Set<string>> = {
  "1x2": new Set(["1", "X", "2"]),
  "dc": new Set(["1X", "12", "X2"]),
  "ou": new Set(["o05", "u05", "o15", "u15", "o25", "u25", "o35", "u35"]),
  "btts": new Set(["yes", "no"]),
  "cs": new Set(["1:0", "2:0", "2:1", "3:1", "3:2", "0:0", "1:1", "2:2", "0:1", "0:2", "1:2", "1:3"]),
  "ht": new Set(["1", "X", "2"]),
  "cards": new Set(["o25", "u25", "o45", "u45"]),
  "corners": new Set(["o75", "u75", "o95", "u95"]),
  "scorer": new Set(["home_star", "home_mid", "away_star", "away_mid"]),
};

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

function ticketCodeFromPayment(paymentId: string): string {
  // The same payment must always map to the same public ticket code. This
  // makes concurrent retries fail closed on the database unique constraint
  // instead of creating two tickets for one confirmed payment.
  const compact = paymentId.replace(/-/g, "").slice(-12).toUpperCase();
  return `LNN-${compact}`;
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
    if (!["pmu", "loto", "foot"].includes(data.gameId)) throw new Error("invalid_game");

    // Les données d’identité ne doivent pas être choisies librement par le navigateur.
    // Le numéro du ticket doit correspondre au profil authentifié.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("profile_lookup_failed: " + profileError.message);
    const profilePhone = profile?.phone ? toE164(profile.phone) : null;
    const submittedPhone = toE164(data.phone);
    if (!profilePhone || !submittedPhone || profilePhone !== submittedPhone) throw new Error("phone_mismatch");
    if (data.payment.trim().length === 0) throw new Error("invalid_payment_method");
    if (data.gameName.trim().length === 0) throw new Error("invalid_game_name");
    const drawDate = data.drawDate ? data.drawDate.slice(0, 10) : "";
    if (drawDate && !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) throw new Error("invalid_draw_date");
    if (drawDate && drawDate < new Date().toISOString().slice(0, 10)) throw new Error("draw_closed");

    const code = ticketCodeFromPayment(payment.id);
    if (data.legs?.length) {
      if (data.legs.some((leg) => leg.gameId !== data.gameId)) throw new Error("ticket_leg_game_mismatch");
      const legsStake = data.legs.reduce((sum, leg) => sum + leg.stake, 0);
      if (legsStake !== data.stake) throw new Error("ticket_leg_stake_mismatch");
    }
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
      draw_date: drawDate || null,
      draw_name: data.drawName ?? null,
      status: "pending",
      legs: (legs ?? []) as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["legs"],
      phone: toE164(data.phone),
      region: data.region ?? null,
    };

    // Les paris foot sont enregistrés côté serveur. Le client ne peut donc
    // plus fabriquer directement une ligne foot_picks avec un autre user_id,
    // un autre match ou un marché arbitraire.
    const footPickKeys = data.gameId === "foot"
      ? (data.picks as unknown[]).filter((p): p is string => typeof p === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[^:]{1,40}:.{1,100}$/i.test(p))
      : [];
    if (data.gameId === "foot" && footPickKeys.length === 0) throw new Error("missing_foot_picks");
    if (data.gameId === "foot" && footPickKeys.length > 0) {
      const seenMarkets = new Set<string>();
      for (const key of footPickKeys) {
        const parsed = footPickSchema.safeParse(key);
        if (!parsed.success) throw new Error("invalid_foot_pick");
        const parts = key.split(":");
        const fixtureId = parts[0];
        const marketId = parts[1];
        const optionKey = parts.slice(2).join(":");
        const allowed = FOOT_MARKETS[marketId];
        if (!allowed || !allowed.has(optionKey)) throw new Error("invalid_foot_market_selection");
        const marketKey = fixtureId + ":" + marketId;
        if (seenMarkets.has(marketKey)) throw new Error("multiple_selections_same_market");
        seenMarkets.add(marketKey);

        const { data: fixture, error: fixtureError } = await supabaseAdmin
          .from("foot_fixtures")
          .select("id, kickoff_at, status")
          .eq("id", fixtureId)
          .maybeSingle();
        if (fixtureError) throw new Error("fixture_lookup_failed: " + fixtureError.message);
        if (!fixture) throw new Error("fixture_not_found");
        if (fixture.status !== "scheduled" || new Date(fixture.kickoff_at).getTime() <= Date.now()) {
          throw new Error("fixture_closed");
        }
      }
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .insert(insert)
      .select()
      .single();

    if (ticketError) throw new Error(ticketError.message);

    if (data.gameId === "foot" && footPickKeys.length > 0) {
      const byFixture = new Map<string, { marketId: string; selection: string; odds: number; status: "pending" }[]>();
      for (const key of footPickKeys) {
        const parts = key.split(":");
        const fixtureId = parts[0];
        const marketId = parts[1];
        const selection = parts.slice(2).join(":");
        const list = byFixture.get(fixtureId) ?? [];
        list.push({ marketId, selection, odds: 1, status: "pending" });
        byFixture.set(fixtureId, list);
      }
      const rows = Array.from(byFixture.entries()).map(([fixtureId, picks]) => ({
        user_id: context.userId,
        fixture_id: fixtureId,
        ticket_id: ticket.id,
        picks,
        status: "pending" as const,
      }));
      const { error: pickError } = await supabaseAdmin.from("foot_picks").insert(rows);
      if (pickError) {
        await supabaseAdmin.from("tickets").delete().eq("id", ticket.id).eq("user_id", context.userId);
        throw new Error("foot_pick_insert_failed: " + pickError.message);
      }
    }

    const { data: linkedPayment, error: linkError } = await supabaseAdmin
      .from("payments")
      .update({ ticket_id: ticket.id })
      .eq("id", payment.id)
      .eq("user_id", context.userId)
      .eq("status", "confirmed")
      .is("ticket_id", null)
      .select("id")
      .maybeSingle();

    if (linkError) {
      await supabaseAdmin.from("foot_picks").delete().eq("ticket_id", ticket.id).eq("user_id", context.userId);
      await supabaseAdmin.from("tickets").delete().eq("id", ticket.id).eq("user_id", context.userId);
      throw new Error(linkError.message);
    }
    if (!linkedPayment) {
      await supabaseAdmin.from("foot_picks").delete().eq("ticket_id", ticket.id).eq("user_id", context.userId);
      await supabaseAdmin.from("tickets").delete().eq("id", ticket.id).eq("user_id", context.userId);
      throw new Error("payment_link_failed");
    }

    return { ticket };
  });
