import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version ?? "unknown",
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        ),
    },
  },
});
