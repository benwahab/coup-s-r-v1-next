import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import { lotoMultipliers } from "@/lib/mock-data";
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

const footPickSchema = z.string().regex(/^[^:]{1,100}:[^:]{1,40}:.{1,100}$/);

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
 * Payment confirmation is NOT simulated. A ticket can only be created after
 * the payment record has been confirmed by the real payment integration.
 */
export const createTicketAfterPayment = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => createTicketSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, user_id, status, ticket_id, amount, game_id, reference, method")
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
      .select("phone, first_name, last_name, region")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("profile_lookup_failed: " + profileError.message);
    const profilePhone = profile?.phone ? toE164(profile.phone) : null;
    const submittedPhone = toE164(data.phone);
    if (!profilePhone || !submittedPhone || profilePhone !== submittedPhone) throw new Error("phone_mismatch");
    if (!payment.method || payment.method !== data.payment) throw new Error("payment_method_mismatch");
    const drawDate = data.drawDate ? data.drawDate.slice(0, 10) : "";
    if (drawDate && !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) throw new Error("invalid_draw_date");
    if (drawDate && drawDate < new Date().toISOString().slice(0, 10)) throw new Error("draw_closed");

    const code = ticketCodeFromPayment(payment.id);

    // Integrity checks for the demo game catalog. The browser may submit any
    // JSON it wants, so PMU/Loto selections are revalidated against the same
    // canonical definitions used by the UI before a ticket is persisted.
    const validatePicks = async (gameId: string, picks: Array<string | number>) => {
      const nums = picks.filter((p): p is number => typeof p === "number");
      if (gameId === "loto") {
        if (nums.length < 1 || nums.length > 5 || nums.length !== picks.length) {
          throw new Error("invalid_loto_selection");
        }
        const unique = new Set(nums);
        if (unique.size !== nums.length || nums.some((n) => !Number.isInteger(n) || n < 1 || n > 90)) {
          throw new Error("invalid_loto_selection");
        }
      } else if (gameId === "pmu") {
        if (nums.length < 1 || nums.length > 8 || nums.length !== picks.length) {
          throw new Error("invalid_pmu_selection");
        }
        const unique = new Set(nums);
        if (unique.size !== nums.length || nums.some((n) => !Number.isInteger(n) || n < 1)) {
          throw new Error("invalid_pmu_selection");
        }
        // PMU starters are validated against the real scheduled race, never
        // against a client-side/mock catalog.
        const pmuDb = supabaseAdmin as any;
        const today = new Date().toISOString().slice(0, 10);
        const { data: races, error: raceError } = await pmuDb
          .from("pmu_races")
          .select("id,start_at,status")
          .eq("race_date", today)
          .in("status", ["scheduled", "open"])
          .order("start_at", { ascending: true })
          .limit(1);
        if (raceError || !races?.[0]) throw new Error("pmu_race_not_found");
        if (new Date(races[0].start_at).getTime() <= Date.now()) throw new Error("pmu_race_closed");
        const { data: starters, error: startersError } = await pmuDb
          .from("pmu_horses")
          .select("number,status")
          .eq("race_id", races[0].id);
        if (startersError) throw new Error("pmu_starters_lookup_failed");
        const validPartants = new Set((starters ?? [])
          .filter((h: { status: string }) => h.status === "partant")
          .map((h: { number: number }) => h.number));
        if (nums.some((n) => !validPartants.has(n))) throw new Error("invalid_pmu_selection");
      }
    };

    await validatePicks(data.gameId, data.picks);
    for (const leg of data.legs ?? []) {
      if (leg.gameId !== data.gameId) throw new Error("ticket_leg_game_mismatch");
      await validatePicks(leg.gameId, leg.picks);
      if (leg.stake < 300 || leg.stake > 100_000) throw new Error("invalid_leg_stake");
    }

    if (data.gameId === "loto") {
      const count = data.picks.length;
      if (count < 1 || count > 5) throw new Error("invalid_loto_mode");
    }

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
      payment_method: payment.method,
      draw_date: drawDate || null,
      draw_name: data.drawName ?? null,
      status: "pending",
      legs: (legs ?? []) as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["legs"],
      phone: profilePhone,
      region: profile?.region ?? null,
    };

    // Les paris foot sont enregistrés côté serveur. Le client ne peut donc
    // plus fabriquer directement une ligne foot_picks avec un autre user_id,
    // un autre match ou un marché arbitraire.
    const footPickKeys = data.gameId === "foot"
      ? (data.picks as unknown[]).filter((p): p is string => typeof p === "string" && /^[^:]{1,100}:[^:]{1,40}:.{1,100}$/.test(p))
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

    const footPickRows = data.gameId === "foot" && footPickKeys.length > 0
      ? (() => {
          const byFixture = new Map<string, { marketId: string; selection: string; odds: number; status: "pending" }[]>();
          for (const key of footPickKeys) {
            const parts = key.split(":");
            const fixtureId = parts[0];
            const marketId = parts[1];
            const selection = parts.slice(2).join(":");
            const { data: fixture, error: oddsError } = await supabaseAdmin
              .from("foot_fixtures")
              .select("id,odds_home,odds_draw,odds_away,status,kickoff_at")
              .eq("id", fixtureId)
              .maybeSingle();
            if (oddsError) throw new Error("fixture_odds_lookup_failed");
            if (!fixture) throw new Error("fixture_not_found");
            const oddsByOption: Record<string, number | null> = {
              "1": fixture.odds_home,
              "X": fixture.odds_draw,
              "2": fixture.odds_away,
            };
            const odds = oddsByOption[selection];
            if (!Number.isFinite(odds) || (odds as number) < 1 || (odds as number) > 1000) {
              throw new Error("invalid_backend_odds");
            }
            const list = byFixture.get(fixtureId) ?? [];
            list.push({ marketId, selection, odds, status: "pending" });
            byFixture.set(fixtureId, list);
          }
          return Array.from(byFixture.entries()).map(([fixtureId, picks]) => ({
            fixture_id: fixtureId,
            picks,
          }));
        })()
      : [];

    const ticketPayload = {
      code,
      game_id: data.gameId,
      game_name: data.gameName,
      picks: data.picks,
      picks_label: data.picksLabel,
      stake: data.stake,
      payment_method: payment.method,
      draw_date: drawDate || null,
      draw_name: data.drawName ?? null,
      legs: legs ?? [],
      phone: profilePhone,
      region: profile?.region ?? null,
    };

    const { data: ticketId, error: atomicError } = await supabaseAdmin.rpc(
      "create_ticket_with_payment",
      {
        p_payment_id: payment.id,
        p_actor_user_id: context.userId,
        p_ticket: ticketPayload,
        p_foot_picks: footPickRows,
      },
    );

    if (atomicError) throw new Error("atomic_ticket_payment_failed: " + atomicError.message);
    if (!ticketId) throw new Error("ticket_creation_failed");

    const { data: ticket, error: ticketLookupError } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .eq("user_id", context.userId)
      .single();

    if (ticketLookupError) throw new Error("ticket_lookup_failed: " + ticketLookupError.message);

    return { ticket };
  });
