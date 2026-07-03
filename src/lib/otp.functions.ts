import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const PhoneInput = z.object({ phone: z.string().regex(/^\d{8}$/) });
const VerifyInput = z.object({
  phone: z.string().regex(/^\d{8}$/),
  code: z.string().regex(/^\d{6}$/),
});

/** Envoi d'un OTP simulé.
 *  - Génère un code 6 chiffres, stocke SHA-256 dans `otp_codes` (TTL 5 min, 3 tentatives).
 *  - Le code est retourné en clair au client UNIQUEMENT parce que le mode SMS est
 *    volontairement simulé (pas de coût provider). Quand un vrai fournisseur sera
 *    branché, retirer `code` du retour et l'envoyer par SMS à la place.
 */
export const sendOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateOtpCode, sha256Hex, toE164Phone } = await import("./otp.server");

    const phoneE164 = toE164Phone(data.phone);
    const code = generateOtpCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // On invalide les OTP encore actifs pour ce téléphone avant d'en créer un nouveau.
    await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", phoneE164)
      .is("consumed_at", null);

    const { error } = await supabaseAdmin.from("otp_codes").insert({
      phone: phoneE164,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });
    if (error) throw new Error(`otp_insert_failed: ${error.message}`);

    // SIMULÉ — code renvoyé pour affichage démo. À supprimer quand un vrai SMS est branché.
    // eslint-disable-next-line no-console
    console.info("[Coup Sûr DEMO] OTP", phoneE164, "→", code);
    return { ok: true as const, code, ttlSec: Math.floor(OTP_TTL_MS / 1000) };
  });

/** Vérifie l'OTP et établit une session Supabase pour le téléphone.
 *  Retourne les tokens à poser côté client via `supabase.auth.setSession(...)`. */
export const verifyOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256Hex, toE164Phone, derivePhonePassword } = await import("./otp.server");
    const { createClient } = await import("@supabase/supabase-js");

    const phoneE164 = toE164Phone(data.phone);
    const nowIso = new Date().toISOString();

    // Récupère l'OTP actif le plus récent pour ce téléphone.
    const { data: rows, error: selErr } = await supabaseAdmin
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("phone", phoneE164)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);
    if (selErr) throw new Error(`otp_select_failed: ${selErr.message}`);
    const otp = rows?.[0];
    if (!otp) return { ok: false as const, reason: "expired" as const };

    if (otp.attempts >= MAX_ATTEMPTS) {
      await supabaseAdmin
        .from("otp_codes")
        .update({ consumed_at: nowIso })
        .eq("id", otp.id);
      return { ok: false as const, reason: "locked" as const };
    }

    const codeHash = await sha256Hex(data.code);
    if (codeHash !== otp.code_hash) {
      const nextAttempts = otp.attempts + 1;
      await supabaseAdmin
        .from("otp_codes")
        .update({
          attempts: nextAttempts,
          consumed_at: nextAttempts >= MAX_ATTEMPTS ? nowIso : null,
        })
        .eq("id", otp.id);
      return {
        ok: false as const,
        reason: "wrong-code" as const,
        remaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
      };
    }

    // Consomme l'OTP.
    await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: nowIso })
      .eq("id", otp.id);

    // Bootstrap de l'utilisateur Supabase à partir du téléphone.
    const secret = process.env.TICKET_HMAC_SECRET;
    if (!secret) throw new Error("TICKET_HMAC_SECRET missing");
    const password = await derivePhonePassword(phoneE164, secret);

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      phone: phoneE164,
      password,
      phone_confirm: true,
    });
    if (createErr && !/already|exists|registered/i.test(createErr.message)) {
      throw new Error(`user_create_failed: ${createErr.message}`);
    }

    // Établit la session via un client publishable, sans persistance.
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: sess, error: signErr } = await anon.auth.signInWithPassword({
      phone: phoneE164,
      password,
    });
    if (signErr || !sess.session) {
      throw new Error(`sign_in_failed: ${signErr?.message ?? "no session"}`);
    }

    return {
      ok: true as const,
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
      },
      userId: sess.session.user.id,
      phone: phoneE164,
    };
  });