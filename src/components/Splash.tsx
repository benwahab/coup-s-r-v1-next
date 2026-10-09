import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=480&quality=92&url";

const SERVER_RETRY_MS = 2000;

import splashVisual from "@/assets/coup-sur-splash-visual.svg";
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
        const clientOk =
          !!import.meta.env.VITE_SUPABASE_URL &&
          !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!clientOk) {
          if (!cancelled) setServerError(true);
          return;
        }

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

        const { error } = await supabase.auth.getSession();
        if (cancelled) return;

        if (error) {
          setServerReady(false);
          setServerError(true);
          return;
        }

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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(16,185,129,0.22),transparent_42%),linear-gradient(180deg,#062d20_0%,#031c13_55%,#01130c_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-4 pb-7 pt-7 text-center sm:px-6 sm:pt-10">
        <div className="relative z-10 shrink-0">
          <div className="absolute inset-[-12%] rounded-full bg-emerald-400/15 blur-2xl" aria-hidden />
          <img
            src={logoCoupSur}
            alt="Coup Sûr"
            className="relative h-32 w-32 object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)] sm:h-40 sm:w-40"
          />
        </div>

        <div className="relative z-10 mt-1 shrink-0 space-y-1 sm:mt-2">
          <p className="text-xs font-bold tracking-[0.2em] text-white sm:text-sm">
            PMU · LOTO BALSA · PARI FOOT
          </p>
          <p className="text-xs text-emerald-100/75 sm:text-sm">
            Jouez responsable, gagnez en confiance
          </p>
        </div>

        <div className="relative z-10 my-5 flex min-h-0 w-full flex-1 items-center justify-center sm:my-7">
          <img
            src={splashVisual}
            alt="Course hippique, boules de loto et football"
            className="h-auto max-h-[58vh] w-full max-w-[940px] object-contain drop-shadow-[0_18px_45px_rgba(0,0,0,0.48)] sm:max-h-[60vh]"
          />
        </div>

        <div className="relative z-10 flex shrink-0 flex-col items-center">
          <div className="cs-splash-spinner" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-white sm:text-base">
            Initialisation de l'application...
          </p>
          <p className="mt-1 text-xs text-emerald-100/70 sm:text-sm">
            {statusText}
          </p>
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
