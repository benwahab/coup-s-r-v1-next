import { StartClient } from "@tanstack/react-start/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { reportLovableError } from "./lib/lovable-error-reporting";

const PREVIEW_RELOAD_KEY = "coupsur.preview.vite-preload-reload-once";
const BUILD_ID = import.meta.env.VITE_APP_VERSION ?? "unknown";

function asError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

function reloadOnceForPreloadError(error: unknown) {
  if (typeof window === "undefined") return;

  reportLovableError(asError(error), {
    boundary: "vite_preload_error",
    buildId: BUILD_ID,
    message: asError(error).message,
  });

  try {
    if (sessionStorage.getItem(PREVIEW_RELOAD_KEY) === "1") {
      sessionStorage.removeItem(PREVIEW_RELOAD_KEY);
      return;
    }

    sessionStorage.setItem(PREVIEW_RELOAD_KEY, "1");
    window.location.reload();
  } catch {
    // If storage is unavailable, let Vite surface the original error.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener(
    "vite:preloadError",
    (event: Event & { payload?: unknown }) => {
      event.preventDefault();
      reloadOnceForPreloadError(event.payload);
    },
  );

  window.addEventListener("error", (event) => {
    if (!event.error) return;
    reportLovableError(event.error, {
      boundary: "window_error",
      buildId: BUILD_ID,
      filename: event.filename || undefined,
      lineno: event.lineno || undefined,
      colno: event.colno || undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportLovableError(asError(event.reason), {
      boundary: "unhandled_rejection",
      buildId: BUILD_ID,
    });
  });
}

type PreviewErrorBoundaryState = {
  error: Error | null;
};

class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): PreviewErrorBoundaryState {
    return { error: asError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    const normalized = asError(error);
    reportLovableError(normalized, {
      boundary: "client_entry_error_boundary",
      buildId: BUILD_ID,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>
            Cette page n’a pas pu être chargée
          </h1>
          <p style={{ marginTop: 10, lineHeight: 1.5 }}>
            Une erreur de démarrage de l’application s’est produite. Vous pouvez
            actualiser la page pour réessayer.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 18,
              padding: "10px 16px",
              border: 0,
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Actualiser
          </button>
        </div>
      </div>
    );
  }
}

hydrateRoot(
  document,
  <PreviewErrorBoundary>
    <StartClient />
  </PreviewErrorBoundary>,
);
