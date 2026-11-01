import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function writeAuditLog(...args: Parameters<(typeof import("./audit.server"))["writeAuditLog"]>) {
  const { writeAuditLog } = await import("./audit.server");
  return writeAuditLog(...args);
}

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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", phoneE164)
    .maybeSingle();
  if (error) throw new Error(`profile_lookup_failed: ${error.message}`);
  return data?.id ?? null;
}

async function passwordLoginRateBlocked(phoneE164: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

async function recordPasswordLoginAttempt(
  phoneE164: string,
  success: boolean,
  userId?: string,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const phoneHash = await sha256Hex(phoneE164);
  const { error } = await supabaseAdmin
    .from("auth_login_attempts")
    .insert({ phone_hash: phoneHash, success, user_id: userId ?? null });
  if (error) throw new Error(`login_attempt_record_failed: ${error.message}`);
}

export const loginWithPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ phone: PhoneSchema, password: PasswordSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { toE164Phone } = await import("./otp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phoneE164 = toE164Phone(data.phone);
    if (await passwordLoginRateBlocked(phoneE164)) {
      await writeAuditLog(supabaseAdmin, {
        action: "auth.password.rate_limited",
        detail: { phone: phoneE164, windowMinutes: 15, maxFailedAttempts: MAX_FAILED_LOGINS },
      });
      return { ok: false as const, reason: "rate-limited" as const };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error } = await anon.auth.signInWithPassword({
      email: syntheticEmail(phoneE164),
      password: data.password,
    });
    if (error || !signed.session) {
      await recordPasswordLoginAttempt(phoneE164, false);
      await writeAuditLog(supabaseAdmin, {
        action: "auth.password.failed",
        detail: { phone: phoneE164, reason: "invalid_credentials" },
      });
      return { ok: false as const, reason: "invalid-credentials" as const };
    }

    await recordPasswordLoginAttempt(phoneE164, true, signed.user?.id);
    await writeAuditLog(supabaseAdmin, {
      userId: signed.user?.id,
      action: "auth.password.login",
      detail: { phone: phoneE164 },
    });
    return {
      ok: true as const,
      session: {
        access_token: signed.session.access_token,
        refresh_token: signed.session.refresh_token,
      },
      userId: signed.user.id,
    };
  });

function isWeakPasswordError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "weak_password" ||
    /pwned|compromis|leaked|weak password/i.test(error.message ?? "")
  );
}

/** Change le mot de passe depuis une session déjà authentifiée. */
export const changeUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ currentPassword: PasswordSchema, newPassword: PasswordSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.currentPassword === data.newPassword) throw new Error("password_must_change");

    const { error } = await context.supabase.auth.updateUser({
      password: data.newPassword,
      current_password: data.currentPassword,
    });
    if (error) {
      if (isWeakPasswordError(error)) return { ok: false as const, reason: "weak-password" as const };
      throw new Error("password_change_failed");
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError || !userData.user) throw new Error("password_change_user_invalid");

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      app_metadata: { ...(userData.user.app_metadata ?? {}), password_setup_required: false },
    });
    if (metaError) {
      await writeAuditLog(supabaseAdmin, {
        userId: context.userId,
        action: "auth.password_change.metadata_flag_failed",
        detail: { reason: metaError.message },
      });
      throw new Error("password_change_metadata_failed");
    }

    const { data: updatedProfile, error: profileFlagError } = await supabaseAdmin
      .from("profiles")
      .update({ password_setup_required: false })
      .eq("id", context.userId)
      .eq("password_setup_required", true)
      .select("id")
      .maybeSingle();
    if (profileFlagError) {
      await writeAuditLog(supabaseAdmin, {
        userId: context.userId,
        action: "auth.password_change.profile_flag_failed",
        detail: { reason: profileFlagError.message },
      });
      throw new Error("password_setup_state_update_failed");
    }
    // A zero-row update is expected for an already-configured account.
    void updatedProfile;

    const { error: revokeError } = await context.supabase.auth.signOut({ scope: "others" });
    if (revokeError) {
      await writeAuditLog(supabaseAdmin, {
        userId: context.userId,
        action: "auth.session.revoke_others_failed",
        detail: { reason: revokeError.message, source: "password_change" },
      });
    }

    await writeAuditLog(supabaseAdmin, {
      userId: context.userId,
      action: "auth.password.changed",
      detail: { method: "current_password" },
    });
    return { ok: true as const };
  });

/** Finalise le mot de passe après OTP vérifié. */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ password: PasswordSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: userData, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    if (getUserError || !userData.user) throw new Error("password_setup_user_invalid");
    const { data: profileState, error: profileStateError } = await supabaseAdmin
      .from("profiles")
      .select("password_setup_required")
      .eq("id", userId)
      .maybeSingle();
    if (profileStateError || !profileState) throw new Error("password_setup_state_unavailable");
    const metadataPending = userData.user.app_metadata?.password_setup_required === true;
    const profilePending = profileState.password_setup_required === true;

    // Idempotence: a previous request may have changed the password and cleared
    // one of the two authoritative flags before a transient failure occurred.
    // If both flags are already clear, the setup has completed successfully.
    if (!metadataPending && !profilePending) {
      return { ok: true as const };
    }

    // Supabase Auth applies its password policy and compromised-password checks.
    // Keep this operation first: no setup flag is cleared unless Auth accepted
    // the new password.
    const { error: pwError } = await context.supabase.auth.updateUser({ password: data.password });
    if (pwError) {
      if (isWeakPasswordError(pwError)) return { ok: false as const, reason: "weak-password" as const };
      throw new Error("password_update_failed");
    }

    // app_metadata is cleared first; the server-authoritative profile gate
    // stays enabled until every preceding step has succeeded.
    if (metadataPending) {
      const { error: metadataError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...(userData.user.app_metadata ?? {}),
          password_setup_required: false,
        },
      });
      if (metadataError) {
        await writeAuditLog(supabaseAdmin, {
          userId,
          action: "auth.password_setup.metadata_flag_failed",
          detail: { reason: metadataError.message },
        });
        throw new Error("password_setup_state_update_failed");
      }
    }

    // Clear the authoritative profile gate last. A failed update leaves the
    // account blocked and the partially completed operation can be retried.
    if (profilePending) {
      const { data: updatedProfile, error: profileFlagError } = await supabaseAdmin
        .from("profiles")
        .update({ password_setup_required: false })
        .eq("id", userId)
        .eq("password_setup_required", true)
        .select("id")
        .maybeSingle();
      if (profileFlagError || !updatedProfile) {
        await writeAuditLog(supabaseAdmin, {
          userId,
          action: "auth.password_setup.profile_flag_failed",
          detail: { reason: profileFlagError?.message ?? "profile_state_not_updated" },
        });
        throw new Error("password_setup_state_update_failed");
      }
    }

    // A password reset/setup is security-sensitive. Keep the verified current
    // session and revoke refresh tokens for other devices/sessions.
    const { error: revokeError } = await context.supabase.auth.signOut({ scope: "others" });
    if (revokeError) {
      await writeAuditLog(supabaseAdmin, {
        userId,
        action: "auth.session.revoke_others_failed",
        detail: { reason: revokeError.message },
      });
    }

    await writeAuditLog(supabaseAdmin, {
      userId,
      action: "auth.password.created",
      detail: { method: "otp_verified" },
    });
    return { ok: true as const };
  });

export async function createOrResetPasswordForOtp(phoneE164: string): Promise<{
  email: string;
  password: string;
  userId: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = syntheticEmail(phoneE164);
  const password = randomTemporaryPassword();
  const existingUserId = await findUserIdByPhone(phoneE164);

  if (existingUserId) {
    // Preserve existing authorization/provider metadata (roles, tenant flags,
    // etc.). Replacing app_metadata with only the setup flag could silently
    // strip permissions and break unrelated platform workflows.
    const { data: existingAuthUser, error: lookupError } =
      await supabaseAdmin.auth.admin.getUserById(existingUserId);
    if (lookupError || !existingAuthUser.user) {
      throw new Error("user_reset_lookup_failed");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      email,
      password,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      app_metadata: {
        ...(existingAuthUser.user.app_metadata ?? {}),
        password_setup_required: true,
      },
    });
    if (error) throw new Error("user_reset_failed");
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
