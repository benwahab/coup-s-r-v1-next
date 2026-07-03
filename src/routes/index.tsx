import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coup Sûr — Loterie Nationale du Niger" },
      { name: "description", content: "Coup Sûr — PMU, Loto Balsa, Pari Foot au Niger. Paiement mobile, reçu QR Code, notification de gain par SMS." },
      { property: "og:title", content: "Coup Sûr — Loterie Nationale du Niger" },
      { property: "og:description", content: "PMU, Loto Balsa, Pari Foot. Jouez en 3 clics depuis Niamey ou partout au Niger." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="cs-landing-scope relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-8">
      <div className="cs-landing-bg absolute inset-0" aria-hidden />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="cs-landing-orb o1" />
        <span className="cs-landing-orb o2" />
      </div>

      <div className="relative z-10 w-full max-w-[280px]">
        <div className="cs-card-float relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          {!imgLoaded && (
            <div className="absolute inset-0 cs-shimmer" aria-hidden />
          )}
          <img
            src="/og-image.png"
            alt="Coup Sûr"
            loading="eager"
            decoding="async"
            draggable={false}
            onLoad={() => setImgLoaded(true)}
            className={[
              "absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-700",
              imgLoaded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        </div>
      </div>

      <style>{LANDING_CSS}</style>
    </div>
  );
}

const LANDING_CSS = `
.cs-landing-scope { background-color: #003a31; }

.cs-landing-bg {
  background:
    radial-gradient(1200px 800px at 50% -10%, rgba(0, 200, 150, 0.14), transparent 60%),
    radial-gradient(900px 600px at 50% 110%, rgba(255, 138, 0, 0.06), transparent 60%),
    linear-gradient(180deg, #003a31 0%, #002821 50%, #001612 100%);
}

.cs-landing-orb {
  position: absolute; border-radius: 9999px; filter: blur(60px);
  opacity: 0.35; will-change: transform;
  animation: cs-landing-float 22s ease-in-out infinite;
}
.cs-landing-orb.o1 {
  width: 360px; height: 360px; top: -100px; left: -80px;
  background: radial-gradient(circle at 40% 40%, #00C896, #007A67 55%, transparent 75%);
}
.cs-landing-orb.o2 {
  width: 280px; height: 280px; bottom: -80px; right: -60px;
  background: radial-gradient(circle at 50% 50%, #FF8A00, #7a3a00 55%, transparent 75%);
  opacity: 0.18; animation-delay: -10s;
}

@keyframes cs-landing-float {
  0%, 100% { transform: translate3d(0,0,0) scale(1); }
  50%      { transform: translate3d(20px,-24px,0) scale(1.05); }
}

.cs-card-float {
  will-change: transform;
  box-shadow:
    0 30px 60px -20px rgba(0,0,0,0.55),
    0 12px 28px -10px rgba(0,0,0,0.40),
    inset 0 1px 0 rgba(255,255,255,0.08);
  animation: cs-card-float 16s ease-in-out infinite;
}
@keyframes cs-card-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50%      { transform: translate3d(0, -8px, 0) scale(1.015); }
}

.cs-shimmer {
  background: linear-gradient(
    110deg,
    rgba(255,255,255,0) 0%,
    rgba(255,255,255,0.04) 45%,
    rgba(255,255,255,0.10) 50%,
    rgba(255,255,255,0.04) 55%,
    rgba(255,255,255,0) 100%
  );
  background-size: 200% 100%;
  animation: cs-shimmer-anim 1.6s ease-in-out infinite;
}

@keyframes cs-shimmer-anim {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .cs-landing-orb, .cs-card-float, .cs-shimmer {
    animation: none !important;
    transition: none !important;
  }
}
`;
