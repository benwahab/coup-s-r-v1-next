import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Authoritative server-side gate for normal authenticated business actions.
 * The password_setup_required profile flag is checked on every sensitive request,
 * so a stale JWT cannot bypass the OTP/password bootstrap restriction.
 */
export const requireConfiguredUser = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("password_setup_required")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) {
      console.error("[Auth] configured-user lookup failed", error);
      throw new Error("Authentication state unavailable");
    }

    if (!profile) {
      throw new Error("Authentication profile missing");
    }

    if (profile.password_setup_required === true) {
      throw new Error("password_setup_required");
    }

    return next({ context });
  });
