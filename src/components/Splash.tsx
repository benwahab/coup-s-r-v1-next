import { useEffect, useState } from "react";

export function Splash() {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 4500);
    const t2 = setTimeout(() => setShow(false), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-[100] grid place-items-center bg-hero overflow-hidden",
        "transition-opacity duration-500",
        leaving ? "opacity-0" : "opacity-100",
      ].join(" ")}
      aria-hidden
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
      <div className="relative flex flex-col items-center gap-4 px-6 text-center animate-scale-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gold-gradient blur-2xl opacity-60 animate-pulse" />
          <div className="relative grid h-28 w-28 sm:h-36 sm:w-36 place-items-center rounded-3xl bg-gold-gradient text-[var(--gold-foreground)] font-display text-6xl sm:text-7xl font-extrabold shadow-gold">
            L
          </div>
        </div>
        <div className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight animate-fade-in">
          LoNaNi
        </div>
        <div className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-white/70 animate-fade-in">
          🇳🇪 Loterie Nationale du Niger
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
    </div>
  );
}