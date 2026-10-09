import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { monitoringMiddleware } from "./lib/monitoring-middleware";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    const request = getRequest();

    // Server Function RPC errors must stay in TanStack Start's serialized
    // response format. Turning them into HTML makes the client report a
    // misleading "network unavailable" error.
    if (request?.method !== "GET" && request?.method !== "HEAD") {
      throw error;
    }

    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, monitoringMiddleware],
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
