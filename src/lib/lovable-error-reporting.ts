type LovableErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "vite_preload" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

export function reportLovableError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;

  const normalized =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : String(error));

  const mechanism: LovableErrorOptions["mechanism"] =
    context.boundary === "unhandled_rejection"
      ? "unhandledrejection"
      : context.boundary === "window_error"
        ? "onerror"
        : context.boundary === "vite_preload_error"
          ? "vite_preload"
          : "react_error_boundary";

  window.__lovableEvents?.captureException?.(
    normalized,
    {
      source: "coup_sur_preview_runtime",
      route: window.location.pathname,
      href: window.location.href,
      buildId: import.meta.env.VITE_APP_VERSION ?? "unknown",
      errorName: normalized.name,
      errorMessage: normalized.message,
      errorStack: normalized.stack,
      ...context,
    },
    {
      mechanism,
      handled: false,
      severity: "error",
    },
  );
}
