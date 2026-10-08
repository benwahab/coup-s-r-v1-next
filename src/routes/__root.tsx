import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import logoCoupSur from "@/assets/logo-coup-sur.png";
import { reportLovableError } from "../lib/lovable-error-reporting";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import { I18nProvider } from "@/lib/i18n";
import { TicketsProvider } from "@/lib/tickets";
import { AccountProvider } from "@/lib/account";
import { AuthProvider } from "@/lib/auth";
import { DraftsProvider } from "@/lib/drafts";
import { AppShell } from "@/components/AppShell";
import { Splash } from "@/components/Splash";

function rootLangText(fr: string, en: string) {
  if (typeof window === "undefined") return fr;
  try {
    return localStorage.getItem("lonani.lang") === "en" ? en : fr;
  } catch {
    return fr;
  }
}

const PREVIEW_RELOAD_KEY = "coupsur.preview.reload-once";

function isTransientChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i.test(
    message,
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{rootLangText("Page introuvable", "Page not found")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {rootLangText("La page que vous recherchez n’existe pas ou a été déplacée.", "The page you’re looking for doesn’t exist or has been moved.")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, info }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    reportLovableError(error, {
      boundary: "tanstack_root_error_component",
      componentStack: info?.componentStack,
    });

    if (!isTransientChunkError(error) || typeof window === "undefined") return;

    try {
      if (sessionStorage.getItem(PREVIEW_RELOAD_KEY) === "1") {
        sessionStorage.removeItem(PREVIEW_RELOAD_KEY);
        return;
      }
      sessionStorage.setItem(PREVIEW_RELOAD_KEY, "1");
      window.location.reload();
    } catch {
      // If storage is unavailable, leave the normal error screen available.
    }
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {rootLangText("Cette page n’a pas pu être chargée", "This page didn’t load")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rootLangText("Une erreur s’est produite. Vous pouvez actualiser la page ou revenir à l’accueil.", "Something went wrong on our end. You can try refreshing or head back home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(PREVIEW_RELOAD_KEY);
              } catch {
                // Ignore unavailable storage.
              }
              window.location.reload();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Coup Sûr — Jouez en ligne au Niger" },
      {
        name: "description",
        content:
          "Jouez au PMU, Loto Balsa et Pari Foot en ligne au Niger. Paiement par Airtel Money. Reçu numérique sécurisé avec QR Code.",
      },
      { name: "author", content: "Coup Sûr" },
      { property: "og:title", content: "Coup Sûr — Jouez en ligne au Niger" },
      {
        property: "og:description",
        content:
          "PMU, Loto Balsa, Pari Foot. Paiement mobile, reçu QR Code, notifications de gain par SMS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: logoCoupSur,
        type: "image/png",
      },
      ...(import.meta.env.VITE_SUPABASE_URL
        ? [
            { rel: "preconnect", href: import.meta.env.VITE_SUPABASE_URL },
            { rel: "dns-prefetch", href: import.meta.env.VITE_SUPABASE_URL },
          ]
        : []),
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
  headers: () => ({
    // HTML must not stay cached across deployments because Vite can invalidate hashed chunks.
    "Cache-Control": "no-cache",
  }),
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Splash />
        <AccountProvider>
          <AuthProvider>
            <TicketsProvider>
              <DraftsProvider>
                <AppShell>
                  {/* Required: nested routes render here. */}
                  <Outlet />
                </AppShell>
              </DraftsProvider>
            </TicketsProvider>
          </AuthProvider>
        </AccountProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
