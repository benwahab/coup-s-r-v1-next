import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export async function writeAuditLog(
  supabaseAdmin: SB,
  input: {
    userId?: string | null;
    action: string;
    detail?: Record<string, unknown>;
    ip?: string | null;
  },
) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    user_id: input.userId ?? null,
    action: input.action,
    detail: input.detail ?? null,
    ip: input.ip ?? null,
  });
  if (error) {
    // Audit failure must not turn a successful business operation into a
    // misleading failure, but it remains visible in server logs for alerting.
    console.error("[audit] write failed", error.message);
  }
}
