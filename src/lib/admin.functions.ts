import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TicketStatus = z.enum(["pending", "losing", "winning", "paid"]);
const PaymentStatus = z.enum(["pending", "confirmed", "failed"]);

async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: admin role required");
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

/** Liste des tickets (tous joueurs) — admin uniquement. */
export const adminListAllTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
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
    await assertAdmin(context.supabase, context.userId);
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
      .update({ legs: nextLegs, status: global, prize: totalPrize || null })
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
    const patch: Record<string, unknown> = { status: data.status };
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { payments: data ?? [] };
  });