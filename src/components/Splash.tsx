import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=320&quality=92&url";

const SEEN_KEY = "coupsur.splash.seen";

export function Splash() {
  const { t } = useI18n();
  // Ne montre le splash qu'au 1er chargement de la session navigateur.
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(SEEN_KEY) === "1") return;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch { /* ignore */ }
    setShow(true);
    // Bloque au maximum 1,8s au tout premier chargement de la session
    // (légèrement rallongé pour laisser le temps à l'animation du logo).
    const t1 = setTimeout(() => setLeaving(true), 1350);
    const t2 = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[100] grid place-items-center bg-hero overflow-hidden cursor-pointer",
        "transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      ].join(" ")}
      onClick={() => { setLeaving(true); setTimeout(() => setShow(false), 300); }}
      role="button"
      aria-label={t("shell.splash.skip")}
    >
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div
        className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-40 animate-pulse"
        style={{ background: "radial-gradient(circle, oklch(0.86 0.16 88 / 0.5), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-40 animate-pulse"
        style={{ background: "radial-gradient(circle, oklch(0.82 0.20 150 / 0.4), transparent 70%)", animationDelay: "0.8s" }}
      />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <div className="cs-splash-logo-wrap relative">
          <div className="cs-splash-glow absolute inset-0 rounded-3xl bg-gold-gradient blur-2xl" />
          <div className="cs-splash-logo relative">
            <img
              src={logoCoupSur}
              alt="Coup Sûr"
              className="relative h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
            />
            <span className="cs-splash-shine" aria-hidden />
          </div>
        </div>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
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