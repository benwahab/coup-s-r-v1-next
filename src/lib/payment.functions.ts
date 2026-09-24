import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const paymentInput = z.object({
  key: z.string().min(3).max(200),
  gameId: z.enum(["pmu", "loto", "foot"]),
  phone: z.string().min(8).max(30),
  amount: z.number().int().min(1).max(100_000),
  method: z.string().trim().min(1).max(100),
});

const duplicateInput = z.object({ key: z.string().min(3).max(200) });

const PAYMENT_METHODS = new Set(["airtel"]);

function toE164(phone: string): string {
  const s = phone.replace(/\D/g, "");
  if (s.length === 8) return "+227" + s;
  if (s.startsWith("227")) return "+" + s;
  return s.startsWith("+") ? s : "+" + s;
}

/**
 * Creates a pending payment intent server-side.
 * No external Mobile Money charge is performed here.
 * The provider request must be made only after this server-side
 * intent is created, and confirmation must come from provider verification.
 */
export const beginPayment = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => paymentInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.gameId === "pmu" || data.gameId === "loto") {
      const { data: schedule, error: scheduleError } = await supabaseAdmin
        .from("game_schedules")
        .select("open_hour,close_hour,enabled")
        .eq("game_id", data.gameId)
        .maybeSingle();
      if (scheduleError) throw new Error("schedule_lookup_failed: " + scheduleError.message);
      if (!schedule?.enabled) throw new Error("game_schedule_disabled");
      const { nigerParts, nigerInstant } = await import("@/lib/schedule");
      const now = new Date();
      const p = nigerParts(now);
      const open = nigerInstant(p.year, p.month, p.day, schedule.open_hour);
      const close = nigerInstant(p.year, p.month, p.day, schedule.close_hour);
      const isOpen =
        schedule.open_hour > schedule.close_hour
          ? !(now >= close && now < open)
          : now >= open && now < close;
      if (!isOpen) throw new Error("game_closed");
    }
    if (!PAYMENT_METHODS.has(data.method)) throw new Error("invalid_payment_method");

    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .gte("created_at", cutoff);

    if (countError) throw new Error("payment_rate_check_failed: " + countError.message);
    if ((count ?? 0) >= 10) throw new Error("payment_rate_limited");

    const phone = toE164(data.phone);

    // Le numéro utilisé pour un paiement doit être celui du compte authentifié.
    // Cela évite qu’un navigateur falsifie le bénéficiaire/compte de paiement.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("profile_lookup_failed: " + profileError.message);
    if (!profile?.phone || toE164(profile.phone) !== phone) throw new Error("phone_mismatch");

    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from("payments")
      .select("reference, amount, status, payment_key, created_at, game_id")
      .eq("user_id", context.userId)
      .eq("payment_key", data.key)
      .or("status.eq.confirmed,and(status.eq.pending,created_at.gte." + cutoff + ")")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (duplicateError)
      throw new Error("payment_duplicate_check_failed: " + duplicateError.message);
    if (duplicate) {
      return {
        duplicate: true as const,
        intent: {
          key: duplicate.payment_key ?? data.key,
          txRef: duplicate.reference,
          gameId: duplicate.game_id,
          phone,
          amount: duplicate.amount,
          createdAt: new Date(duplicate.created_at).getTime(),
          status: duplicate.status,
        },
      };
    }

    const txRef = "TX-" + crypto.randomUUID().replace(/-/g, "").slice(0, 20).toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        method: data.method,
        game_id: data.gameId,
        status: "pending",
        reference: txRef,
        payment_key: data.key,
      })
      .select("reference, amount, status, payment_key, created_at")
      .single();

    if (error) throw new Error("payment_create_failed: " + error.message);

    return {
      duplicate: false as const,
      intent: {
        key: row.payment_key ?? data.key,
        txRef: row.reference,
        gameId: data.gameId,
        phone,
        amount: row.amount,
        createdAt: new Date(row.created_at).getTime(),
        status: row.status,
      },
    };
  });

export const checkPaymentDuplicate = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => duplicateInput.parse(data))
  .handler(async ({ data, context }) => {
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .select("payment_key, reference, amount, status, created_at, game_id")
      .eq("user_id", context.userId)
      .eq("payment_key", data.key)
      .or("status.eq.confirmed,and(status.eq.pending,created_at.gte." + cutoff + ")")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("payment_duplicate_check_failed: " + error.message);
    if (!row) return { duplicate: false as const };

    return {
      duplicate: true as const,
      intent: {
        key: row.payment_key ?? data.key,
        txRef: row.reference,
        gameId: row.game_id,
        phone: "",
        amount: row.amount,
        createdAt: new Date(row.created_at).getTime(),
        status: row.status,
      },
    };
  });
