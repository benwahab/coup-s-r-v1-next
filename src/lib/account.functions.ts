import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PhoneInput = z.object({ phone: z.string().regex(/^\d{8}$/) });

/**
 * Vérifie côté serveur si un compte existe déjà pour ce numéro.
 *
 * Cette route est volontairement limitée à un booléen : elle est appelée avant
 * la connexion/création depuis une page publique et ne doit jamais divulguer
 * le nom, la région ou d'autres données du profil d'un numéro donné.
 *
 * La source de vérité reste Supabase (et non le registre local de l'appareil).
 */
export const checkPhoneAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PhoneInput.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toE164Phone } = await import("./otp.server");

    const phoneE164 = toE164Phone(data.phone);

    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phoneE164)
      .maybeSingle();

    if (error) throw new Error("profile_check_failed");
    return { exists: !!row };
  });
