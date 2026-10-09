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

  return (
    <div
      className={[
        "fixed inset-0 z-[100] overflow-hidden",
        "bg-black bg-[url('/coup-sur-auth-background.webp')] bg-cover bg-center bg-no-repeat",
        "transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-label={t("shell.splash.skip")}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.12),transparent_46%),linear-gradient(180deg,rgba(1,19,12,0.08)_0%,rgba(1,19,12,0.48)_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-4 pb-10 pt-10 text-center sm:px-6 sm:pt-14">
        <div className="relative z-10 shrink-0">
          <div
            className="absolute inset-[-12%] rounded-full bg-emerald-400/20 blur-2xl"
            aria-hidden
          />
          <img
            src={logoCoupSur}
            alt="Coup Sûr"
            className="relative h-24 w-24 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.65)] sm:h-28 sm:w-28"
          />
        </div>

        <div className="relative z-10 flex min-h-0 w-full flex-1 items-end justify-center pb-10 sm:items-center sm:pb-0">
          <div className="flex flex-col items-center">
            <div className="cs-splash-spinner" aria-hidden />
            <p className="mt-4 text-sm font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)] sm:text-base">
              Connexion
            </p>
          </div>
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
