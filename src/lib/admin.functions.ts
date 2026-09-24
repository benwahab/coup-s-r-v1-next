import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import type { Database } from "@/integrations/supabase/types";
import { writeAuditLog } from "./audit.server";

type SB = SupabaseClient<Database>;

const AdminPermission = z.enum([
  "complaints",
  "player_activity",
  "ball_stats",
  "publish_results",
  "player_stats",
  "region_stats",
  "security_logs",
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
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    const { data: admin, error: adminError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (adminError) return { isAdmin: false };
    if (admin === true) return { isAdmin: true };
    const { data: superAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    return { isAdmin: superAdmin === true };
  });

export const getMyAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
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
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (error) return { isSuperAdmin: false };
    return { isSuperAdmin: data === true };
  });

/**
 * Admin activity feed only.
 *
 * SECURITY BOUNDARY:
 * - No ticket id/code, picks, legs, prize or ticket state is returned.
 * - No payment_key is returned.
 * - The player's Mobile Money secret/password is never persisted or exposed.
 * - This is operational activity, not access to the player's ticket.
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
