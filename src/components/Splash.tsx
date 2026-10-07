import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
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
  const startedAtRef = useRef(Date.now());

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

    const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - startedAtRef.current));
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
        "fixed inset-0 z-[100] grid place-items-center overflow-hidden",
        "bg-[linear-gradient(180deg,#031c13_0%,#05291d_48%,#02160e_100%)]",
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
      <div className="absolute inset-0 cs-splash-grid" aria-hidden />
      <div className="absolute inset-0 cs-splash-vignette" aria-hidden />

      <div
        className="absolute -left-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-emerald-400/10 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -right-28 h-[34rem] w-[34rem] rounded-full bg-emerald-300/10 blur-3xl"
        aria-hidden
      />

      <div
        className="absolute inset-x-[-35%] top-[20%] h-56 rotate-[-14deg] rounded-[50%] border border-emerald-300/20 shadow-[0_0_40px_rgba(16,185,129,0.12)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-[-35%] top-[24%] h-56 rotate-[-14deg] rounded-[50%] border border-emerald-200/10"
        aria-hidden
      />
      <div
        className="absolute inset-x-[-40%] bottom-[22%] h-64 rotate-[14deg] rounded-[50%] border border-emerald-300/20 shadow-[0_0_45px_rgba(16,185,129,0.12)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-[-40%] bottom-[26%] h-64 rotate-[14deg] rounded-[50%] border border-emerald-200/10"
        aria-hidden
      />

      <div className="absolute left-[-1.5rem] top-10 text-[10rem] leading-none text-emerald-400/[0.07]" aria-hidden>
        ♞
      </div>

      <div className="absolute right-[-1rem] top-28 flex gap-2 opacity-30" aria-hidden>
        <span className="cs-splash-ball">5</span>
        <span className="cs-splash-ball cs-splash-ball-dark">17</span>
      </div>

      <div
        className="absolute bottom-40 right-[-1.5rem] h-44 w-44 rounded-full border-[18px] border-emerald-400/[0.08] shadow-inner"
        aria-hidden
      >
        <span className="absolute inset-7 rounded-full border border-emerald-300/[0.08]" />
      </div>

      <div className="relative flex min-h-screen w-full max-w-md flex-col items-center px-6 pb-10 pt-16 text-center sm:max-w-lg">
        <div className="cs-splash-logo-wrap relative mt-4">
          <div className="cs-splash-glow absolute inset-[-15%] rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="cs-splash-logo relative">
            <img
              src={logoCoupSur}
              alt="Coup Sûr"
              className="relative h-56 w-56 object-contain drop-shadow-[0_18px_42px_rgba(0,0,0,0.55)] sm:h-64 sm:w-64"
            />
            <span className="cs-splash-shine" aria-hidden />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-semibold tracking-[0.28em] text-white sm:text-base">
            PMU · LOTO BALSA · PARI FOOT
          </p>
          <p className="text-sm tracking-[0.18em] text-emerald-100/75">
            Jouez responsable, gagnez en confiance
          </p>
        </div>

        <div className="mt-auto flex flex-col items-center pt-16">
          <div className="cs-splash-spinner" aria-hidden />
          <p className="mt-6 text-base font-semibold text-white">
            Initialisation de l'application...
          </p>
          <p className="mt-2 text-sm tracking-wide text-emerald-100/65">
            {statusText}
          </p>

          <div
            className="mt-14 flex w-full items-center justify-center gap-4 text-emerald-300/70"
            aria-hidden
          >
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-300/40" />
            <ShieldCheck className="h-10 w-10 stroke-[1.6]" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-300/40" />
          </div>
          <p className="mt-3 text-[10px] font-medium tracking-[0.28em] text-emerald-100/55">
            SÉCURITÉ&nbsp;&nbsp;·&nbsp;&nbsp; FIABILITÉ&nbsp;&nbsp;·&nbsp;&nbsp; SIMPLICITÉ
          </p>
        </div>
      </div>

      <style>{SPLASH_CSS}</style>
    </div>
  );
}

const SPLASH_CSS = `
@keyframes cs-splash-reveal {
  0% { opacity: 0; transform: scale(0.82) translateY(18px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes cs-splash-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.018); }
}
@keyframes cs-splash-glow-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.98); }
  50% { opacity: 0.9; transform: scale(1.05); }
}
@keyframes cs-splash-shine-sweep {
  0% { transform: translateX(-150%) skewX(-20deg); opacity: 0; }
  15% { opacity: 0.75; }
  45%, 100% { transform: translateX(150%) skewX(-20deg); opacity: 0; }
}
@keyframes cs-splash-spin {
  to { transform: rotate(360deg); }
}

.cs-splash-grid {
  background-image:
    radial-gradient(circle at 15% 10%, rgba(52,211,153,0.18) 0 1px, transparent 1.5px),
    radial-gradient(circle at 85% 28%, rgba(52,211,153,0.12) 0 1px, transparent 1.5px);
  background-size: 22px 22px, 28px 28px;
  opacity: 0.24;
}
.cs-splash-vignette {
  background:
    radial-gradient(circle at 50% 42%, rgba(16,185,129,0.18), transparent 38%),
    linear-gradient(180deg, rgba(0,25,17,0.1), rgba(0,25,17,0.42));
}
.cs-splash-logo-wrap {
  animation: cs-splash-reveal 650ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.cs-splash-logo {
  animation: cs-splash-breathe 3.2s ease-in-out 650ms infinite;
}
.cs-splash-glow {
  animation: cs-splash-glow-pulse 2.4s ease-in-out infinite;
}
.cs-splash-shine {
  position: absolute;
  inset: 8%;
  overflow: hidden;
  pointer-events: none;
  border-radius: 30%;
}
.cs-splash-shine::after {
  content: "";
  position: absolute;
  top: -20%;
  left: 0;
  width: 34%;
  height: 140%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,0.7) 45%, transparent 90%);
  animation: cs-splash-shine-sweep 2.4s ease-out 1.1s 1;
}
.cs-splash-ball {
  display: grid;
  place-items: center;
  height: 4.5rem;
  width: 4.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(167,243,208,0.18);
  background: radial-gradient(circle at 30% 25%, rgba(52,211,153,0.3), rgba(1,35,24,0.7) 65%);
  box-shadow: inset -10px -10px 20px rgba(0,0,0,0.25), 0 0 25px rgba(16,185,129,0.08);
  color: rgba(236,253,245,0.55);
  font-size: 1.35rem;
  font-weight: 700;
}
.cs-splash-ball-dark {
  transform: translateY(2.2rem);
  opacity: 0.65;
}
.cs-splash-spinner {
  width: 5rem;
  height: 5rem;
  border-radius: 50%;
  border: 5px solid rgba(110,231,183,0.12);
  border-top-color: rgba(52,211,153,0.95);
  border-right-color: rgba(167,243,208,0.7);
  box-shadow: 0 0 25px rgba(16,185,129,0.28);
  animation: cs-splash-spin 1.1s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cs-splash-logo-wrap,
  .cs-splash-logo,
  .cs-splash-glow,
  .cs-splash-shine::after,
  .cs-splash-spinner {
    animation: none !important;
  }
}
`;
