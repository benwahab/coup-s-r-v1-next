import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { getServerConfigStatus } from "@/lib/server-config.functions";
import { supabase } from "@/integrations/supabase/client";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=480&quality=92&url";

const MIN_DISPLAY_MS = 5000;
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
        const clientOk =
          !!import.meta.env.VITE_SUPABASE_URL &&
          !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        if (!clientOk) {
          if (!cancelled) setServerError(true);
          return;
        }

        const config = await getServerConfigStatus();
        if (!config.ready) {
          if (!cancelled) {
            setServerReady(false);
            setServerError(true);
          }
          return;
        }

        // Real client-side reachability check: the Supabase Auth endpoint must respond.
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

    const startedAt = Date.now();
    const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - startedAt));
    const timer = window.setTimeout(() => {
      setLeaving(true);
      window.setTimeout(() => setShow(false), 300);
    }, wait);

    return () => window.clearTimeout(timer);
  }, [serverReady]);

  if (!show) return null;

  const statusText = serverError
    ? t("shell.splash.serverError")
    : serverReady
      ? t("shell.splash.serverReady")
      : t("shell.splash.checkingServer");

  return (
    <div
      className={[
        "fixed inset-0 z-[100] grid place-items-center bg-hero overflow-hidden",
        "transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
        serverReady ? "cursor-pointer" : "cursor-wait",
      ].join(" ")}
      onClick={() => {
        if (!serverReady) return;
        setLeaving(true);
        window.setTimeout(() => setShow(false), 300);
      }}
      role="status"
      aria-live="polite"
      aria-label={t("shell.splash.skip")}
    >
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40 animate-pulse"
        style={{
          background: "radial-gradient(circle, oklch(0.86 0.16 88 / 0.5), transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-40 animate-pulse"
        style={{
          background: "radial-gradient(circle, oklch(0.82 0.20 150 / 0.4), transparent 70%)",
          animationDelay: "0.8s",
        }}
      />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <div className="cs-splash-logo-wrap relative">
          <div className="cs-splash-glow absolute inset-0 rounded-3xl bg-gold-gradient blur-2xl" />
          <div className="cs-splash-logo relative">
            <img
              src={logoCoupSur}
              alt="Coup Sûr"
              className="relative h-40 w-40 sm:h-52 sm:w-52 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            />
            <span className="cs-splash-shine" aria-hidden />
          </div>
        </div>
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
        <p className="text-xs font-semibold tracking-wide text-white/70">{statusText}</p>
      </div>
      <style>{SPLASH_CSS}</style>
    </div>
  );
}

const SPLASH_CSS = `
@keyframes cs-splash-reveal {
  0%   { opacity: 0; transform: scale(0.35) rotate(-24deg); }
  55%  { opacity: 1; transform: scale(1.12) rotate(4deg); }
  75%  { transform: scale(0.96) rotate(-1.5deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
@keyframes cs-splash-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.035); }
}
@keyframes cs-splash-glow-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 0.75; transform: scale(1.08); }
}
@keyframes cs-splash-shine-sweep {
  0%   { transform: translateX(-140%) skewX(-20deg); opacity: 0; }
  8%   { opacity: 0.85; }
  35%  { opacity: 0; }
  100% { transform: translateX(140%) skewX(-20deg); opacity: 0; }
}

.cs-splash-logo-wrap { animation: cs-splash-reveal 750ms cubic-bezier(0.22, 1.4, 0.36, 1) both; }
.cs-splash-logo { animation: cs-splash-breathe 2.6s ease-in-out 750ms infinite; }
.cs-splash-glow { animation: cs-splash-glow-pulse 2.2s ease-in-out infinite; }
.cs-splash-shine {
  position: absolute; inset: 0;
  overflow: hidden;
  pointer-events: none;
  border-radius: inherit;
}
.cs-splash-shine::after {
  content: "";
  position: absolute; top: -20%; left: 0; width: 40%; height: 140%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.65) 45%, transparent 90%);
  animation: cs-splash-shine-sweep 1.6s ease-out 850ms 1;
}

@media (prefers-reduced-motion: reduce) {
  .cs-splash-logo-wrap, .cs-splash-logo, .cs-splash-glow, .cs-splash-shine::after {
    animation: none !important;
  }
}
`;
