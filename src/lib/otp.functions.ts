import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { writeAuditLog } from "./audit.server";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS_PER_WINDOW = 5;

const PhoneInput = z.object({ phone: z.string().regex(/^\d{8}$/) });
const VerifyInput = z.object({
  phone: z.string().regex(/^\d{8}$/),
  code: z.string().regex(/^\d{6}$/),
  profile: z.object({
    firstName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().max(80).optional(),
    region: z.string().trim().max(80).optional(),
  }).optional(),
});

/** Envoi d'un OTP simulé. Le code est retourné uniquement pour la démo. */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOtpCode, sha256Hex, toE164Phone } = await import("./otp.server");
    const phoneE164 = toE164Phone(data.phone);
    const windowStartIso = new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString();
    const { count: recentCount, error: rateErr } = await supabaseAdmin
      .from("otp_codes").select("id", { count: "exact", head: true }).eq("phone", phoneE164).gte("created_at", windowStartIso);
    if (rateErr) throw new Error(`otp_rate_check_failed: ${rateErr.message}`);
    if ((recentCount ?? 0) >= MAX_OTP_REQUESTS_PER_WINDOW) return { ok: false as const, reason: "rate-limited" as const };

    const code = generateOtpCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
    const { error: invalidateError } = await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("phone", phoneE164).is("consumed_at", null);
    if (invalidateError) throw new Error(`otp_invalidate_failed: ${invalidateError.message}`);
    const { error } = await supabaseAdmin.from("otp_codes").insert({ phone: phoneE164, code_hash: codeHash, expires_at: expiresAt, attempts: 0 });
    if (error) throw new Error(`otp_insert_failed: ${error.message}`);
    console.info("[Coup Sûr DEMO] OTP", phoneE164, "→", code);
    return { ok: true as const, code, ttlSec: Math.floor(OTP_TTL_MS / 1000) };
  });

/** Vérifie l'OTP et établit une session Supabase temporaire pour le setup du mot de passe. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256Hex, toE164Phone } = await import("./otp.server");
    const { createClient } = await import("@supabase/supabase-js");

    const phoneE164 = toE164Phone(data.phone);
    const nowIso = new Date().toISOString();
    const { data: rows, error: selErr } = await supabaseAdmin
      .from("otp_codes").select("id, code_hash, expires_at, attempts").eq("phone", phoneE164).is("consumed_at", null).gt("expires_at", nowIso).order("created_at", { ascending: false }).limit(1);
    if (selErr) throw new Error(`otp_select_failed: ${selErr.message}`);
    const otp = rows?.[0];
    if (!otp) return { ok: false as const, reason: "expired" as const };

    if (otp.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin.from("otp_codes").update({ consumed_at: nowIso }).eq("id", otp.id);
      return { ok: false as const, reason: "locked" as const };
    }

    const codeHash = await sha256Hex(data.code);
    if (codeHash !== otp.code_hash) {
      const nextAttempts = otp.attempts + 1;
      const { data: failedAttemptUpdate, error: failedAttemptError } = await supabaseAdmin
        .from("otp_codes").update({ attempts: nextAttempts, consumed_at: nextAttempts >= MAX_ATTEMPTS ? nowIso : null })
        .eq("id", otp.id).is("consumed_at", null).eq("attempts", otp.attempts).select("id").maybeSingle();
      if (failedAttemptError) throw new Error(`otp_attempt_update_failed: ${failedAttemptError.message}`);
      if (!failedAttemptUpdate) return { ok: false as const, reason: "already-used" as const };
      await writeAuditLog(supabaseAdmin, { action: "auth.otp.failed", detail: { phone: phoneE164, remaining: Math.max(0, MAX_ATTEMPTS - nextAttempts) } });
      return { ok: false as const, reason: "wrong-code" as const, remaining: Math.max(0, MAX_ATTEMPTS - nextAttempts) };
    }

    const { data: consumedOtp, error: consumeError } = await supabaseAdmin
      .from("otp_codes").update({ consumed_at: nowIso }).eq("id", otp.id).is("consumed_at", null).eq("attempts", otp.attempts).select("id").maybeSingle();
    if (consumeError) throw new Error(`otp_consume_failed: ${consumeError.message}`);
    if (!consumedOtp) return { ok: false as const, reason: "already-used" as const };

    const { createOrResetPasswordForOtp } = await import("./password.functions");
    const bootstrap = await createOrResetPasswordForOtp(phoneE164);
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const signRes = await anon.auth.signInWithPassword({ email: bootstrap.email, password: bootstrap.password });
    if (signRes.error || !signRes.data.session) throw new Error(`sign_in_failed: ${signRes.error?.message ?? "no session"}`);

    const sess = signRes.data;
    const p = data.profile;
    if (p && (p.firstName || p.lastName || p.region)) {
      const patch: Record<string, string | null | boolean> = { phone: phoneE164, password_setup_required: true };
      if (p.firstName !== undefined) patch.first_name = p.firstName || null;
      if (p.lastName !== undefined) patch.last_name = p.lastName || null;
      if (p.region !== undefined) patch.region = p.region || null;
      const { error: profileUpsertError } = await supabaseAdmin.from("profiles").upsert({ id: sess.session.user.id, ...patch }, { onConflict: "id" });
      if (profileUpsertError) {
        await writeAuditLog(supabaseAdmin, { userId: sess.session.user.id, action: "auth.profile_sync.failed", detail: { phone: phoneE164, error: profileUpsertError.message } });
        throw new Error("profile_sync_failed");
      }
    }

    const { error: setupStateError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        { id: sess.session.user.id, phone: phoneE164, password_setup_required: true },
        { onConflict: "id" },
      );
    if (setupStateError) {
      await writeAuditLog(supabaseAdmin, { userId: sess.session.user.id, action: "auth.password_setup_state.failed", detail: { phone: phoneE164, error: setupStateError.message } });
      throw new Error("password_setup_state_failed");
    }

    const { data: profileRow } = await supabaseAdmin.from("profiles").select("first_name, last_name, region, password_setup_required").eq("id", sess.session.user.id).maybeSingle();
    await writeAuditLog(supabaseAdmin, { userId: sess.session.user.id, action: "auth.otp.verified", detail: { phone: phoneE164, passwordSetupRequired: true } });

    return {
      ok: true as const,
      session: { access_token: sess.session.access_token, refresh_token: sess.session.refresh_token },
      userId: sess.session.user.id,
      phone: phoneE164,
      profile: profileRow ? { firstName: profileRow.first_name ?? undefined, lastName: profileRow.last_name ?? undefined, region: profileRow.region ?? undefined } : null,
    };
  });
