import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "./audit.server";
import { lotoMultipliers } from "./mock-data";

const drawResultSchema = z.discriminatedUnion("gameId", [
  z.object({
    gameId: z.literal("loto"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    drawName: z.string().max(200).optional(),
    result: z.object({ numbers: z.array(z.number().int().min(1).max(90)).min(1).max(5) }),
  }),
  z.object({
    gameId: z.literal("pmu"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    drawName: z.string().max(200).optional(),
    result: z.object({ horses: z.array(z.number().int().positive()).min(1).max(20) }),
  }),
  z.object({
    gameId: z.literal("foot"),
    drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    drawName: z.string().max(200).optional(),
    result: z.object({
      matches: z.array(z.object({
        matchId: z.string().min(1).max(100),
        result: z.enum(["1", "X", "2"]),
        homeGoals: z.number().int().min(0).max(30).optional(),
        awayGoals: z.number().int().min(0).max(30).optional(),
        halfTimeHomeGoals: z.number().int().min(0).max(30).optional(),
        halfTimeAwayGoals: z.number().int().min(0).max(30).optional(),
        yellowCards: z.number().int().min(0).max(50).optional(),
        corners: z.number().int().min(0).max(50).optional(),
        scorers: z.array(z.string().max(80)).max(30).optional(),
      })).min(1).max(500),
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
};

type StoredFootPick = {
  id: string;
  fixture_id: string;
  picks: unknown;
  status: "pending" | "losing" | "winning" | "paid";
};

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
}

function evaluateLoto(picks: unknown[], result: { numbers: number[] }, stake: number) {
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 5) return null;
  const winning = nums.every((n) => result.numbers.includes(n));
  return { winning, prize: winning ? Math.floor(stake * (lotoMultipliers[nums.length] ?? 1)) : 0 };
}

function evaluatePmu(picks: unknown[], result: { horses: number[] }, stake: number) {
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 8) return null;
  const winning = nums.every((n) => result.horses.includes(n));
  return { winning, prize: winning ? stake : 0 };
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

function evaluateFootSelection(m: FootMatchResult, marketId: string, selection: string): boolean | null {
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
      if (!raw || typeof raw !== "object") return { changed: false, reason: "invalid_foot_pick_payload" };
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
  const nextStatus: "pending" | "losing" | "winning" =
    couponLosing ? "losing" : couponPending ? "pending" : "winning";
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

async function settleTicket(ticket: TicketRow, publishedResults: any[]) {
  if (ticket.status !== "pending") return { changed: false, reason: "already_settled" };

  if (ticket.game_id === "foot") {
    const results = new Map<string, FootMatchResult>();
    for (const row of publishedResults) {
      const value = row?.result;
      if (value && typeof value.matchId === "string" && ["1", "X", "2"].includes(value.result)) {
        results.set(value.matchId, value as FootMatchResult);
      }
      // Backward compatibility for an older draft/published batch format.
      if (Array.isArray(value?.matches)) {
        for (const m of value.matches) {
          if (m?.matchId && ["1", "X", "2"].includes(m.result)) results.set(m.matchId, m);
        }
      }
    }
    return settleFootTicket(ticket, results);
  }

  const result = publishedResults[0];
  let evaluation: { winning: boolean; prize: number } | null = null;
  if (ticket.game_id === "loto") evaluation = evaluateLoto(Array.isArray(ticket.picks) ? ticket.picks : [], result?.result, ticket.stake);
  if (ticket.game_id === "pmu") evaluation = evaluatePmu(Array.isArray(ticket.picks) ? ticket.picks : [], result?.result, ticket.stake);
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
    await assertAdmin(context.userId);

    if (data.gameId === "foot") {
      const createdIds: string[] = [];
      for (const match of data.result.matches) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("draw_results")
          .select("id,status,result")
          .eq("game_id", "foot")
          .eq("draw_date", data.drawDate)
          .filter("result->>matchId", "eq", match.matchId)
          .maybeSingle();

        if (existingError) throw new Error(existingError.message);
        if (existing?.status === "published") throw new Error("foot_match_result_already_published");
        if (existing) throw new Error("foot_match_result_draft_exists");

        const { data: row, error } = await supabaseAdmin
          .from("draw_results")
          .insert({
            game_id: "foot",
            draw_date: data.drawDate,
            draw_name: data.drawName ?? null,
            result: match,
            status: "draft",
          })
          .select("id,game_id,draw_date,status")
          .single();
        if (error) throw new Error(error.message);
        createdIds.push(row.id);
      }

      await writeAuditLog(supabaseAdmin, {
        userId: context.userId,
        action: "admin.foot_results.created",
        detail: { drawDate: data.drawDate, count: createdIds.length, resultIds: createdIds },
      });
      return { result: { id: createdIds[0] }, resultIds: createdIds };
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("draw_results")
      .select("id,status")
      .eq("game_id", data.gameId)
      .eq("draw_date", data.drawDate)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing?.status === "published") throw new Error("result_already_published");
    if (existing) throw new Error("result_draft_exists");

    const { data: row, error } = await supabaseAdmin
      .from("draw_results")
      .insert({
        game_id: data.gameId,
        draw_date: data.drawDate,
        draw_name: data.drawName ?? null,
        result: data.result,
        status: "draft",
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

export const adminPublishDrawResult = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ resultId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const { data: result, error: resultError } = await supabaseAdmin
      .from("draw_results")
      .select("id,game_id,draw_date,draw_name,result,status")
      .eq("id", data.resultId)
      .maybeSingle();
    if (resultError) throw new Error(resultError.message);
    if (!result) throw new Error("result_not_found");
    const wasAlreadyPublished = result.status === "published";

    const { data: published, error: publishError } = await supabaseAdmin
      .from("draw_results")
      .update({ status: "published", published_at: new Date().toISOString(), published_by: context.userId })
      .eq("id", result.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (publishError) throw new Error(publishError.message);
    if (!published && !wasAlreadyPublished) throw new Error("result_publish_conflict");

    const { data: publishedResults, error: publishedResultsError } = await supabaseAdmin
      .from("draw_results")
      .select("id,game_id,draw_date,result,status")
      .eq("game_id", result.game_id)
      .eq("draw_date", result.draw_date)
      .eq("status", "published");
    if (publishedResultsError) throw new Error(publishedResultsError.message);

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id,code,user_id,game_id,draw_date,picks,stake,status,prize")
      .eq("game_id", result.game_id)
      .eq("draw_date", result.draw_date)
      .eq("status", "pending");
    if (ticketsError) throw new Error(ticketsError.message);

    let settled = 0, winners = 0, losers = 0, skipped = 0;
    for (const ticket of (tickets ?? []) as TicketRow[]) {
      const out = await settleTicket(ticket, publishedResults ?? []);
      if (!out.changed) { skipped++; continue; }
      settled++;
      if (out.status === "winning") winners++;
      if (out.status === "losing") losers++;
    }

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.draw_result.published",
      detail: {
        resultId: result.id,
        gameId: result.game_id,
        drawDate: result.draw_date,
        settled,
        winners,
        losers,
        skipped,
        alreadyPublished: wasAlreadyPublished,
      },
    });

    return { ok: true as const, settled, winners, losers, skipped };
  });


/**
 * Demo cash-out gate.
 *
 * The server is the only authority allowed to mark a winning coupon as paid.
 * In production this transition must happen only after a verified LONANI/payment
 * provider payout confirmation. No external money movement is performed here.
 */
export const requestCashout = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ code: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .select("id,code,user_id,status,prize,phone")
      .eq("code", data.code)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("ticket_not_found");
    if (ticket.status !== "winning") throw new Error("cashout_not_available");
    if (!Number.isInteger(ticket.prize) || ticket.prize <= 0) throw new Error("invalid_prize");

    const { data: paid, error: updateError } = await supabaseAdmin
      .from("tickets")
      .update({ status: "paid" })
      .eq("id", ticket.id)
      .eq("user_id", context.userId)
      .eq("status", "winning")
      .select("id,status,prize")
      .maybeSingle();

    if (updateError) throw new Error(updateError.message);
    if (!paid) throw new Error("cashout_conflict");

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "ticket.cashout.demo",
      detail: {
        ticketId: ticket.id,
        code: ticket.code,
        prize: ticket.prize,
        destinationPhone: ticket.phone,
        mode: "demo",
      },
    });

    return { ok: true as const, status: "paid" as const, prize: paid.prize };
  });
