import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PhoneInput = z.object({ phone: z.string().regex(/^\d{8}$/) });

/**
 * Vérifie côté serveur si un compte existe déjà pour ce numéro.
 *
 * Le registre local (`lonani.accounts.registry`, dans `account.tsx`) ne
 * connaît que l'appareil courant : sur un nouvel appareil/navigateur, il est
 * vide même si le compte existe bel et bien côté serveur. Cette fonction
 * interroge Supabase (source de vérité) pour lever ce cas.
 */
export const checkPhoneAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toE164Phone } = await import("./otp.server");

    const phoneE164 = toE164Phone(data.phone);

    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name, region")
      .eq("phone", phoneE164)
      .maybeSingle();
    if (error) throw new Error(`profile_check_failed: ${error.message}`);
    if (!row) return { exists: false as const };

    return {
      exists: true as const,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      region: row.region ?? undefined,
    };
  });
