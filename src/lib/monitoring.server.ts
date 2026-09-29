import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sanitize, type MonitoringLevel } from "./monitoring.shared";

export function currentEnvironment(host: string | null | undefined): string {
  const h = (host ?? "").toLowerCase();
  if (!h || h.startsWith("localhost") || h.includes("id-preview--") || h.endsWith("-dev.lovable.app")) {
    return "preview";
  }
  return "production";
}

export interface ServerEventInput {
  traceId: string;
  service: string;
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
  level: MonitoringLevel;
  message?: string | null;
  sessionHash?: string | null;
  environment: string;
}

/** Enregistre un événement serveur. Ne bloque jamais la requête en cas d'échec. */
export async function recordServerEvent(e: ServerEventInput): Promise<void> {
  try {
    await supabaseAdmin.from("monitoring_events").insert({
      trace_id: e.traceId,
      source: "server",
      level: e.level,
      service: e.service,
      method: e.method,
      endpoint: e.endpoint,
      status: e.status,
      duration_ms: Math.round(e.durationMs),
      spans: [{ name: "Serveur", ms: Math.round(e.durationMs) }],
      session_hash: e.sessionHash ?? null,
      message: sanitize(e.message ?? null),
      environment: e.environment,
    });
  } catch {
    // La supervision ne doit jamais casser l'application.
  }
}

/** Rétention : supprime les événements de plus de 14 jours (appel occasionnel). */
export async function pruneOldEvents(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 14 * 86400_000).toISOString();
    await supabaseAdmin.from("monitoring_events").delete().lt("created_at", cutoff);
  } catch {
    /* ignoré */
  }
}
