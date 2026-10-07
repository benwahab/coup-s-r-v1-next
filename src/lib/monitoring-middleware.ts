import { createMiddleware } from "@tanstack/react-start";
import { isUntracked, newTraceId, serviceFromFilename } from "./monitoring.shared";
import { recordClientCall } from "./monitoring-client";

/**
 * Suivi de bout en bout de chaque appel serveur : un identifiant de suivi est créé
 * dans le navigateur, transmis au serveur, et la durée est mesurée des deux côtés.
 */
export const monitoringMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next, serverFnMeta, method }) => {
    const fnName = readableFnName(serverFnMeta.id);
    if (fnName === "ingestClientEvents") return next();
    const traceId = newTraceId();
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const ms = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
    try {
      const result = await next({ sendContext: { traceId } });
      recordClientCall({ traceId, fnId: fnName, method, durationMs: ms(), ok: true });
      return result;
    } catch (error) {
      recordClientCall({
        traceId,
        fnId: fnName,
        method,
        durationMs: ms(),
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })
  .server(async ({ next, context, serverFnMeta, method }) => {
    if (isUntracked(serverFnMeta.name)) return next({ context: { traceId: newTraceId() } });
    const rawTrace = (context as { traceId?: unknown }).traceId;
    const traceId =
      typeof rawTrace === "string" && /^trace_[0-9A-F]{8}$/.test(rawTrace) ? rawTrace : newTraceId();
    const t0 = Date.now();
    const finish = async (status: number, message?: string) => {
      const { recordServerEvent, currentEnvironment, pruneOldEvents } = await import(
        "./monitoring.server"
      );
      const { getRequestHost } = await import("@tanstack/react-start/server");
      let host: string | null = null;
      try {
        host = getRequestHost();
      } catch {
        host = null;
      }
      const duration = Date.now() - t0;
      await recordServerEvent({
        traceId,
        service: serviceFromFilename(serverFnMeta.filename),
        endpoint: serverFnMeta.name,
        method,
        status,
        durationMs: duration,
        level: status >= 500 ? "ERROR" : status >= 400 ? "WARNING" : duration > 3000 ? "WARNING" : "INFO",
        message,
        environment: currentEnvironment(host),
      });
      if (Math.random() < 0.01) await pruneOldEvents();
    };
    try {
      const result = await next({ context: { traceId } });
      await finish(200);
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const status = /forbidden|unauthori|permission/i.test(msg) ? 403 : 500;
      await finish(status, msg);
      throw error;
    }
  });

/** Convertit l'identifiant technique (base64url JSON) en nom lisible de fonction. */
function readableFnName(id: string): string {
  try {
    const json = JSON.parse(atob(id.replace(/-/g, "+").replace(/_/g, "/")));
    const exp = typeof json?.export === "string" ? json.export : "";
    return exp.replace(/_createServerFn_handler$/, "") || id.slice(0, 80);
  } catch {
    return id.slice(0, 80);
  }
}
