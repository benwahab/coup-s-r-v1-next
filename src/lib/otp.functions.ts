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
  profile: z
    .object({
      firstName: z.string().trim().max(80).optional(),
      lastName: z.string().trim().max(80).optional(),
      region: z.string().trim().max(80).optional(),
    })
    .optional(),
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

    // Limitation de débit serveur : évite qu'un même numéro déclenche un
    // nombre illimité de demandes d'OTP (spam, coût SMS futur, contournement
    // du compteur de tentatives en redemandant sans cesse un nouveau code).
    const windowStartIso = new Date(Date.now() - OTP_RATE_WINDOW_MS).toISOString();
    const { count: recentCount, error: rateErr } = await supabaseAdmin
      .from("otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("phone", phoneE164)
      .gte("created_at", windowStartIso);
    if (rateErr) throw new Error(`otp_rate_check_failed: ${rateErr.message}`);
    if ((recentCount ?? 0) >= MAX_OTP_REQUESTS_PER_WINDOW) {
      return { ok: false as const, reason: "rate-limited" as const };
    }

    const code = generateOtpCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    // On invalide les OTP encore actifs pour ce téléphone avant d'en créer un nouveau.
    const { error: invalidateError } = await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", phoneE164)
      .is("consumed_at", null);
    if (invalidateError) throw new Error(`otp_invalidate_failed: ${invalidateError.message}`);

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
      const { data: failedAttemptUpdate, error: failedAttemptError } = await supabaseAdmin
        .from("otp_codes")
        .update({
          attempts: nextAttempts,
          consumed_at: nextAttempts >= MAX_ATTEMPTS ? nowIso : null,
        })
        .eq("id", otp.id)
        .is("consumed_at", null)
        .eq("attempts", otp.attempts)
        .select("id")
        .maybeSingle();
      if (failedAttemptError) throw new Error(`otp_attempt_update_failed: ${failedAttemptError.message}`);
      if (!failedAttemptUpdate) return { ok: false as const, reason: "already-used" as const };
      await writeAuditLog(supabaseAdmin, {
        action: "auth.otp.failed",
        detail: { phone: phoneE164, remaining: Math.max(0, MAX_ATTEMPTS - nextAttempts) },
      });
      return {
        ok: false as const,
        reason: "wrong-code" as const,
        remaining: Math.max(0, MAX_ATTEMPTS - nextAttempts),
      };
    }

    // Consomme l'OTP.
    const { data: consumedOtp, error: consumeError } = await supabaseAdmin
      .from("otp_codes")
      .update({ consumed_at: nowIso })
      .eq("id", otp.id)
      .is("consumed_at", null)
      .eq("attempts", otp.attempts)
      .select("id")
      .maybeSingle();
    if (consumeError) throw new Error(`otp_consume_failed: ${consumeError.message}`);
    if (!consumedOtp) return { ok: false as const, reason: "already-used" as const };

    // Bootstrap de l'utilisateur Supabase à partir du téléphone.
    // Le provider "phone" n'est pas activé sur ce projet Supabase → on utilise
    // une adresse e-mail synthétique dérivée du téléphone (le provider e-mail
    // est actif par défaut). Le numéro reste stocké dans auth.users.phone et
    // dans profiles.phone.
    const secret = process.env.TICKET_HMAC_SECRET;
    if (!secret) throw new Error("TICKET_HMAC_SECRET missing");
    const password = await derivePhonePassword(phoneE164, secret);
    const email = `phone-${phoneE164.replace(/\D/g, "")}@coup-sur.local`;

    // Client publishable, sans persistance, pour établir la session.
    const anon = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    // Tente une connexion : si l'utilisateur existe déjà avec cet e-mail, OK.
    let signRes = await anon.auth.signInWithPassword({ email, password });
    if (signRes.error || !signRes.data.session) {
      // Cherche un utilisateur existant par téléphone (issu d'anciens comptes
      // créés avec le provider phone qui est désormais désactivé).
      const phoneWithoutPlus = phoneE164.replace(/^\+/, "");
      let existingUserId: string | undefined;
      for (let page = 1; page <= 10 && !existingUserId; page++) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (listErr) break;
        const match = list.users.find(
          (u) => u.phone === phoneWithoutPlus || u.phone === phoneE164,
        );
        if (match) existingUserId = match.id;
        if (!list.users.length || list.users.length < 200) break;
      }
      if (existingUserId) {
        // Migre l'utilisateur existant vers e-mail/mot de passe.
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
          existingUserId,
          { email, password, email_confirm: true },
        );
        if (updErr) throw new Error(`user_update_failed: ${updErr.message}`);
      } else {
        const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          phone: phoneE164,
          email_confirm: true,
          phone_confirm: true,
        });
        if (createErr && !/already|exists|registered/i.test(createErr.message)) {
          throw new Error(`user_create_failed: ${createErr.message}`);
        }
      }
      signRes = await anon.auth.signInWithPassword({ email, password });
      if (signRes.error || !signRes.data.session) {
        throw new Error(`sign_in_failed: ${signRes.error?.message ?? "no session"}`);
      }
    }
    const sess = signRes.data;

    // Upsert du profil : le trigger `handle_new_user` a inséré la ligne de base
    // (id + phone). On complète avec les champs facultatifs saisis avant l'OTP.
    const p = data.profile;
    if (p && (p.firstName || p.lastName || p.region)) {
      const patch: Record<string, string | null> = { phone: phoneE164 };
      if (p.firstName !== undefined) patch.first_name = p.firstName || null;
      if (p.lastName !== undefined) patch.last_name = p.lastName || null;
      if (p.region !== undefined) patch.region = p.region || null;
      const { error: profileUpsertError } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: sess.session.user.id, ...patch }, { onConflict: "id" });
      if (profileUpsertError) {
        await writeAuditLog(supabaseAdmin, {
          userId: sess.session.user.id,
          action: "auth.profile_sync.failed",
          detail: { phone: phoneE164, error: profileUpsertError.message },
        });
        throw new Error("profile_sync_failed");
      }
    }

    // Récupère le profil existant (utile côté client pour réafficher nom/région
    // sur un nouvel appareil, où le compte local est encore vide).
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, region")
      .eq("id", sess.session.user.id)
      .maybeSingle();

    await writeAuditLog(supabaseAdmin, {
      userId: sess.session.user.id,
      action: "auth.otp.verified",
      detail: { phone: phoneE164 },
    });

    return {
      ok: true as const,
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
      },
      userId: sess.session.user.id,
      phone: phoneE164,
      profile: profileRow
        ? {
            firstName: profileRow.first_name ?? undefined,
            lastName: profileRow.last_name ?? undefined,
            region: profileRow.region ?? undefined,
          }
        : null,
    };
  });