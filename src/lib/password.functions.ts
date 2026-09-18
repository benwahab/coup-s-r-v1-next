import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAuditLog } from "./audit.server";
import { toE164Phone } from "./otp.server";

const PhoneSchema = z.string().regex(/^\d{8}$/);
const PasswordSchema = z.string().min(8).max(128);

function syntheticEmail(phoneE164: string): string {
  return `phone-${phoneE164.replace(/\D/g, "")}@coup-sur.local`;
}

function randomTemporaryPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function findUserIdByPhone(phoneE164: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", phoneE164)
    .maybeSingle();
  if (error) throw new Error(`profile_lookup_failed: ${error.message}`);
  return data?.id ?? null;
}

export const loginWithPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    phone: PhoneSchema,
    password: PasswordSchema,
  }).parse(data))
  .handler(async ({ data }) => {
    const phoneE164 = toE164Phone(data.phone);
    const email = syntheticEmail(phoneE164);

    // The actual password check is delegated to Supabase Auth. We do not
    // read, hash, compare, or store the password ourselves.
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: signed, error } = await anon.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !signed.session) {
      await writeAuditLog(supabaseAdmin, {
        action: "auth.password.failed",
        detail: { phone: phoneE164, reason: "invalid_credentials" },
      });
      return { ok: false as const, reason: "invalid-credentials" as const };
    }

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

/**
 * Finalise un mot de passe choisi par l'utilisateur après vérification OTP.
 * Le mot de passe n'est jamais stocké dans notre base applicative.
 */
export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ password: PasswordSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
    });
    if (error) throw new Error(`password_update_failed: ${error.message}`);

    await writeAuditLog(supabaseAdmin, {
      userId,
      action: "auth.password.created",
      detail: { method: "otp_verified" },
    });

    return { ok: true as const };
  });

/**
 * After OTP verification, rotate the temporary bootstrap password before
 * handing a session to the client. The client then immediately replaces it
 * with the user's chosen password through setUserPassword.
 */
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
  });
  if (error || !data.user) {
    throw new Error(`user_create_failed: ${error?.message ?? "no user"}`);
  }

  return { email, password, userId: data.user.id };
}
