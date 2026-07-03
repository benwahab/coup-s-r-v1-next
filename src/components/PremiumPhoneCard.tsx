import { useEffect, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  statusLabel?: string;
};

/**
 * Coque smartphone premium (iPhone-like) avec île dynamique, reflet verre,
 * bouton latéral, ombre portée, et arrière-plan à boules de loto numérotées.
 * Partagé entre /auth et /compte.
 */
export function PremiumPhoneCard({ children, statusLabel = "COUP SÛR" }: Props) {
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setParallax({
          x: (e.clientX / window.innerWidth - 0.5) * 2,
          y: (e.clientY / window.innerHeight - 0.5) * 2,
        });
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cs-auth-scope relative isolate min-h-[calc(100vh-64px)] overflow-hidden">
      <LotoBackdrop parallax={parallax} />
      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 py-6 sm:py-10">
        <div
          className="cs-phone relative w-full max-w-[400px]"
          style={{
            transform: `perspective(1400px) rotateX(${parallax.y * -1.2}deg) rotateY(${parallax.x * 1.8}deg)`,
          }}
        >
          {/* Bouton latéral droit */}
          <span className="cs-phone-btn" aria-hidden />
          {/* Boutons volume gauche */}
          <span className="cs-phone-btn-vol vol1" aria-hidden />
          <span className="cs-phone-btn-vol vol2" aria-hidden />

          <div className="cs-phone-shell">
            <div className="cs-phone-screen">
              <div className="cs-notch" aria-hidden />
              <div className="cs-glass-reflection" aria-hidden />

              <div className="flex items-center justify-between px-6 pt-3 text-[10px] font-semibold text-white/70 relative z-10">
                <span className="tabular-nums">9:41</span>
                <span className="tracking-[0.22em]">{statusLabel}</span>
                <span className="tabular-nums">••• 100%</span>
              </div>

              <div className="cs-phone-content relative z-10">{children}</div>

              <div className="cs-home-indicator" aria-hidden />
            </div>
          </div>
          <div className="cs-phone-reflection" aria-hidden />
        </div>
      </div>
      <style>{CS_CARD_CSS}</style>
    </div>
  );
}

const LOTO_BALLS: Array<{ n: number; cls: string }> = [
  { n: 7, cls: "b1" },
  { n: 13, cls: "b2" },
  { n: 21, cls: "b3" },
  { n: 42, cls: "b4 orange" },
  { n: 5, cls: "b5" },
  { n: 33, cls: "b6" },
  { n: 18, cls: "b7 orange" },
  { n: 27, cls: "b8" },
  { n: 9, cls: "b9" },
];

function LotoBackdrop({ parallax }: { parallax: { x: number; y: number } }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#009B77_0%,_#007A67_35%,_#006B5B_65%,_#003a31_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_45%,_rgba(0,0,0,0.55)_100%)]" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay">
        <filter id="cs-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.6  0 0 0 0 0.5  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cs-grain)" />
      </svg>
      <div
        className="cs-balls"
        style={{ transform: `translate3d(${parallax.x * 10}px, ${parallax.y * 10}px, 0)` }}
      >
        {LOTO_BALLS.map((b) => (
          <div key={b.cls} className={`cs-ball ${b.cls}`}>
            <span className="cs-ball-num">{b.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CS_CARD_CSS = `
.cs-auth-scope { background-color: #003a31; }

/* ============ BOULES DE LOTO NUMÉROTÉES ============ */
.cs-balls { position: absolute; inset: -10%; will-change: transform; transition: transform 300ms ease-out; }
.cs-ball {
  position: absolute;
  display: grid; place-items: center;
  border-radius: 9999px;
  background:
    radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%),
    radial-gradient(circle at 70% 78%, rgba(0,0,0,0.35), rgba(0,0,0,0) 55%),
    radial-gradient(circle at 50% 50%, #00C896 0%, #007A67 55%, #004a3f 100%);
  box-shadow:
    0 30px 60px -22px rgba(0,0,0,0.6),
    inset 0 -10px 24px rgba(0,0,0,0.30),
    inset 0 2px 4px rgba(255,255,255,0.15);
  animation: cs-float 20s ease-in-out infinite;
  will-change: transform;
  opacity: 0.9;
}
.cs-ball.orange {
  background:
    radial-gradient(circle at 32% 26%, rgba(255,255,255,0.55), rgba(255,255,255,0) 42%),
    radial-gradient(circle at 70% 78%, rgba(0,0,0,0.35), rgba(0,0,0,0) 55%),
    radial-gradient(circle at 50% 50%, #FFC68A 0%, #FF9E3F 55%, #7a3a00 100%);
  opacity: 0.55;
}
.cs-ball-num {
  font-family: var(--font-display);
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 1px rgba(255,255,255,0.6);
  letter-spacing: -0.02em;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.cs-ball.b1 { width: 320px; height: 320px; top: -80px; left: -80px; animation-duration: 24s; }
.cs-ball.b1 .cs-ball-num { font-size: 110px; }
.cs-ball.b2 { width: 180px; height: 180px; top: 10%; right: -60px; animation-duration: 26s; animation-delay: -4s; }
.cs-ball.b2 .cs-ball-num { font-size: 62px; }
.cs-ball.b3 { width: 110px; height: 110px; top: 52%; left: 6%; animation-duration: 20s; animation-delay: -8s; }
.cs-ball.b3 .cs-ball-num { font-size: 38px; }
.cs-ball.b4 { width: 220px; height: 220px; bottom: -80px; right: 10%; animation-duration: 28s; animation-delay: -2s; }
.cs-ball.b4 .cs-ball-num { font-size: 76px; }
.cs-ball.b5 { width: 80px; height: 80px; top: 22%; left: 48%; animation-duration: 16s; animation-delay: -6s; opacity: 0.75; }
.cs-ball.b5 .cs-ball-num { font-size: 28px; }
.cs-ball.b6 { width: 150px; height: 150px; bottom: 8%; left: -50px; animation-duration: 30s; }
.cs-ball.b6 .cs-ball-num { font-size: 52px; }
.cs-ball.b7 { width: 70px; height: 70px; top: 70%; right: 26%; animation-duration: 14s; animation-delay: -10s; opacity: 0.6; }
.cs-ball.b7 .cs-ball-num { font-size: 24px; }
.cs-ball.b8 { width: 100px; height: 100px; top: 6%; right: 32%; animation-duration: 24s; }
.cs-ball.b8 .cs-ball-num { font-size: 34px; }
.cs-ball.b9 { width: 90px; height: 90px; bottom: 35%; right: -30px; animation-duration: 22s; animation-delay: -12s; opacity: 0.7; }
.cs-ball.b9 .cs-ball-num { font-size: 32px; }

@keyframes cs-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  25%      { transform: translate3d(10px, -14px, 0) scale(1.03); }
  50%      { transform: translate3d(-8px, 12px, 0) scale(0.98); }
  75%      { transform: translate3d(-14px, -6px, 0) scale(1.02); }
}

/* ============ COQUE SMARTPHONE ============ */
.cs-phone { transition: transform 220ms ease-out; will-change: transform; }

/* Bouton latéral droit (power) */
.cs-phone-btn {
  position: absolute; right: -3px; top: 26%;
  width: 3px; height: 68px; border-radius: 2px;
  background: linear-gradient(180deg, #6b6f74, #2a2c30 50%, #6b6f74);
  box-shadow: inset 0 0 2px rgba(0,0,0,0.5), 1px 0 3px rgba(0,0,0,0.35);
  z-index: 1;
}
.cs-phone-btn-vol {
  position: absolute; left: -3px;
  width: 3px; border-radius: 2px;
  background: linear-gradient(180deg, #6b6f74, #2a2c30 50%, #6b6f74);
  box-shadow: inset 0 0 2px rgba(0,0,0,0.5), -1px 0 3px rgba(0,0,0,0.35);
  z-index: 1;
}
.cs-phone-btn-vol.vol1 { top: 20%; height: 32px; }
.cs-phone-btn-vol.vol2 { top: calc(20% + 44px); height: 56px; }

.cs-phone-shell {
  position: relative;
  border-radius: 48px;
  padding: 5px;
  background:
    linear-gradient(155deg, #c8ccd1 0%, #7c8085 22%, #3a3d42 50%, #7c8085 78%, #c8ccd1 100%);
  box-shadow:
    0 50px 90px -30px rgba(0, 0, 0, 0.75),
    0 18px 40px -14px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(255,255,255,0.18),
    inset 0 0 0 2px rgba(0,0,0,0.4);
}

.cs-phone-screen {
  position: relative;
  border-radius: 42px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(0, 200, 150, 0.22), transparent 60%),
    linear-gradient(180deg, rgba(0, 40, 34, 0.92), rgba(0, 18, 15, 0.96));
  overflow: hidden;
  min-height: 640px;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.06),
    inset 0 -30px 60px rgba(0,0,0,0.4);
}

/* Île dynamique iPhone */
.cs-notch {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: 118px; height: 32px; border-radius: 9999px;
  background: #000;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,0.04),
    0 2px 6px rgba(0,0,0,0.5);
  z-index: 5;
}
.cs-notch::after {
  content: ""; position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 10px; height: 10px; border-radius: 9999px;
  background:
    radial-gradient(circle at 30% 30%, #2a4a45 0%, #0a1a17 60%, #000 100%);
  box-shadow: 0 0 0 1px rgba(0,200,150,0.35), inset 0 0 2px rgba(255,255,255,0.15);
}

/* Reflet diagonal type verre */
.cs-glass-reflection {
  position: absolute; inset: 0;
  background: linear-gradient(
    115deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0) 25%,
    rgba(255,255,255,0.14) 38%,
    rgba(255,255,255,0.22) 44%,
    rgba(255,255,255,0.08) 52%,
    rgba(255,255,255,0) 65%
  );
  mix-blend-mode: screen;
  pointer-events: none;
  z-index: 3;
}

/* Barre indicateur iOS en bas */
.cs-home-indicator {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  width: 130px; height: 5px; border-radius: 9999px;
  background: rgba(255,255,255,0.55);
  z-index: 6;
}

/* Ombre portée sous le téléphone */
.cs-phone-reflection {
  position: absolute; left: 6%; right: 6%; bottom: -34px; height: 46px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.65), transparent 70%);
  filter: blur(10px); opacity: 0.75;
  pointer-events: none;
}

/* Zone de contenu à l'intérieur de l'écran */
.cs-phone-content {
  padding: 18px 22px 28px;
}

/* ============ CHAMPS / BOUTONS (utilisés par /auth) ============ */
.cs-field { display: block; }
.cs-field-label {
  display: block;
  font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  margin-bottom: 8px;
}
.cs-field-wrap {
  display: flex; align-items: center; gap: 10px;
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
}
.cs-field-wrap:focus-within {
  border-color: #00C896;
  background: rgba(0, 200, 150, 0.08);
  box-shadow: 0 0 0 4px rgba(0, 200, 150, 0.18);
}
.cs-otp {
  height: 56px; width: 100%;
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  border: 1.5px solid rgba(255,255,255,0.15);
  color: #fff;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  font-variant-numeric: tabular-nums;
  outline: none;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease, transform 100ms ease;
}
.cs-otp:focus {
  border-color: #00C896;
  background: rgba(0, 200, 150, 0.10);
  box-shadow: 0 0 0 4px rgba(0, 200, 150, 0.20);
}
.cs-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 14px 20px;
  border-radius: 9999px;
  color: #fff;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 14px;
  background: linear-gradient(180deg, #FFA23A 0%, #FF8A00 55%, #E67A00 100%);
  box-shadow:
    0 12px 28px -10px rgba(255, 138, 0, 0.55),
    0 4px 10px -3px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -2px 0 rgba(0,0,0,0.15);
  transition: transform 120ms ease, filter 150ms ease, box-shadow 200ms ease;
  will-change: transform;
}
.cs-cta:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.cs-cta:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
.cs-cta:disabled { opacity: 0.55; cursor: not-allowed; }
.cs-cta-locked {
  background: linear-gradient(180deg, #ef4444, #b91c1c);
  box-shadow: 0 10px 24px -10px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
}

@media (prefers-reduced-motion: reduce) {
  .cs-ball, .cs-balls, .cs-phone { animation: none !important; transition: none !important; transform: none !important; }
}
`;