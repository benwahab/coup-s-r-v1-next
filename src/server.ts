import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(request: Request, response: Response): Promise<Response> {
  // Server-function RPC errors must keep TanStack Start's JSON envelope. Converting
  // them to an HTML error page makes the browser report a misleading "network"
  // failure and breaks auth/recovery actions. Only normalize document requests.
  const acceptsHtml = request.headers.get("accept")?.includes("text/html") ?? false;
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (!acceptsHtml) return response;
  // Keep Server Function RPC errors in Start's JSON format; HTML is only for document requests.\n  if (request.method !== "GET" && request.method !== "HEAD") return response;\n  if (!(request.headers.get("accept")?.includes("text/html") ?? false)) return response;\n  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (new URL(request.url).pathname === "/health") {
      // Keep this endpoint runtime-agnostic: Lovable Preview may execute the
      // server entry in an edge-like runtime where Node's process API is absent.
      const runtimeProcess = typeof process !== "undefined" ? process : undefined;
      return Response.json(
        {
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime:
            runtimeProcess && typeof runtimeProcess.uptime === "function"
              ? runtimeProcess.uptime()
              : null,
          version: runtimeProcess?.env?.npm_package_version ?? "unknown",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(request, response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
