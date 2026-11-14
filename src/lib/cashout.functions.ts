import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";

type CashoutRow = {
  id: string;
  ticket_id: string;
  user_id: string;
  ticket_code: string;
  prize: number;
  status: "pending" | "completed";
  requested_at: string;
  completed_at: string | null;
  processed_by: string | null;
  provider_reference: string | null;
  player_name?: string | null;
  player_phone?: string | null;
  region?: string | null;
};

async function getAdminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error) throw new Error("role_check_failed");
  if (data !== true) throw new Error("Forbidden: super_admin role required");
}

export const listMyCashoutRequests = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    const db = await getAdminDb();
    const { data, error } = await db.from("cashout_requests")
      .select("id,ticket_code,prize,status,requested_at,completed_at,provider_reference")
      .eq("user_id", context.userId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error("cashout_requests_load_failed");
    return { requests: (data ?? []) as CashoutRow[] };
  });

export const requestMyTicketCashout = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({ ticketCode: z.string().min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await getAdminDb();
    const { data: request, error } = await db.rpc("request_ticket_cashout", {
      p_ticket_code: data.ticketCode,
      p_user_id: context.userId,
    });
    if (error) throw new Error(error.message.includes("ticket_not_eligible") ? "ticket_not_eligible_for_cashout" : error.message);
    return { request: request as CashoutRow };
  });

export const adminListCashoutRequests = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = await getAdminDb();
    const { data, error } = await db.from("cashout_requests")
      .select("id,ticket_id,user_id,ticket_code,prize,status,requested_at,completed_at,provider_reference")
      .order("requested_at", { ascending: false });
    if (error) throw new Error("cashout_requests_load_failed");
    const requests = (data ?? []) as CashoutRow[];
    const userIds = [...new Set(requests.map((row) => row.user_id))];
    if (userIds.length) {
      const { data: profiles, error: profileError } = await db.from("profiles")
        .select("id,first_name,last_name,phone,region")
        .in("id", userIds);
      if (profileError) throw new Error("cashout_profiles_load_failed");
      const byUser = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      for (const row of requests) {
        const profile = byUser.get(row.user_id) as any;
        row.player_name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") : null;
        row.player_phone = profile?.phone ?? null;
        row.region = profile?.region ?? null;
      }
    }
    return {
      requests,
      pendingCount: requests.filter((row) => row.status === "pending").length,
      completedCount: requests.filter((row) => row.status === "completed").length,
    };
  });

export const adminGetCashoutCounts = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = await getAdminDb();
    const [pending, completed] = await Promise.all([
      db.from("cashout_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("cashout_requests").select("id", { count: "exact", head: true }).eq("status", "completed"),
    ]);
    if (pending.error || completed.error) throw new Error("cashout_counts_load_failed");
    return { pendingCount: pending.count ?? 0, completedCount: completed.count ?? 0 };
  });

export const adminCompleteCashoutRequest = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => z.object({
    requestId: z.string().uuid(),
    providerReference: z.string().max(200).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const db = await getAdminDb();
    const { data: request, error } = await db.rpc("complete_ticket_cashout", {
      p_request_id: data.requestId,
      p_admin_id: context.userId,
      p_provider_reference: data.providerReference ?? null,
    });
    if (error) throw new Error(error.message);
    return { request: request as CashoutRow };
  });
