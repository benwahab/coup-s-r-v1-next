import { useEffect, useState } from "react";

const COLORS = ["#00C896", "#FFB347", "#FF8A00", "#ffffff", "#0B3B30"];

interface Piece {
  id: number;
  left: number; // vw
  delay: number; // s
  duration: number; // s
  color: string;
  size: number; // px
  rotateStart: number;
  drift: number; // vw of horizontal drift
  shape: "rect" | "circle";
}

/**
 * Petite pluie de confettis, sans dépendance externe, déclenchée une fois au
 * montage puis retirée du DOM. Respecte prefers-reduced-motion.
 */
export function WinConfetti() {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const arr: Piece[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.6 + Math.random() * 1.4,
      color: COLORS[i % COLORS.length],
      size: 6 + Math.random() * 7,
      rotateStart: Math.random() * 360,
      drift: (Math.random() - 0.5) * 16,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    setPieces(arr);
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, []);

  if (!pieces || !show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="cs-confetti-piece absolute top-0"
          style={{
            left: `${p.left}vw`,
            width: p.size,
            height: p.shape === "rect" ? p.size * 0.45 : p.size,
            background: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotateStart}deg)`,
            // @ts-expect-error custom property for the keyframe drift
            "--cs-drift": `${p.drift}vw`,
          }}
        />
      ))}
      <style>{CONFETTI_CSS}</style>
    </div>
  );
}

const CONFETTI_CSS = `
@keyframes cs-confetti-fall {
  0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--cs-drift), 110vh, 0) rotate(540deg); opacity: 0.9; }
}
.cs-confetti-piece {
  animation-name: cs-confetti-fall;
  animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  animation-fill-mode: both;
}
`;
