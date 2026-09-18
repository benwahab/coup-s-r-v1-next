import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import type { Database } from "@/integrations/supabase/types";
import { writeAuditLog } from "./audit.server";

type SB = SupabaseClient<Database>;

const PaymentStatus = z.enum(["pending", "confirmed", "failed"]);\nconst AdminPermission = z.enum([\n  "complaints",\n  "player_activity",\n  "ball_stats",\n  "publish_results",\n  "player_stats",\n  "region_stats",\n  "security_logs",\n]);\nexport type AdminPermission = z.infer<typeof AdminPermission>;

async function assertAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
}

async function assertAdminPermission(supabase: SB, userId: string, permission: AdminPermission) {\n  const { data, error } = await supabase.rpc("has_admin_permission", { _user_id: userId, _permission: permission });\n  if (error) throw new Error("permission_check_failed");\n  if (data !== true) throw new Error("Forbidden: admin permission required");\n}\n\nasync function assertSuperAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: super_admin role required");
}

export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: data === true };
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

export const updateMyPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) =>
    z.object({
      reference: z.string().min(1),
      status: PaymentStatus.refine((s) => s === "confirmed" || s === "failed"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment, error: lookupError } = await supabaseAdmin
      .from("payments")
      .select("id, status, ticket_id, user_id")
      .eq("reference", data.reference)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!payment) throw new Error("payment_not_found");
    if (payment.status !== "pending") {
      if (payment.status === data.status) return { ok: true as const, unchanged: true as const };
      throw new Error("invalid_payment_state_transition");
    }

    // Le navigateur ne peut jamais choisir ni rattacher un ticket lors de la
    // confirmation. Le lien payment -> ticket est créé uniquement par le RPC
    // atomique de création du ticket après validation complète du ticket.
    const { data: updatedPayment, error } = await supabaseAdmin
      .from("payments")
      .update({ status: data.status })
      .eq("id", payment.id)
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .select("id,status,ticket_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updatedPayment) throw new Error("payment_state_conflict");
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "payment.demo.status_updated",
      detail: { reference: data.reference, status: data.status, ticketId: null },
    });
    return { ok: true as const };
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
export const adminListPlayerActivities = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as SB, context.userId);
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
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile, error: profileError },
      { data: tickets, error: ticketsError },
      { data: payments, error: paymentsError },
      { data: ledger, error: ledgerError },
      { data: audit, error: auditError }] = await Promise.all([
      supabaseAdmin.from("profiles")
        .select("id,phone,first_name,last_name,region,created_at")
        .eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("tickets")
        .select("id,code,game_id,stake,payment_method,status,prize,legs,phone,region,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("payments")
        .select("id,game_id,amount,method,status,reference,ticket_id,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("financial_ledger")
        .select("id,event_type,payment_id,ticket_id,reference,amount,prize,method,provider_reference,metadata,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("audit_logs")
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
    const permissionRows = userIds.length === 0 ? [] : (await supabaseAdmin.from("admin_permissions").select("user_id, permission").in("user_id", userIds)).data ?? [];\n    const permissionsByUser = new Map<string, string[]>();\n    for (const row of permissionRows) { const list = permissionsByUser.get(row.user_id) ?? []; list.push(row.permission); permissionsByUser.set(row.user_id, list); }\n\n    const userIds = (roles ?? []).map((r) => r.user_id);
    if (userIds.length === 0) return { admins: [] };
    const { data: profiles, error: e2 } = await supabaseAdmin
      .from("profiles")
      .select("id, phone, first_name, last_name")
      .in("id", userIds);
    if (e2) throw new Error(e2.message);
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    return {
      admins: (roles ?? []).map((r) => ({
        userId: r.user_id,
        grantedAt: r.created_at,
        phone: profileById.get(r.user_id)?.phone ?? null,
        firstName: profileById.get(r.user_id)?.first_name ?? null,
        lastName: profileById.get(r.user_id)?.last_name ?? null,
      })),
    };
  });

export const adminListPermissions = createServerFn({ method: "POST" })\n  .middleware([requireConfiguredUser])\n  .handler(async ({ context }) => {\n    await assertSuperAdmin(context.supabase as SB, context.userId);\n    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");\n    const { data, error } = await supabaseAdmin.from("admin_permissions").select("user_id, permission, created_at").order("created_at", { ascending: true });\n    if (error) throw new Error(error.message);\n    return { permissions: data ?? [] };\n  });\n\nexport const adminSetPermissions = createServerFn({ method: "POST" })\n  .middleware([requireConfiguredUser])\n  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid(), permissions: z.array(AdminPermission).max(20) }).parse(data))\n  .handler(async ({ data, context }) => {\n    await assertSuperAdmin(context.supabase as SB, context.userId);\n    if (data.userId === context.userId) throw new Error("cannot_change_own_admin_permissions");\n    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");\n    const { data: targetAdmin, error: roleError } = await supabaseAdmin.from("user_roles").select("id").eq("user_id", data.userId).eq("role", "admin").maybeSingle();\n    if (roleError) throw new Error(roleError.message);\n    if (!targetAdmin) throw new Error("admin_role_required");\n    const { error: deleteError } = await supabaseAdmin.from("admin_permissions").delete().eq("user_id", data.userId);\n    if (deleteError) throw new Error(deleteError.message);\n    if (data.permissions.length > 0) {\n      const { error: insertError } = await supabaseAdmin.from("admin_permissions").insert(data.permissions.map((permission) => ({ user_id: data.userId, permission })));\n      if (insertError) throw new Error(insertError.message);\n    }\n    await writeAuditLog(supabaseAdmin, { userId: context.userId, action: "admin.permissions.updated", detail: { targetUserId: data.userId, permissions: data.permissions } });\n    return { ok: true as const, permissions: data.permissions };\n  });\n\nexport const adminGrantRole = createServerFn({ method: "POST" })
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
    if (e2 && !e2.message.includes("duplicate")) throw new Error(e2.message);
    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "admin.role.granted",
      detail: { targetUserId: profile.id, role: "admin" },
    });
    return { ok: true as const };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    if (data.userId === context.userId) return { ok: false as const, reason: "cannot_self_revoke" as const };
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
