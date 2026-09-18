import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "./audit.server";
import { toE164Phone } from "./otp.server";

const PhoneSchema = z.string().regex(/^\d{8}$/);
const PasswordSchema = z.string().min(8).max(128);

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;

function syntheticEmail(phoneE164: string): string {
  return `phone-${phoneE164.replace(/\D/g, "")}@coup-sur.local`;
}

function randomTemporaryPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function findUserIdByPhone(phoneE164: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("phone", phoneE164).maybeSingle();
  if (error) throw new Error(`profile_lookup_failed: ${error.message}`);
  return data?.id ?? null;
}

async function passwordLoginRateBlocked(phoneE164: string): Promise<boolean> {
  const phoneHash = await sha256Hex(phoneE164);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("auth_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("phone_hash", phoneHash)
    .eq("success", false)
    .gte("created_at", since);
  if (error) throw new Error(`login_rate_check_failed: ${error.message}`);
  return (count ?? 0) >= MAX_FAILED_LOGINS;
}

async function recordPasswordLoginAttempt(phoneE164: string, success: boolean, userId?: string): Promise<void> {
  const phoneHash = await sha256Hex(phoneE164);
  const { error } = await supabaseAdmin.from("auth_login_attempts").insert({ phone_hash: phoneHash, success, user_id: userId ?? null });
  if (error) throw new Error(`login_attempt_record_failed: ${error.message}`);
}

export const loginWithPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ phone: PhoneSchema, password: PasswordSchema }).parse(data))
  .handler(async ({ data }) => {
    const phoneE164 = toE164Phone(data.phone);
    if (await passwordLoginRateBlocked(phoneE164)) {
      await writeAuditLog(supabaseAdmin, { action: "auth.password.rate_limited", detail: { phone: phoneE164, windowMinutes: 15, maxFailedAttempts: MAX_FAILED_LOGINS } });
      return { ok: false as const, reason: "rate-limited" as const };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error } = await anon.auth.signInWithPassword({ email: syntheticEmail(phoneE164), password: data.password });
    if (error || !signed.session) {
      await recordPasswordLoginAttempt(phoneE164, false);
      await writeAuditLog(supabaseAdmin, { action: "auth.password.failed", detail: { phone: phoneE164, reason: "invalid_credentials" } });
      return { ok: false as const, reason: "invalid-credentials" as const };
    }

    await recordPasswordLoginAttempt(phoneE164, true, signed.user?.id);
    await writeAuditLog(supabaseAdmin, { userId: signed.user?.id, action: "auth.password.login", detail: { phone: phoneE164 } });
    return {
      ok: true as const,
      session: { access_token: signed.session.access_token, refresh_token: signed.session.refresh_token },
      userId: signed.user.id,
    };
  });

/** Finalise le mot de passe après OTP vérifié. */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ password: PasswordSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError || !userData.user) throw new Error("password_setup_user_invalid");
    if (userData.user.app_metadata?.password_setup_required !== true) throw new Error("password_setup_not_pending");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
      app_metadata: { ...(userData.user.app_metadata ?? {}), password_setup_required: false },
    });
    if (error) throw new Error(`password_update_failed: ${error.message}`);

    // A password reset/setup is a security-sensitive event. Keep the current
    // verified session, but revoke refresh tokens for other devices/sessions.
    const { error: revokeError } = await context.supabase.auth.signOut({ scope: "others" });
    if (revokeError) {
      await writeAuditLog(supabaseAdmin, { userId, action: "auth.session.revoke_others_failed", detail: { reason: revokeError.message } });
    }

    await writeAuditLog(supabaseAdmin, { userId, action: "auth.password.created", detail: { method: "otp_verified" } });
    return { ok: true as const };
  });

export async function createOrResetPasswordForOtp(phoneE164: string): Promise<{
  email: string;
  password: string;
  userId: string;
}> {
  const email = syntheticEmail(phoneE164);
  const password = randomTemporaryPassword();
  const existingUserId = await findUserIdByPhone(phoneE164);

  if (existingUserId) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      email,
      password,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      app_metadata: { password_setup_required: true },
    });
    if (error) throw new Error(`user_reset_failed: ${error.message}`);
    return { email, password, userId: existingUserId };
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    phone: phoneE164,
    email_confirm: true,
    phone_confirm: true,
    app_metadata: { password_setup_required: true },
  });
  if (error || !data.user) throw new Error(`user_create_failed: ${error?.message ?? "no user"}`);
  return { email, password, userId: data.user.id };
}
