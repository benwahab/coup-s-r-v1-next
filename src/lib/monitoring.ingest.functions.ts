import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sanitize } from "@/lib/monitoring.shared";

const ClientEvent = z.object({
  traceId: z.string().regex(/^trace_[0-9A-F]{8}$/),
  fnId: z.string().trim().min(1).max(200),
  method: z.string().trim().min(1).max(20),
  durationMs: z.number().finite().min(0).max(120_000),
  ok: z.boolean(),
  message: z.string().max(500).optional(),
  page: z.string().max(200).optional(),
  appVersion: z.string().max(50).optional(),
  device: z.string().max(50).optional(),
  userAgent: z.string().max(500).optional(),
});

export const ingestClientEvents = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ events: z.array(ClientEvent).min(1).max(20) }).parse(data))
  .handler(async ({ data }) => {
    const { getRequestHost } = await import("@tanstack/react-start/server");
    let host: string | null = null;
    try { host = getRequestHost(); } catch {}
    const { currentEnvironment } = await import("@/lib/monitoring.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const environment = currentEnvironment(host);
    const rows = data.events.map(e => ({
      trace_id: e.traceId,
      source: "client",
      level: e.ok ? "INFO" : "ERROR",
      service: "Navigateur",
      endpoint: sanitize(e.fnId, 200),
      method: sanitize(e.method, 20),
      status: e.ok ? 200 : 500,
      duration_ms: Math.round(e.durationMs),
      spans: [{ name: "Navigateur", ms: Math.round(e.durationMs) }],
      page: sanitize(e.page, 200),
      user_agent: sanitize(e.userAgent ?? null, 500),
      device: sanitize(e.device, 50),
      app_version: sanitize(e.appVersion, 50),
      message: sanitize(e.message ?? null),
      environment,
    }));
    const { error } = await supabaseAdmin.from("monitoring_events").insert(rows);
    if (error) throw new Error("monitoring_ingest_failed");
    return { accepted: rows.length };
  });
