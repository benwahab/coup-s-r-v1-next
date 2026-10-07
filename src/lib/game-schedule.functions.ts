import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "./audit.server";

const scheduleSchema = z.object({
  gameId: z.enum(["pmu", "loto"]),
  openHour: z.number().int().min(0).max(23),
  closeHour: z.number().int().min(0).max(23),
  drawHour: z.number().int().min(0).max(23),
  drawMinute: z.number().int().min(0).max(59),
  enabled: z.boolean(),
  dailyStatsDate: z.string().date(),
  todayWinnersCount: z.number().int().min(0).nullable(),
  todayPaidFcfa: z.number().int().min(0).nullable(),
});

async function assertOperationsPermission(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: "operations",
  });
  if (error) throw new Error("permission_check_failed");
  if (data !== true) throw new Error("Forbidden: operations permission required");
}

export const getGameSchedules = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("game_schedules")
      .select("game_id,open_hour,close_hour,draw_hour,draw_minute,timezone,enabled,updated_at")
      .order("game_id");
    if (error) throw new Error("schedule_lookup_failed: " + error.message);
    return data ?? [];
  });

export const adminUpdateGameSchedule = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => scheduleSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertOperationsPermission(context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("game_schedules")
      .upsert(
        {
          game_id: data.gameId,
          open_hour: data.openHour,
          close_hour: data.closeHour,
          draw_hour: data.drawHour,
          draw_minute: data.drawMinute,
          timezone: "Africa/Niamey",
          enabled: data.enabled,
          daily_stats_date: data.dailyStatsDate,
          today_winners_count: data.todayWinnersCount,
          today_paid_fcfa: data.todayPaidFcfa,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "game_id" },
      )
      .select("game_id,open_hour,close_hour,draw_hour,draw_minute,timezone,enabled,updated_at")
      .single();

    if (error) throw new Error("schedule_update_failed: " + error.message);

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.game_schedule.updated",
      detail: {
        gameId: data.gameId,
        openHour: data.openHour,
        closeHour: data.closeHour,
        drawHour: data.drawHour,
        drawMinute: data.drawMinute,
        dailyStatsDate: data.dailyStatsDate,
        todayWinnersCount: data.todayWinnersCount,
        todayPaidFcfa: data.todayPaidFcfa,
      },
    });

    return row;
  });
