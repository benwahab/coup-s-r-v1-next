import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=480&quality=92&url";

const SERVER_RETRY_MS = 2000;

export function Splash() {
  const { t } = useI18n();
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [serverError, setServerError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkServer = async () => {
      try {
        const healthResponse = await fetch("/health", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!healthResponse.ok) {
          throw new Error(`Health check failed: ${healthResponse.status}`);
        }

        const health = (await healthResponse.json()) as { status?: string };
        if (health.status !== "healthy") {
          throw new Error("Health check returned an invalid status");
        }

        if (cancelled) return;

        // The splash is a server-readiness gate, not an authentication gate.
        // Supabase session recovery is handled independently by AuthProvider so a
        // transient auth/storage failure cannot trap the entire Preview on startup.
        setServerError(false);
        setServerReady(true);
      } catch {
        if (!cancelled) {
          setServerReady(false);
          setServerError(true);
        }
      }
    };

    void checkServer();
    const retry = window.setInterval(() => void checkServer(), SERVER_RETRY_MS);

    return () => {
      cancelled = true;
      window.clearInterval(retry);
    };
  }, []);

  useEffect(() => {
    if (!serverReady) return;

    setLeaving(true);
    const timer = window.setTimeout(() => setShow(false), 300);

    return () => window.clearTimeout(timer);
  }, [serverReady]);

  if (!show) return null;

  const statusText = serverError
    ? t("shell.splash.serverError")
    : t("shell.splash.checkingServer");

  return (
    <div
      className={[
        "fixed inset-0 z-[100] overflow-hidden bg-[#031c13]",
        "transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label={t("shell.splash.skip")}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url("/coup-sur-auth-background.webp")' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/45" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(16,185,129,0.14),transparent_48%),linear-gradient(180deg,rgba(1,19,12,0.12)_0%,rgba(1,19,12,0.52)_100%)]" aria-hidden />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-4 pb-7 pt-7 text-center sm:px-6 sm:pt-10">
        <div className="relative z-10 shrink-0">
          <div className="absolute inset-[-10%] rounded-full bg-emerald-400/20 blur-2xl" aria-hidden />
          <img
            src={logoCoupSur}
            alt="Coup Sûr"
            className="relative h-24 w-24 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)] sm:h-28 sm:w-28"
          />
        </div>

        <div className="relative z-10 my-4 flex min-h-0 w-full flex-1 items-end justify-center sm:my-6 sm:items-center">
          <div className="rounded-2xl border border-white/15 bg-black/25 px-5 py-4 shadow-2xl backdrop-blur-[2px]">
            <p className="text-sm font-bold text-white sm:text-base">Initialisation de l'application...</p>
            <div className="mt-3 flex items-center justify-center gap-3">
              <div className="cs-splash-spinner" aria-hidden />
              <p className="text-xs font-medium text-emerald-50/85 sm:text-sm">{statusText}</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex shrink-0 flex-col items-center">
          <p className="text-[11px] text-white/60">Connexion sécurisée au serveur</p>
        </div>
      </div>

      <style>{SPLASH_CSS}</style>
    </div>
  );
}

const SPLASH_CSS = `
@keyframes cs-splash-spin {
  to { transform: rotate(360deg); }
}

.cs-splash-spinner {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  border: 4px solid rgba(110,231,183,0.12);
  border-top-color: rgba(52,211,153,0.95);
  border-right-color: rgba(167,243,208,0.7);
  box-shadow: 0 0 22px rgba(16,185,129,0.25);
  animation: cs-splash-spin 1.1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cs-splash-spinner {
    animation: none !important;
  }
}
`;
