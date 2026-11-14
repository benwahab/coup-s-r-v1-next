import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import { nigerParts, nigerInstant } from "@/lib/schedule";
import { evaluatePublishedAiPredictions } from "./ai-adaptive.functions";

async function writeAuditLog(...args: Parameters<(typeof import("./audit.server"))["writeAuditLog"]>) {
  const { writeAuditLog } = await import("./audit.server");
  return writeAuditLog(...args);
}

const drawResultSchema = z.discriminatedUnion("gameId", [
  z.object({
    gameId: z.literal("loto"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    drawName: z.string().max(200).optional(),
    result: z
      .object({ numbers: z.array(z.number().int().min(1).max(90)).min(1).max(5) })
      .refine((v) => new Set(v.numbers).size === v.numbers.length, {
        message: "duplicate_loto_numbers",
      }),
  }),
  z.object({
    gameId: z.literal("pmu"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    raceId: z.string().uuid(),
    drawName: z.string().max(200).optional(),
    result: z.object({ horses: z.array(z.number().int().positive()).min(1).max(20) }),
  }),
  z.object({
    gameId: z.literal("foot"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    drawName: z.string().max(200).optional(),
    result: z.object({
      matches: z
        .array(
          z.object({
            matchId: z.string().min(1).max(100),
            result: z.enum(["1", "X", "2"]),
            homeGoals: z.number().int().min(0).max(30).optional(),
            awayGoals: z.number().int().min(0).max(30).optional(),
            halfTimeHomeGoals: z.number().int().min(0).max(30).optional(),
            halfTimeAwayGoals: z.number().int().min(0).max(30).optional(),
            yellowCards: z.number().int().min(0).max(50).optional(),
            corners: z.number().int().min(0).max(50).optional(),
            scorers: z.array(z.string().max(80)).max(30).optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
  }),
]);

type FootMatchResult = {
  matchId: string;
  result: "1" | "X" | "2";
  homeGoals?: number;
  awayGoals?: number;
  halfTimeHomeGoals?: number;
  halfTimeAwayGoals?: number;
  yellowCards?: number;
  corners?: number;
  scorers?: string[];
};

type TicketRow = {
  id: string;
  code: string;
  user_id: string;
  game_id: string;
  draw_date: string | null;
  picks: unknown;
  stake: number;
  status: "pending" | "losing" | "winning" | "paid";
  prize: number | null;
  loto_multiplier: number | null;
  pmu_race_id: string | null;
};

type StoredFootPick = {
  id: string;
  fixture_id: string;
  picks: unknown;
  status: "pending" | "losing" | "winning" | "paid";
};

async function assertPublishResultsPermission(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: "publish_results",
  });
  if (error) throw new Error("permission_check_failed");
  if (data !== true) throw new Error("Forbidden: publish_results permission required");
}

async function evaluateLoto(picks: unknown[], result: { numbers: number[] }, stake: number, frozenMultiplier: number | null) {
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 5 || new Set(nums).size !== nums.length) return null;
  if (
    frozenMultiplier == null ||
    !Number.isFinite(frozenMultiplier) ||
    frozenMultiplier < 1 ||
    frozenMultiplier > 100000
  ) {
    throw new Error("loto_frozen_rule_missing");
  }
  const winning = nums.every((n) => result.numbers.includes(n));
  return { winning, prize: winning ? Math.floor(stake * frozenMultiplier) : 0 };
}

async function evaluatePmu(
  picks: unknown[],
  result: { horses: number[] },
  stake: number,
  drawDate: string,
  pmuRaceId: string | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 8 || new Set(nums).size !== nums.length) return null;
  const winningNumbers = result.horses;
  if (new Set(winningNumbers).size !== winningNumbers.length) return null;
  if (!pmuRaceId) return null;

  const { data: race, error: raceError } = await supabaseAdmin
    .from("pmu_races")
    .select("id,status,start_at")
    .eq("id", pmuRaceId)
    .eq("race_date", drawDate)
    .in("status", ["finished"])
    .maybeSingle();
  if (raceError) throw new Error("pmu_race_lookup_failed: " + raceError.message);
  if (!race) return null;
  if (new Date(race.start_at).getTime() > Date.now()) return null;

  const { data: starters, error: startersError } = await supabaseAdmin
    .from("pmu_horses")
    .select("number")
    .eq("race_id", race.id)
    .eq("status", "partant");
  if (startersError) throw new Error("pmu_starters_lookup_failed: " + startersError.message);
  const validStarters = new Set(
    (starters ?? []).map((row) => Number(row.number)).filter(Number.isInteger),
  );
  if (!winningNumbers.every((n) => validStarters.has(n))) return null;

  const winning = nums.every((n) => winningNumbers.includes(n));
  // PMU payout amounts must come from an authoritative payout/rule source.
  // Never credit the stake as a fictitious prize.
  if (winning) throw new Error("pmu_payout_rule_not_configured");
  return { winning: false, prize: 0 };
}
function finalOutcome(homeGoals: number, awayGoals: number): "1" | "X" | "2" {
  if (homeGoals > awayGoals) return "1";
  if (homeGoals < awayGoals) return "2";
  return "X";
}

function thresholdSelection(value: number, selection: string): boolean | null {
  const m = selection.match(/^(o|u)(05|15|25|35|45|75|95)$/);
  if (!m) return null;
  const threshold = Number(m[2]) / 10;
  return m[1] === "o" ? value > threshold : value < threshold;
}

function evaluateFootSelection(
  m: FootMatchResult,
  marketId: string,
  selection: string,
): boolean | null {
  const fullTime = m.result;

  if (marketId === "1x2") return selection === fullTime;
  if (marketId === "dc") {
    if (selection === "1X") return fullTime === "1" || fullTime === "X";
    if (selection === "12") return fullTime === "1" || fullTime === "2";
    if (selection === "X2") return fullTime === "X" || fullTime === "2";
    return null;
  }

  if (marketId === "ou" || marketId === "btts" || marketId === "cs") {
    if (m.homeGoals == null || m.awayGoals == null) return null;
    const total = m.homeGoals + m.awayGoals;
    if (marketId === "ou") return thresholdSelection(total, selection);
    if (marketId === "btts") {
      const yes = m.homeGoals > 0 && m.awayGoals > 0;
      return selection === "yes" ? yes : selection === "no" ? !yes : null;
    }
    return `${m.homeGoals}:${m.awayGoals}` === selection;
  }

  if (marketId === "ht") {
    if (m.halfTimeHomeGoals == null || m.halfTimeAwayGoals == null) return null;
    return selection === finalOutcome(m.halfTimeHomeGoals, m.halfTimeAwayGoals);
  }

  if (marketId === "cards") {
    if (m.yellowCards == null) return null;
    return thresholdSelection(m.yellowCards, selection);
  }

  if (marketId === "corners") {
    if (m.corners == null) return null;
    return thresholdSelection(m.corners, selection);
  }

  if (marketId === "scorer") {
    if (!m.scorers) return null;
    return m.scorers.includes(selection);
  }

  return null;
}

async function settleFootTicket(ticket: TicketRow, results: Map<string, FootMatchResult>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: picks, error } = await supabaseAdmin
    .from("foot_picks")
    .select("id,fixture_id,picks,status")
    .eq("ticket_id", ticket.id);

  if (error) throw new Error("foot_picks_lookup_failed: " + error.message);
  const rows = (picks ?? []) as StoredFootPick[];
  if (rows.length === 0) return { changed: false, reason: "missing_foot_picks" };

  let couponLosing = false;
  let couponPending = false;
  let totalOdds = 1;
  const resolvedRows: { id: string; status: "winning" | "losing"; settledAt: string }[] = [];

  for (const row of rows) {
    const fixtureResult = results.get(row.fixture_id);
    const selections = Array.isArray(row.picks) ? row.picks : [];
    if (selections.length === 0) return { changed: false, reason: "invalid_foot_pick_row" };

    let rowPending = false;
    let rowLosing = false;
    for (const raw of selections) {
      if (!raw || typeof raw !== "object")
        return { changed: false, reason: "invalid_foot_pick_payload" };
      const pick = raw as { marketId?: unknown; selection?: unknown; odds?: unknown };
      const marketId = typeof pick.marketId === "string" ? pick.marketId : "";
      const selection = typeof pick.selection === "string" ? pick.selection : "";
      const odds = typeof pick.odds === "number" ? pick.odds : NaN;
      if (!marketId || !selection || !Number.isFinite(odds) || odds < 1 || odds > 1000) {
        return { changed: false, reason: "invalid_frozen_odds" };
      }

      totalOdds *= odds;
      if (!Number.isFinite(totalOdds) || totalOdds > 1e12) {
        throw new Error("foot_payout_overflow");
      }

      if (!fixtureResult) {
        rowPending = true;
        continue;
      }
      const passed = evaluateFootSelection(fixtureResult, marketId, selection);
      if (passed === false) rowLosing = true;
      if (passed === null) rowPending = true;
    }

    if (rowLosing) {
      couponLosing = true;
      resolvedRows.push({ id: row.id, status: "losing", settledAt: new Date().toISOString() });
    } else if (rowPending) {
      couponPending = true;
    } else {
      resolvedRows.push({ id: row.id, status: "winning", settledAt: new Date().toISOString() });
    }
  }

  // 1xbet-style combined coupon rule:
  // one failed selection kills the whole coupon immediately.
  // If none failed but at least one selection is unresolved, the coupon stays pending.
  // Only when every selection has passed does the coupon become winning.
  const nextStatus: "pending" | "losing" | "winning" = couponLosing
    ? "losing"
    : couponPending
      ? "pending"
      : "winning";
  const prize = nextStatus === "winning" ? Math.floor(ticket.stake * totalOdds) : 0;

  if (nextStatus === "pending") {
    return { changed: false, reason: "pending_results" };
  }

  const { data: settled, error: settlementError } = await supabaseAdmin.rpc(
    "settle_ticket_atomic",
    {
      p_ticket_id: ticket.id,
      p_status: nextStatus,
      p_prize: prize,
      p_leg_updates: resolvedRows,
      p_mark_all_foot_losing: nextStatus === "losing",
    },
  );

  if (settlementError) throw new Error("atomic_foot_settlement_failed: " + settlementError.message);
  const row = Array.isArray(settled) ? settled[0] : settled;
  if (!row) return { changed: false, reason: "already_settled" };
  return { changed: true, status: row.status, prize: row.prize };
}

type PublishedResultValue =
  | FootMatchResult
  | { matches?: FootMatchResult[] }
  | { numbers: number[] }
  | { horses: number[] };

type PublishedResult = { result?: PublishedResultValue };

async function settleTicket(ticket: TicketRow, publishedResults: PublishedResult[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (ticket.status !== "pending") return { changed: false, reason: "already_settled" };

  if (ticket.game_id === "foot") {
    const results = new Map<string, FootMatchResult>();
    for (const row of publishedResults) {
      const value = row?.result;
      if (
        value &&
        "matchId" in value &&
        typeof value.matchId === "string" &&
        ["1", "X", "2"].includes(value.result)
      ) {
        results.set(value.matchId, value as FootMatchResult);
      }
      // Backward compatibility for an older draft/published batch format.
      if (value && "matches" in value && Array.isArray(value.matches)) {
        for (const m of value.matches) {
          if (m?.matchId && ["1", "X", "2"].includes(m.result)) results.set(m.matchId, m);
        }
      }
    }
    return settleFootTicket(ticket, results);
  }

  const result = publishedResults[0];
  let evaluation: { winning: boolean; prize: number } | null = null;
  if (ticket.game_id === "loto")
    evaluation = await evaluateLoto(
      Array.isArray(ticket.picks) ? ticket.picks : [],
      result?.result as { numbers: number[] },
      ticket.stake,
      ticket.loto_multiplier,
    );
  if (ticket.game_id === "pmu")
    evaluation = await evaluatePmu(
      Array.isArray(ticket.picks) ? ticket.picks : [],
      result?.result as { horses: number[] },
      ticket.stake,
      ticket.draw_date ?? "",
      ticket.pmu_race_id,
    );
  if (!evaluation) return { changed: false, reason: "unsupported_rule" };

  const nextStatus = evaluation.winning ? "winning" : "losing";
  const { data: settled, error: settlementError } = await supabaseAdmin.rpc(
    "settle_ticket_atomic",
    {
      p_ticket_id: ticket.id,
      p_status: nextStatus,
      p_prize: evaluation.winning ? evaluation.prize : 0,
      p_leg_updates: [],
      p_mark_all_foot_losing: false,
    },
  );
  if (settlementError) throw new Error("atomic_settlement_failed: " + settlementError.message);
  const row = Array.isArray(settled) ? settled[0] : settled;
  if (!row) return { changed: false, reason: "already_settled" };
  return { changed: true, status: row.status, prize: row.prize };
}

export const adminCreateDrawResult = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => drawResultSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPublishResultsPermission(context.supabase, context.userId);

    if (data.gameId === "loto") {
      const now = new Date();
      const today = nigerParts(now);
      const drawDateToday = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
      if (data.drawDate > drawDateToday) throw new Error("loto_result_future_date");
      if (data.drawDate === drawDateToday) {
        const { data: schedule, error: scheduleError } = await supabaseAdmin
          .from("game_schedules")
          .select("draw_hour,draw_minute,enabled")
          .eq("game_id", "loto")
          .maybeSingle();
        if (scheduleError) throw new Error("schedule_lookup_failed: " + scheduleError.message);
        if (!schedule?.enabled) throw new Error("game_schedule_disabled");
        const drawAt = nigerInstant(
          today.year,
          today.month,
          today.day,
          schedule.draw_hour,
          schedule.draw_minute,
        );
        if (now < drawAt) throw new Error("loto_draw_not_reached");
      }
    }

    if (data.gameId === "pmu") {
      if (new Set(data.result.horses).size !== data.result.horses.length) {
        throw new Error("pmu_result_duplicate_horse");
      }
      const { data: race, error: raceError } = await supabaseAdmin
        .from("pmu_races")
        .select("id,status,start_at,race_date")
        .eq("id", data.raceId)
        .eq("race_date", data.drawDate)
        .maybeSingle();
      if (raceError) throw new Error("pmu_race_lookup_failed: " + raceError.message);
      if (!race) throw new Error("pmu_finished_race_not_found");
      if (new Date(race.start_at).getTime() > Date.now()) throw new Error("pmu_race_not_finished");
      const { data: starters, error: startersError } = await supabaseAdmin
        .from("pmu_horses")
        .select("number")
        .eq("race_id", race.id)
        .eq("status", "partant");
      if (startersError) throw new Error("pmu_starters_lookup_failed: " + startersError.message);
      const validStarters = new Set(
        (starters ?? []).map((row) => Number(row.number)).filter(Number.isInteger),
      );
      if (!data.result.horses.every((n) => validStarters.has(n)))
        throw new Error("pmu_result_contains_non_starter");
    }

    if (data.gameId === "foot") {
      throw new Error("foot_results_are_provider_managed");
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("draw_results")
      .select("id,status")
      .eq("game_id", data.gameId)
      .eq("draw_date", data.drawDate)
      .in("status", ["pending", "published"])
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing?.status === "published") throw new Error("result_already_published");
    if (existing?.status === "pending") throw new Error("result_pending_approval");

    const { data: row, error } = await supabaseAdmin
      .from("draw_results")
      .insert({
        game_id: data.gameId,
        draw_date: data.drawDate,
        draw_name: data.drawName ?? null,
        result: data.result,
        status: "pending",
        pmu_race_id: data.gameId === "pmu" ? data.raceId : null,
      })
      .select("id,game_id,draw_date,status")
      .single();
    if (error) throw new Error(error.message);


    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.draw_result.created",
      detail: { resultId: row.id, gameId: data.gameId, drawDate: data.drawDate },
    });
    return { result: row };
  });

export const adminApproveDrawResult = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ resultId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSuperAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error("role_check_failed");
    if (isSuperAdmin !== true) throw new Error("Forbidden: super_admin role required");

    const { data: result, error: resultError } = await supabaseAdmin
      .from("draw_results")
      .select("id,game_id,draw_date,draw_name,result,status,pmu_race_id")
      .eq("id", data.resultId)
      .maybeSingle();
    if (resultError) throw new Error(resultError.message);
    if (!result) throw new Error("result_not_found");
    if (result.status !== "pending") throw new Error("result_not_pending_approval");

    const { data: published, error: publishError } = await supabaseAdmin
      .from("draw_results")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_by: context.userId,
      })
      .eq("id", result.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (publishError) throw new Error(publishError.message);
    if (!published) throw new Error("result_publish_conflict");
    const wasAlreadyPublished = false;

    const aiReference =
      result.game_id === "loto"
        ? result.draw_date
        : result.game_id === "pmu"
          ? result.pmu_race_id
          : result.id;
    if (aiReference) {
      if (!wasAlreadyPublished) await evaluatePublishedAiPredictions(result.game_id, aiReference, result.result);
    }

    let publishedResultsQuery = supabaseAdmin
      .from("draw_results")
      .select("id,game_id,draw_date,result,status,pmu_race_id")
      .eq("game_id", result.game_id)
      .eq("draw_date", result.draw_date)
      .eq("status", "published");
    if (result.game_id === "pmu") {
      if (!result.pmu_race_id) throw new Error("pmu_result_race_id_missing");
      publishedResultsQuery = publishedResultsQuery.eq("pmu_race_id", result.pmu_race_id);
    }
    const { data: publishedResults, error: publishedResultsError } = await publishedResultsQuery;
    if (publishedResultsError) throw new Error(publishedResultsError.message);

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id,code,user_id,game_id,draw_date,picks,stake,status,prize,loto_multiplier,pmu_race_id")
      .eq("game_id", result.game_id)
      .eq("draw_date", result.draw_date)
      .eq("status", "pending");
    if (ticketsError) throw new Error(ticketsError.message);

    let settled = 0,
      winners = 0,
      losers = 0,
      skipped = 0;
    for (const ticket of (tickets ?? []) as TicketRow[]) {
      const out = await settleTicket(ticket, (publishedResults ?? []) as PublishedResult[]);
      if (!out.changed) {
        skipped++;
        continue;
      }
      settled++;
      if (out.status === "winning") winners++;
      if (out.status === "losing") losers++;
    }

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.draw_result.approved_and_published",
      detail: {
        resultId: result.id,
        gameId: result.game_id,
        drawDate: result.draw_date,
        settled,
        winners,
        losers,
        skipped,
        approvedBySuperAdmin: true,
      },
    });

    return { ok: true as const, settled, winners, losers, skipped };
  });

/**
 * Cash-out gate: the server is the only authority allowed to mark a winning
 * coupon as paid. Until a real payout provider is configured, no money movement
 * or paid transition is performed.
 */
export const requestCashout = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .select("id,code,user_id,status,prize")
      .eq("code", data.code)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("ticket_not_found");
    if (ticket.status !== "winning") throw new Error("cashout_not_available");
    if (ticket.prize == null || !Number.isInteger(ticket.prize) || ticket.prize <= 0)
      throw new Error("invalid_prize");
    throw new Error("cashout_provider_not_configured");
  });
