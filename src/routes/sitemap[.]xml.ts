import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// TODO: remplacer par l'URL de production une fois le domaine défini.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // lastmod = date du build. Pour un contenu dynamique par route,
        // remplacer par une date propre à chaque entrée.
        const lastmod = new Date().toISOString().slice(0, 10);

        const entries: SitemapEntry[] = [
          // Pages publiques indexables (jeux + contenus + comptes accessibles sans être connecté)
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/pmu", changefreq: "daily", priority: "0.9" },
          { path: "/loto-balsa", changefreq: "daily", priority: "0.9" },
          { path: "/pari-foot", changefreq: "daily", priority: "0.9" },
          { path: "/resultats", changefreq: "daily", priority: "0.8" },
          { path: "/pronostics", changefreq: "daily", priority: "0.7" },
          { path: "/mes-tickets", changefreq: "weekly", priority: "0.5" },
          { path: "/compte", changefreq: "monthly", priority: "0.4" },
          { path: "/auth", changefreq: "monthly", priority: "0.4" },
          { path: "/conditions", changefreq: "monthly", priority: "0.3" },
          { path: "/confidentialite", changefreq: "monthly", priority: "0.3" },
        ];
        // Exclus volontairement du sitemap :
        // - /admin (route protégée, non indexable)
        // - /ticket/$id et /verify/$token (contenu personnel + jetons)
        // - /sitemap.xml (le sitemap lui-même)

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
