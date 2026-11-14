import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { requireConfiguredUser } from "./secure-user.functions";

type SB = SupabaseClient<Database>;

async function writeAuditLog(...args: Parameters<(typeof import("./audit.server"))["writeAuditLog"]>) {
  const { writeAuditLog } = await import("./audit.server");
  return writeAuditLog(...args);
}

const AdminPermission = z.enum([
  "complaints",
  "player_activity",
  "ball_stats",
  "publish_results",
  "player_stats",
  "region_stats",
  "security_logs",
  "supervision",
  "operations",
]);
export type AdminPermission = z.infer<typeof AdminPermission>;

export interface LotoBallWagerStat {
  ball: number;
  wagerCount: number;
  stakedAmount: number;
  soloWagerCount: number;
  comboWagerCount: number;
}

export interface LotoCombinationWagerStat {
  combination: string;
  wagerCount: number;
  stakedAmount: number;
}

export interface LotoBallStatistics {
  balls: LotoBallWagerStat[];
  combinations: LotoCombinationWagerStat[];
}

async function assertAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
}

async function assertAdminPermission(supabase: SB, userId: string, permission: AdminPermission) {
  const { data, error } = await supabase.rpc("has_admin_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error) throw new Error("permission_check_failed");
  if (data !== true) throw new Error("Forbidden: admin permission required");
}

async function assertSuperAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: super_admin role required");
}

export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: admin, error: adminError }, { data: superAdmin, error: superAdminError }] =
      await Promise.all([
        context.supabase.rpc("has_role", {
          _user_id: context.userId,
          _role: "admin",
        }),
        context.supabase.rpc("has_role", {
          _user_id: context.userId,
          _role: "super_admin",
        }),
      ]);

    // A failure in the ordinary-admin check must never prevent a super-admin
    // from being recognized. If both checks fail, surface the infrastructure
    // error instead of silently treating the authenticated user as unprivileged.
    if (adminError && superAdminError) throw new Error("role_check_failed");
    return { isAdmin: admin === true || superAdmin === true };
  });

export const getMyAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: superAdmin, error: superError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (superError) throw new Error("role_check_failed");
    if (superAdmin === true) {
      return { isSuperAdmin: true as const, permissions: "all" as AdminPermission[] | "all" };
    }
    const { data, error } = await context.supabase
      .from("admin_permissions")
      .select("permission")
      .eq("user_id", context.userId);
    if (error) throw new Error("permission_lookup_failed");
    return {
      isSuperAdmin: false as const,
      permissions: (data ?? []).map((row) => row.permission as AdminPermission),
    };
  });

export const checkIsSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (error) return { isSuperAdmin: false };
    return { isSuperAdmin: data === true };
  });

/**
 * Admin player activity and transaction access.
 *
 * SECURITY BOUNDARY:
 * - Access is restricted to the dedicated player_activity permission.
 * - Ticket rows expose only operational fields needed by the Transactions tab.
 * - Picks, legs and payment_key are never returned by this function.
 * - The player's Mobile Money secret/password is never persisted or exposed.
 */
/** Aggregate Loto wager exposure for the dedicated ball_stats admin capability.
 * No ticket IDs, player IDs, phones, selections-by-player or individual tickets are returned.
 */
export const adminGetLotoBallStatistics = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "ball_stats");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_loto_ball_statistics");
    if (error) throw new Error("ball_statistics_failed: " + error.message);
    const payload = (data ?? { balls: [], combinations: [] }) as unknown as {
      balls?: LotoBallWagerStat[];
      combinations?: LotoCombinationWagerStat[];
    };
    return {
      balls: payload.balls ?? [],
      combinations: payload.combinations ?? [],
    } satisfies LotoBallStatistics;
  });

export interface AdminTicketRow {
  id: string;
  code: string;
  userId: string;
  gameId: string;
  gameName: string;
  stake: number;
  paymentMethod: string;
  drawDate: string | null;
  status: "pending" | "losing" | "winning" | "paid";
  prize: number | null;
  phone: string | null;
  region: string | null;
  createdAt: string;
}

export const adminListTickets = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "player_activity");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(
        "id,code,user_id,game_id,game_name,stake,payment_method,draw_date,status,prize,phone,region,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return {
      tickets: (data ?? []).map((r) => ({
        id: r.id,
        code: r.code,
        userId: r.user_id,
        gameId: r.game_id,
        gameName: r.game_name,
        stake: r.stake,
        paymentMethod: r.payment_method,
        drawDate: r.draw_date,
        status: r.status,
        prize: r.prize,
        phone: r.phone,
        region: r.region,
        createdAt: r.created_at,
      })) satisfies AdminTicketRow[],
    };
  });


function niameyDateIso(value = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Niamey",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function niameyDayBounds(dateIso: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error("invalid_report_date");
  const startLocal = new Date(`${dateIso}T00:00:00+01:00`);
  if (!Number.isFinite(startLocal.getTime()) || niameyDateIso(startLocal) !== dateIso) {
    throw new Error("invalid_report_date");
  }
  const nextLocal = new Date(startLocal.getTime() + 86_400_000);
  return { start: startLocal.toISOString(), end: nextLocal.toISOString() };
}

function addNiameyDays(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Reliable accounting totals from the complete ticket dataset, calculated on the server. */
export const adminGetDashboardFinancialSummary = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = niameyDateIso();
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthBounds = {
      start: niameyDayBounds(monthStart).start,
      end: new Date(`${addNiameyDays(today, 1)}T00:00:00+01:00`).toISOString(),
    };
    const todayBounds = niameyDayBounds(today);
    const yesterdayBounds = niameyDayBounds(addNiameyDays(today, -1));

    const sumStakes = async (start: string, end: string) => {
      let total = 0;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabaseAdmin
          .from("tickets")
          .select("stake")
          .gte("created_at", start)
          .lt("created_at", end)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + 999);
        if (error) throw new Error("financial_summary_failed: " + error.message);
        const rows = data ?? [];
        total += rows.reduce((sum, row) => sum + row.stake, 0);
        if (rows.length < 1000) break;
      }
      return total;
    };

    const [monthTotal, todayTotal, yesterdayTotal] = await Promise.all([
      sumStakes(monthBounds.start, monthBounds.end),
      sumStakes(todayBounds.start, todayBounds.end),
      sumStakes(yesterdayBounds.start, yesterdayBounds.end),
    ]);
    return { monthTotal, todayTotal, yesterdayTotal, monthStart, today };
  });

export interface AdminDailyFinancialReport {
  date: string;
  totals: {
    ticketCount: number;
    stakes: number;
    prizesAwarded: number;
    prizesPaid: number;
    winnersCount: number;
    losingCount: number;
    pendingTicketsCount: number;
    unpaidWinningCount: number;
  };
  byGame: Array<{
    gameId: string;
    gameName: string;
    ticketCount: number;
    stakes: number;
    prizesAwarded: number;
    prizesPaid: number;
    winnersCount: number;
    losingCount: number;
    pendingCount: number;
  }>;
  byRegion: Array<{
    region: string;
    ticketCount: number;
    stakes: number;
    prizesAwarded: number;
    prizesPaid: number;
    winnersCount: number;
  }>;
  payments: {
    confirmedCount: number;
    confirmedAmount: number;
    pendingCount: number;
    pendingAmount: number;
  };
  tickets: Array<{
    code: string;
    gameId: string;
    gameName: string;
    region: string | null;
    stake: number;
    status: "pending" | "losing" | "winning" | "paid";
    prize: number;
    createdAt: string;
  }>;
}

export const adminGetDailyFinancialReport = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((input: unknown) => z.object({ date: z.string() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminDailyFinancialReport> => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { start, end } = niameyDayBounds(data.date);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tickets: AdminDailyFinancialReport["tickets"] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await supabaseAdmin
        .from("tickets")
        .select("code,game_id,game_name,region,stake,status,prize,created_at")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new Error("daily_ticket_report_failed: " + error.message);
      const batch = rows ?? [];
      tickets.push(...batch.map((row) => ({
        code: row.code,
        gameId: row.game_id,
        gameName: row.game_name || row.game_id,
        region: row.region,
        stake: row.stake,
        status: row.status,
        prize: row.prize ?? 0,
        createdAt: row.created_at,
      })));
      if (batch.length < 1000) break;
    }

    let confirmedCount = 0;
    let confirmedAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    for (let offset = 0; ; offset += 1000) {
      const { data: rows, error } = await supabaseAdmin
        .from("payments")
        .select("amount,status")
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new Error("daily_payment_report_failed: " + error.message);
      const batch = rows ?? [];
      for (const row of batch) {
        if (row.status === "confirmed") {
          confirmedCount += 1;
          confirmedAmount += row.amount;
        } else if (row.status === "pending") {
          pendingCount += 1;
          pendingAmount += row.amount;
        }
      }
      if (batch.length < 1000) break;
    }

    const gameMap = new Map<string, AdminDailyFinancialReport["byGame"][number]>([
      ["pmu", { gameId: "pmu", gameName: "PMU", ticketCount: 0, stakes: 0, prizesAwarded: 0, prizesPaid: 0, winnersCount: 0, losingCount: 0, pendingCount: 0 }],
      ["loto", { gameId: "loto", gameName: "Loto Balsa", ticketCount: 0, stakes: 0, prizesAwarded: 0, prizesPaid: 0, winnersCount: 0, losingCount: 0, pendingCount: 0 }],
      ["foot", { gameId: "foot", gameName: "Pari Foot", ticketCount: 0, stakes: 0, prizesAwarded: 0, prizesPaid: 0, winnersCount: 0, losingCount: 0, pendingCount: 0 }],
    ]);
    const regionMap = new Map<string, AdminDailyFinancialReport["byRegion"][number]>();
    const totals: AdminDailyFinancialReport["totals"] = {
      ticketCount: tickets.length,
      stakes: 0,
      prizesAwarded: 0,
      prizesPaid: 0,
      winnersCount: 0,
      losingCount: 0,
      pendingTicketsCount: 0,
      unpaidWinningCount: 0,
    };

    for (const ticket of tickets) {
      const gameId = ticket.gameId === "pmu" || ticket.gameId === "loto" || ticket.gameId === "foot"
        ? ticket.gameId
        : "other";
      const gameName = gameId === "pmu" ? "PMU" : gameId === "loto" ? "Loto Balsa" : gameId === "foot" ? "Pari Foot" : ticket.gameName;
      const game = gameMap.get(gameId) ?? {
        gameId, gameName, ticketCount: 0, stakes: 0, prizesAwarded: 0, prizesPaid: 0,
        winnersCount: 0, losingCount: 0, pendingCount: 0,
      };
      game.ticketCount += 1;
      game.stakes += ticket.stake;
      if (ticket.status === "winning" || ticket.status === "paid") {
        game.prizesAwarded += ticket.prize;
        game.winnersCount += 1;
      }
      if (ticket.status === "paid") game.prizesPaid += ticket.prize;
      if (ticket.status === "losing") game.losingCount += 1;
      if (ticket.status === "pending") game.pendingCount += 1;
      gameMap.set(gameId, game);

      const regionName = ticket.region?.trim() || "Non renseignée";
      const region = regionMap.get(regionName) ?? {
        region: regionName, ticketCount: 0, stakes: 0, prizesAwarded: 0, prizesPaid: 0, winnersCount: 0,
      };
      region.ticketCount += 1;
      region.stakes += ticket.stake;
      if (ticket.status === "winning" || ticket.status === "paid") {
        region.prizesAwarded += ticket.prize;
        region.winnersCount += 1;
      }
      if (ticket.status === "paid") region.prizesPaid += ticket.prize;
      regionMap.set(regionName, region);

      totals.stakes += ticket.stake;
      if (ticket.status === "winning" || ticket.status === "paid") {
        totals.prizesAwarded += ticket.prize;
        totals.winnersCount += 1;
      }
      if (ticket.status === "paid") totals.prizesPaid += ticket.prize;
      if (ticket.status === "losing") totals.losingCount += 1;
      if (ticket.status === "pending") totals.pendingTicketsCount += 1;
      if (ticket.status === "winning") totals.unpaidWinningCount += 1;
    }

    return {
      date: data.date,
      totals,
      byGame: [...gameMap.values()].sort((a, b) => a.gameName.localeCompare(b.gameName, "fr")),
      byRegion: [...regionMap.values()].sort((a, b) => a.region.localeCompare(b.region, "fr")),
      payments: { confirmedCount, confirmedAmount, pendingCount, pendingAmount },
      tickets: tickets.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  });

export interface AdminPlayerStat {
  player: string;
  region: string;
  tickets: number;
  staked: number;
  won: number;
}

export interface AdminRegionStat {
  region: string;
  players: number;
  tickets: number;
  staked: number;
  paid: number;
  delta7d: number;
}

export const adminGetPlayerStatistics = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "player_stats");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_admin_player_statistics");
    if (error) throw new Error("player_statistics_failed");
    return { players: Array.isArray(data) ? (data as unknown as AdminPlayerStat[]) : [] };
  });

export const adminGetRegionStatistics = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "region_stats");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_admin_region_statistics");
    if (error) throw new Error("region_statistics_failed");
    return { regions: Array.isArray(data) ? (data as unknown as AdminRegionStat[]) : [] };
  });

export const adminGetRegisteredPlayerCount = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "player_stats");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error("registered_player_count_failed: " + error.message);
    return { count: count ?? 0 };
  });

export const adminListPlayerActivities = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "player_activity");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("id,user_id,game_id,amount,method,status,reference,created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    return {
      payments: (data ?? []).map((row) => ({
        id: row.id,
        playerId: row.user_id,
        gameId: row.game_id,
        amount: row.amount,
        method: row.method,
        status: row.status,
        occurredAt: row.created_at,
        // Transaction reference is operational metadata, not a ticket.
        reference: row.reference,
      })),
    };
  });

/**
 * Super-admin dispute investigation.
 *
 * This is the ONLY administrative path that can inspect a player's complete
 * betting history. It is deliberately unavailable to ordinary admins.
 *
 * Never returns authentication credentials, passwords, OTPs or Mobile Money
 * PINs. Those secrets are not stored in the application data model.
 */
export const superAdminGetPlayerDisputeHistory = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: profile, error: profileError },
      { data: tickets, error: ticketsError },
      { data: payments, error: paymentsError },
      { data: ledger, error: ledgerError },
      { data: audit, error: auditError },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,phone,first_name,last_name,region,created_at")
        .eq("id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("tickets")
        .select("id,code,game_id,stake,payment_method,status,prize,legs,phone,region,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("payments")
        .select("id,game_id,amount,method,status,reference,ticket_id,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("financial_ledger")
        .select(
          "id,event_type,payment_id,ticket_id,reference,amount,prize,method,provider_reference,metadata,created_at",
        )
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("audit_logs")
        .select("id,action,detail,ip,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("player_not_found");
    if (ticketsError) throw new Error(ticketsError.message);
    if (paymentsError) throw new Error(paymentsError.message);
    if (ledgerError) throw new Error(ledgerError.message);
    if (auditError) throw new Error(auditError.message);

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "super_admin.player_dispute_history.viewed",
      detail: { targetUserId: data.userId },
    });

    return {
      profile,
      tickets: tickets ?? [],
      payments: payments ?? [],
      financialLedger: ledger ?? [],
      auditHistory: audit ?? [],
      // Explicitly no auth.users, password hashes, OTPs or Mobile Money PINs.
    };
  });

export const adminListAdmins = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const userIds = (roles ?? []).map((r) => r.user_id);
    if (userIds.length === 0) return { admins: [] };
    const [{ data: profiles, error: e2 }, { data: permissionRows, error: e3 }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, phone, first_name, last_name").in("id", userIds),
      supabaseAdmin.from("admin_permissions").select("user_id, permission").in("user_id", userIds),
    ]);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const permissionsByUser = new Map<string, string[]>();
    for (const row of permissionRows ?? [])
      permissionsByUser.set(row.user_id, [
        ...(permissionsByUser.get(row.user_id) ?? []),
        row.permission,
      ]);
    return {
      admins: (roles ?? []).map((r) => ({
        userId: r.user_id,
        grantedAt: r.created_at,
        phone: profileById.get(r.user_id)?.phone ?? null,
        firstName: profileById.get(r.user_id)?.first_name ?? null,
        lastName: profileById.get(r.user_id)?.last_name ?? null,
        permissions: permissionsByUser.get(r.user_id) ?? [],
      })),
    };
  });

export const adminListPermissions = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_permissions")
      .select("user_id, permission, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { permissions: data ?? [] };
  });

export const adminSetPermissions = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) =>
    z
      .object({ userId: z.string().uuid(), permissions: z.array(AdminPermission).max(20) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    if (data.userId === context.userId) throw new Error("cannot_change_own_admin_permissions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: permissionError } = await supabaseAdmin.rpc("set_admin_permissions_atomic", {
      p_actor_user_id: context.userId,
      p_target_user_id: data.userId,
      p_permissions: data.permissions,
    });
    if (permissionError) throw new Error(permissionError.message);
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.permissions.updated",
      detail: { targetUserId: data.userId, permissions: data.permissions },
    });
    return { ok: true as const, permissions: data.permissions };
  });

export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ phone: z.string().regex(/^\d{8}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { toE164Phone } = await import("./otp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: e1 } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", toE164Phone(data.phone))
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!profile) return { ok: false as const, reason: "no_account" as const };
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.id, role: "admin" })
      .select()
      .maybeSingle();
    if (e2 && e2.code !== "23505") throw new Error(e2.message);
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.role.granted",
      detail: { targetUserId: profile.id, role: "admin" },
    });
    return { ok: true as const };
  });

export const transferSuperAdminOwnership = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ targetUserId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    if (data.targetUserId === context.userId) {
      throw new Error("cannot_transfer_to_self");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("transfer_super_admin_ownership", {
      p_actor_user_id: context.userId,
      p_target_user_id: data.targetUserId,
    });
    if (error) throw new Error(error.message);

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "super_admin.ownership.transferred",
      detail: {
        fromUserId: context.userId,
        toUserId: data.targetUserId,
      },
    });

    return { ok: true as const, transferredTo: data.targetUserId };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    if (data.userId === context.userId)
      return { ok: false as const, reason: "cannot_self_revoke" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: revoked, error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!revoked) return { ok: false as const, reason: "role_not_found" as const };
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.role.revoked",
      detail: { targetUserId: data.userId, role: "admin" },
    });
    return { ok: true as const };
  });


export interface MonitoringSnapshot {
  windowMinutes: number;
  totalEvents: number;
  errorRate: number;
  timeoutRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  services: { service: string; events: number; errors: number; avgLatencyMs: number }[];
  recentEvents: {
    id: string;
    createdAt: string;
    source: string;
    level: string;
    service: string;
    endpoint: string | null;
    method: string | null;
    status: number | null;
    durationMs: number | null;
    traceId: string;
    environment: string;
    message: string | null;
  }[];
  incidents: {
    id: string;
    createdAt: string;
    startedAt: string;
    service: string;
    metric: string;
    severity: string;
    status: string;
    title: string;
    detail: string;
  }[];
  alertRules: { id: string; metric: string; threshold: number; enabled: boolean }[];
  dbStats: Record<string, string | number | boolean | null>;
}

export const adminGetMonitoringSnapshot = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "supervision");
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const [{ data: events, error: eventsError }, { data: rules, error: rulesError }, { data: incidents, error: incidentsError }] =
      await Promise.all([
        context.supabase
          .from("monitoring_events")
          .select("id,created_at,source,level,service,endpoint,method,status,duration_ms,trace_id,environment,message")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000),
        context.supabase
          .from("monitoring_alert_rules")
          .select("id,metric,threshold,enabled")
          .order("metric", { ascending: true }),
        context.supabase
          .from("monitoring_incidents")
          .select("id,created_at,started_at,service,metric,severity,status,title,detail")
          .in("status", ["open", "acknowledged"])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
    if (eventsError) throw new Error("monitoring_events_failed");
    if (rulesError) throw new Error("monitoring_rules_failed");
    if (incidentsError) throw new Error("monitoring_incidents_failed");

    const rows = events ?? [];
    const errors = rows.filter((e) => (e.status ?? 200) >= 500 || e.level === "ERROR" || e.level === "CRITICAL");
    const timeouts = rows.filter((e) => e.status === 408 || e.status === 504 || /timeout|timed out|délai/i.test(e.message ?? ""));
    const latencies = rows.map((e) => e.duration_ms).filter((v): v is number => typeof v === "number" && Number.isFinite(v)).sort((a,b) => a-b);
    const p95 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.95) - 1)] : 0;
    const serviceMap = new Map<string, { events: number; errors: number; totalMs: number; latencyCount: number }>();
    for (const e of rows) {
      const item = serviceMap.get(e.service) ?? { events: 0, errors: 0, totalMs: 0, latencyCount: 0 };
      item.events += 1;
      if ((e.status ?? 200) >= 500 || e.level === "ERROR" || e.level === "CRITICAL") item.errors += 1;
      if (typeof e.duration_ms === "number") { item.totalMs += e.duration_ms; item.latencyCount += 1; }
      serviceMap.set(e.service, item);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dbStats } = await supabaseAdmin.rpc("monitoring_db_stats");
    return {
      windowMinutes: 60,
      totalEvents: rows.length,
      errorRate: rows.length ? Number(((errors.length / rows.length) * 100).toFixed(2)) : 0,
      timeoutRate: rows.length ? Number(((timeouts.length / rows.length) * 100).toFixed(2)) : 0,
      avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a,b) => a+b, 0) / latencies.length) : 0,
      p95LatencyMs: Math.round(p95),
      services: Array.from(serviceMap, ([service, v]) => ({
        service,
        events: v.events,
        errors: v.errors,
        avgLatencyMs: v.latencyCount ? Math.round(v.totalMs / v.latencyCount) : 0,
      })).sort((a,b) => b.events - a.events),
      recentEvents: rows.slice(0, 100).map((e) => ({
        id: e.id, createdAt: e.created_at, source: e.source, level: e.level, service: e.service,
        endpoint: e.endpoint, method: e.method, status: e.status, durationMs: e.duration_ms,
        traceId: e.trace_id, environment: e.environment, message: e.message,
      })),
      incidents: (incidents ?? []).map((i) => ({
        id: i.id, createdAt: i.created_at, startedAt: i.started_at, service: i.service,
        metric: i.metric, severity: i.severity, status: i.status, title: i.title, detail: JSON.stringify(i.detail ?? null),
      })),
      alertRules: (rules ?? []).map((r) => ({ id: r.id, metric: r.metric, threshold: r.threshold, enabled: r.enabled })),
      dbStats: (dbStats && typeof dbStats === "object" && !Array.isArray(dbStats)) ? Object.fromEntries(Object.entries(dbStats as Record<string, unknown>).map(([k, v]) => [k, v == null || typeof v === "number" || typeof v === "boolean" ? (v as number | boolean | null) : String(v)])) : {},
    } satisfies MonitoringSnapshot;
  });

export interface SecurityLogRow {
  id: string;
  createdAt: string;
  action: string;
  userId: string | null;
  phone: string | null;
  ip: string | null;
  detail: string;
}

export const adminListSecurityLogs = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) =>
    z.object({
      days: z.number().int().min(1).max(30).default(7),
      search: z.string().trim().max(100).default(""),
      action: z.string().trim().max(100).default(""),
      page: z.number().int().min(1).max(1000).default(1),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdminPermission(context.supabase as SB, context.userId, "security_logs");
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    let query = context.supabase
      .from("audit_logs")
      .select("id,created_at,action,user_id,ip,detail")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (data.action) query = query.ilike("action", "%" + data.action.replace(/[%_]/g, "") + "%");

    let phoneUserIds: string[] = [];
    if (data.search && /^\d{8}$/.test(data.search)) {
      const { toE164Phone } = await import("./otp.server");
      const phone = toE164Phone(data.search);
      const { data: profilesByPhone, error: phoneError } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("phone", phone);
      if (phoneError) throw new Error("security_logs_failed");
      phoneUserIds = (profilesByPhone ?? []).map((p) => p.id);
      if (phoneUserIds.length === 0) return { logs: [], page: data.page, hasMore: false };
    }

    if (data.search && phoneUserIds.length > 0) {
      query = query.in("user_id", phoneUserIds);
    } else if (data.search) {
      const safe = data.search.replace(/[%_]/g, "");
      query = query.or("action.ilike.%" + safe + "%,ip.ilike.%" + safe + "%");
    }

    const { data: rows, error } = await query.range((data.page - 1) * 50, data.page * 50);
    if (error) throw new Error("security_logs_failed");

    const pageRows = (rows ?? []).slice(0, 50);
    const hasMore = (rows ?? []).length > 50;
    const userIds = Array.from(new Set(pageRows.map((r) => r.user_id).filter((id): id is string => !!id)));
    const profiles = userIds.length
      ? (await context.supabase.from("profiles").select("id,phone").in("id", userIds)).data ?? []
      : [];
    const phoneById = new Map(profiles.map((p) => [p.id, p.phone]));
    const sanitized = (value: unknown): unknown => {
      if (typeof value === "string") return value.replace(/(password|token|secret|otp|pin|apikey|api_key)[^,;}]*/gi, "$1=[masqué]").slice(0, 1000);
      if (Array.isArray(value)) return value.slice(0, 20).map(sanitized);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 30).map(([k,v]) => [k, sanitized(v)]));
      return value;
    };
    const mapped = pageRows.map((r) => ({
      id: r.id, createdAt: r.created_at, action: r.action, userId: r.user_id,
      phone: r.user_id ? phoneById.get(r.user_id) ?? null : null, ip: r.ip, detail: JSON.stringify(sanitized(r.detail) ?? null),
    }));
    const filtered = data.search && /^\d{8}$/.test(data.search)
      ? mapped.filter((r) => r.phone === data.search || r.userId === data.search)
      : mapped;
    return { logs: filtered, page: data.page, hasMore };
  });

export type ReadinessStatus = "ok" | "warning" | "error";
export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

/**
 * Vérifie la configuration de production (super administrateur uniquement).
 * La protection contre les mots de passe compromis est testée réellement :
 * une inscription d'essai avec un mot de passe notoirement piraté doit être
 * refusée par Supabase Auth. Si elle est acceptée, le compte d'essai est
 * supprimé immédiatement.
 */
export const superAdminGetProductionReadiness = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const checks: ReadinessCheck[] = [];

    const serverOk =
      !!process.env["SUPABASE_URL"] &&
      !!process.env["SUPABASE_PUBLISHABLE_KEY"] &&
      !!process.env["SUPABASE_SERVICE_ROLE_KEY"];
    checks.push({
      id: "server",
      label: "Configuration du serveur",
      status: serverOk ? "ok" : "error",
      detail: serverOk ? "Adresse et clés du serveur présentes." : "Adresse ou clés du serveur manquantes.",
    });

    // Supabase ne fournit pas ici de lecture fiable de ce réglage Auth.
    // Ne jamais créer/supprimer un compte réel depuis un health-check de production :
    // un échec de nettoyage pourrait laisser un compte-sonde avec un mot de passe connu.
    const hibp: ReadinessCheck = {
      id: "hibp",
      label: "Mots de passe compromis",
      status: "warning",
      detail:
        "Vérification automatique non destructive indisponible. Contrôlez « Prevent use of leaked passwords » dans Supabase → Authentication → Attack Protection avant la mise en production.",
    };
    checks.push(hibp);

    const smsOk = !!process.env["SMS_PROVIDER_URL"] && !!process.env["SMS_PROVIDER_KEY"];
    checks.push({
      id: "sms",
      label: "Envoi des SMS",
      status: smsOk ? "ok" : "warning",
      detail: smsOk ? "Fournisseur SMS configuré." : "Aucun fournisseur SMS : les codes s’affichent à l’écran (mode démo).",
    });
    checks.push({
      id: "airtel",
      label: "Paiement Airtel Money",
      status: "error",
      detail: "Airtel Money n’est pas encore branché : aucun paiement ne peut être encaissé.",
    });
    const ticketOk = !!process.env["TICKET_HMAC_SECRET"];
    checks.push({
      id: "ticket",
      label: "Signature des tickets",
      status: ticketOk ? "ok" : "error",
      detail: ticketOk ? "Clé de signature des tickets présente." : "Clé de signature des tickets manquante.",
    });

    const ready = checks.every((c) => c.status === "ok");
    return { ready, checks, checkedAt: new Date().toISOString() };
  });

export interface MonitoringAnalysis {
  summary: string;
  model: string;
  eventCount: number;
  incidentTitle: string | null;
}

/** Analyse IA (AI Gateway) des journaux et d'un incident sélectionnés par un administrateur autorisé. */
export const adminAnalyzeMonitoring = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((input: unknown) =>
    z.object({
      eventIds: z.array(z.string().uuid()).max(50),
      incidentId: z.string().uuid().nullable(),
    }).refine((v) => v.eventIds.length > 0 || v.incidentId, "selection_required").parse(input),
  )
  .handler(async ({ data, context }): Promise<MonitoringAnalysis> => {
    await assertAdminPermission(context.supabase as SB, context.userId, "supervision");
    const { sanitize } = await import("./monitoring.shared");
    const events = data.eventIds.length
      ? (await context.supabase
          .from("monitoring_events")
          .select("created_at,source,level,service,endpoint,method,status,duration_ms,trace_id,environment,message,page,device")
          .in("id", data.eventIds)
          .order("created_at", { ascending: true })).data ?? []
      : [];
    const incident = data.incidentId
      ? (await context.supabase
          .from("monitoring_incidents")
          .select("title,service,metric,severity,status,started_at,detail")
          .eq("id", data.incidentId)
          .maybeSingle()).data
      : null;
    if (!events.length && !incident) throw new Error("selection_not_found");

    const lines = events.map((e) =>
      [e.created_at, e.source, e.level, e.service, e.endpoint, e.method, `status=${e.status ?? "?"}`, `${e.duration_ms ?? "?"}ms`, e.trace_id, e.environment, e.page ?? "", e.device ?? "", sanitize(e.message, 300) ?? ""].join(" | "),
    );
    const incidentText = incident
      ? `Incident : ${incident.title} | service=${incident.service} | métrique=${incident.metric} | gravité=${incident.severity} | statut=${incident.status} | début=${incident.started_at} | détail=${sanitize(JSON.stringify(incident.detail), 800)}`
      : "Aucun incident sélectionné.";

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("ai_not_configured");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const model = "openai/gpt-6-astra";
    const result = streamText({
      model: openai.responses(model),
      maxRetries: 0,
      system:
        "Tu es ingénieur SRE pour Coup Sûr (plateforme de jeux au Niger, TanStack Start sur Cloudflare Workers, Supabase, paiement Airtel Money). Réponds en français simple, 250 mots maximum, en Markdown avec exactement trois sections : « Cause probable », « Étapes de diagnostic » (liste numérotée, 3 à 6 étapes concrètes), « Niveau de confiance » (faible/moyen/élevé avec une phrase). Base-toi uniquement sur les données fournies ; si elles sont insuffisantes, dis-le.",
      prompt: `${incidentText}\n\nJournaux (${lines.length}) :\nheure | source | niveau | service | endpoint | méthode | statut | durée | trace | env | page | appareil | message\n${lines.join("\n") || "(aucun)"}`,
      providerOptions: {
        openai: { forceReasoning: true, reasoningEffort: "low", store: false },
      },
    });
    let summary: string;
    try {
      summary = (await result.text).trim();
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 402) throw new Error("ai_credits_exhausted");
      if (status === 429) throw new Error("ai_rate_limited");
      if (status === 403) throw new Error("ai_access_denied");
      throw new Error("ai_unavailable");
    }
    if (!summary) throw new Error("ai_empty");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.monitoring.ai_analysis",
      detail: { eventCount: events.length, incidentId: data.incidentId },
    }).catch(() => {});
    return { summary, model, eventCount: events.length, incidentTitle: incident?.title ?? null };
  });
