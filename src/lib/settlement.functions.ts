import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "./audit.server";
import { lotoMultipliers } from "./mock-data";

const gameIdSchema = z.enum(["pmu", "loto", "foot"]);
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
      })).min(1).max(500),
    }),
  }),
]);

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

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
}

export const adminCreateDrawResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => drawResultSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
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

function evaluateLoto(picks: unknown[], result: { numbers: number[] }, stake: number) {
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 5) return null;
  const winning = nums.every((n) => result.numbers.includes(n));
  return { winning, prize: winning ? stake * (lotoMultipliers[nums.length] ?? 1) : 0 };
}

function evaluatePmu(picks: unknown[], result: { horses: number[] }, stake: number) {
  const nums = picks.filter((p): p is number => typeof p === "number");
  if (nums.length < 1 || nums.length > 8) return null;
  const winning = nums.every((n) => result.horses.includes(n));
  // PMU payout rules are partner-dependent in the demo. Do not invent an
  // official dividend: a winning PMU ticket is marked winning with a
  // provisional stake-level prize until the official dividend is integrated.
  return { winning, prize: winning ? stake : 0 };
}

function evaluateFoot(picks: unknown[], result: { matches: { matchId: string; result: "1" | "X" | "2" }[] }) {
  const map = new Map(result.matches.map((m) => [m.matchId, m.result]));
  const keys = picks.filter((p): p is string => typeof p === "string");
  if (keys.length === 0) return null;
  for (const key of keys) {
    const [fixtureId, marketId, ...rest] = key.split(":");
    if (marketId !== "1x2") return null;
    const selected = rest.join(":");
    if (!["1", "X", "2"].includes(selected)) return null;
    if (map.get(fixtureId) !== selected) return { winning: false, prize: 0 };
  }
  return { winning: true, prize: 0 };
}

async function settleTicket(ticket: TicketRow, result: { game_id: string; result: any }) {
  if (ticket.status !== "pending") return { changed: false, reason: "already_settled" };

  let evaluation: { winning: boolean; prize: number } | null = null;
  if (result.game_id === "loto") evaluation = evaluateLoto(Array.isArray(ticket.picks) ? ticket.picks : [], result.result, ticket.stake);
  if (result.game_id === "pmu") evaluation = evaluatePmu(Array.isArray(ticket.picks) ? ticket.picks : [], result.result, ticket.stake);
  if (result.game_id === "foot") evaluation = evaluateFoot(Array.isArray(ticket.picks) ? ticket.picks : [], result.result);

  if (!evaluation) return { changed: false, reason: "unsupported_rule" };

  const nextStatus = evaluation.winning ? "winning" : "losing";
  const { data, error } = await supabaseAdmin
    .from("tickets")
    .update({ status: nextStatus, prize: evaluation.winning ? evaluation.prize : 0 })
    .eq("id", ticket.id)
    .eq("status", "pending")
    .select("id,status,prize")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { changed: false, reason: "concurrent_update" };
  return { changed: true, status: data.status, prize: data.prize };
}

export const adminPublishDrawResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    if (result.status === "published") return { ok: true as const, settled: 0 };
    
    const { data: published, error: publishError } = await supabaseAdmin
      .from("draw_results")
      .update({ status: "published", published_at: new Date().toISOString(), published_by: context.userId })
      .eq("id", result.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (publishError) throw new Error(publishError.message);
    if (!published) throw new Error("result_publish_conflict");

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("tickets")
      .select("id,code,user_id,game_id,draw_date,picks,stake,status,prize")
      .eq("game_id", result.game_id)
      .eq("draw_date", result.draw_date)
      .eq("status", "pending");
    if (ticketsError) throw new Error(ticketsError.message);

    let settled = 0;
    let winners = 0;
    let losers = 0;
    let skipped = 0;
    for (const ticket of (tickets ?? []) as TicketRow[]) {
      const out = await settleTicket(ticket, result);
      if (!out.changed) { skipped++; continue; }
      settled++;
      if (out.status === "winning") winners++;
      if (out.status === "losing") losers++;
    }

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.draw_result.published",
      detail: { resultId: result.id, gameId: result.game_id, drawDate: result.draw_date, settled, winners, losers, skipped },
    });

    return { ok: true as const, settled, winners, losers, skipped };
  });
