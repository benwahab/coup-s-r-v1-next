import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

const TicketStatus = z.enum(["pending", "losing", "winning", "paid"]);
const PaymentStatus = z.enum(["pending", "confirmed", "failed"]);

async function assertAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
}

/** Seul un super-admin peut gérer les autres admins (donner/retirer l'accès). */
async function assertSuperAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: super_admin role required");
}

/** Retourne `true` si l'utilisateur courant a le rôle admin. */
export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: data === true };
  });

/** Retourne `true` si l'utilisateur courant a le rôle super_admin (seul
 *  niveau autorisé à gérer les autres admins). */
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

/** Liste des tickets (tous joueurs) — admin uniquement. */
export const adminListAllTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { tickets: data ?? [] };
  });

/** Met à jour le statut d'un ticket (identifié par son code affiché). */
export const adminUpdateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ code: z.string().min(1), status: TicketStatus, prize: z.number().int().nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Database["public"]["Tables"]["tickets"]["Update"] = { status: data.status };
    if (data.prize !== undefined) patch.prize = data.prize;
    const { error } = await supabaseAdmin.from("tickets").update(patch).eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Met à jour le statut d'une jambe. Recalcule le statut global du ticket. */
export const adminUpdateTicketLegStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(1),
        legId: z.string().min(1),
        status: TicketStatus,
        prize: z.number().int().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e1 } = await supabaseAdmin
      .from("tickets")
      .select("id, legs")
      .eq("code", data.code)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row) throw new Error("ticket_not_found");
    const legs = Array.isArray(row.legs) ? (row.legs as Array<Record<string, unknown>>) : [];
    const nextLegs = legs.map((l) =>
      l.legId === data.legId
        ? { ...l, status: data.status, ...(data.prize !== undefined ? { prize: data.prize } : {}) }
        : l,
    );
    const all = nextLegs.map((l) => l.status);
    let global: "pending" | "losing" | "winning" | "paid" = "pending";
    if (all.length > 0 && all.every((s) => s === "paid")) global = "paid";
    else if (all.some((s) => s === "winning" || s === "paid")) global = "winning";
    else if (all.length > 0 && all.every((s) => s === "losing")) global = "losing";
    const totalPrize = nextLegs.reduce(
      (s, l) => s + (typeof l.prize === "number" ? l.prize : 0),
      0,
    );
    const { error: e2 } = await supabaseAdmin
      .from("tickets")
      .update({ legs: nextLegs as unknown as Database["public"]["Tables"]["tickets"]["Update"]["legs"], status: global, prize: totalPrize || null })
      .eq("id", row.id);
    if (e2) throw new Error(e2.message);
    return { ok: true as const, status: global, prize: totalPrize || null };
  });

/** L'utilisateur courant confirme ou marque comme échouée sa propre intention. */
export const updateMyPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reference: z.string().min(1),
        status: z.enum(["confirmed", "failed"]),
        ticketId: z.string().uuid().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Database["public"]["Tables"]["payments"]["Update"] = { status: data.status };
    if (data.ticketId) patch.ticket_id = data.ticketId;
    const { error } = await supabaseAdmin
      .from("payments")
      .update(patch)
      .eq("reference", data.reference)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Liste des paiements — admin uniquement. */
export const adminListAllPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { payments: data ?? [] };
  });

/** Liste des comptes ayant le rôle admin — admin uniquement. */
export const adminListAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

/** Accorde le rôle admin à un compte existant, identifié par son numéro de téléphone. */
export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ phone: z.string().regex(/^\d{8}$/) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: e1 } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", data.phone)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!profile) return { ok: false as const, reason: "no_account" as const };
    const { error: e2 } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: profile.id, role: "admin" })
      .select()
      .maybeSingle();
    // Contrainte UNIQUE(user_id, role) : déjà admin, on considère ça réussi (idempotent).
    if (e2 && !e2.message.includes("duplicate")) throw new Error(e2.message);
    return { ok: true as const };
  });

/** Retire le rôle admin d'un compte. Un admin ne peut pas se retirer lui-même
 *  (garde-fou pour éviter de se verrouiller hors du panneau par erreur). */
export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase as SB, context.userId);
    if (data.userId === context.userId) return { ok: false as const, reason: "cannot_self_revoke" as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });