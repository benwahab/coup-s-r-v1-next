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
    // Bloque au maximum 1,5s au tout premier chargement de la session.
    const t1 = setTimeout(() => setLeaving(true), 1100);
    const t2 = setTimeout(() => setShow(false), 1500);
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
      <div className="relative flex flex-col items-center gap-4 px-6 text-center animate-scale-in">
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-gold-gradient blur-2xl opacity-60 animate-pulse" />
          <img
            src={logoCoupSur}
            alt="Coup Sûr"
            className="relative h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          />
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