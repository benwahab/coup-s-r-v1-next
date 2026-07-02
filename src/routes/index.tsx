import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, ShieldCheck, Smartphone, Zap, Clock, UserPlus, Gamepad2,
  Wallet, Sparkles, LockKeyhole, HeartHandshake, LogIn, ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coup Sûr — Jouez en confiance, gagnez simplement" },
      { name: "description", content: "Loto, PMU et paris sportifs 100% mobile. Paiements Mobile Money instantanés, reçus sécurisés, gains encaissés en un clic." },
      { property: "og:title", content: "Coup Sûr — Jouez en confiance" },
      { property: "og:description", content: "Créez votre compte en 30 secondes. Loto, PMU, paris — paiement Mobile Money sécurisé." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/* --------------------------- Parallax hook --------------------------- */
function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    const onScroll = () => setY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return y;
}

/* --------------------------- Balls layer --------------------------- */
type Ball = { top: string; left: string; size: number; n: number; mint?: boolean; delay: string; slow?: boolean };
const BALLS: Ball[] = [
  { top: "8%",  left: "6%",  size: 56, n: 7,  delay: "0s" },
  { top: "18%", left: "82%", size: 44, n: 21, mint: true, delay: "-2s", slow: true },
  { top: "48%", left: "2%",  size: 40, n: 33, mint: true, delay: "-4s" },
  { top: "62%", left: "90%", size: 62, n: 9,  delay: "-1s", slow: true },
  { top: "78%", left: "14%", size: 36, n: 45, delay: "-3s" },
  { top: "34%", left: "70%", size: 30, n: 12, mint: true, delay: "-5s" },
];

function FloatingBalls() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40 sm:opacity-55" aria-hidden>
      {BALLS.map((b, i) => (
        <div
          key={i}
          className={`cs-ball ${b.mint ? "cs-ball--mint" : ""} ${b.slow ? "cs-anim-float-slow" : "cs-anim-float"}`}
          style={{
            top: b.top, left: b.left,
            width: b.size, height: b.size,
            fontSize: b.size * 0.36,
            animationDelay: b.delay,
          }}
        >
          {b.n}
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Phone mockup --------------------------- */
function PhoneMockup({ tiltY }: { tiltY: number }) {
  const style = {
    transform: `perspective(1200px) rotateY(${-14 + tiltY * 0.02}deg) rotateX(${6 - tiltY * 0.01}deg)`,
  };
  return (
    <div className="relative mx-auto w-[240px] sm:w-[280px] cs-phone-float" style={style}>
      {/* Glow behind phone */}
      <div className="absolute -inset-10 -z-10 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.35),transparent_65%)] blur-2xl" aria-hidden />

      {/* Frame */}
      <div className="relative rounded-[38px] p-2 shadow-cs-deep"
        style={{ background: "linear-gradient(160deg,#0F4A3D 0%,#052A22 100%)" }}>
        <div className="rounded-[32px] overflow-hidden border border-white/10 bg-[#04140F]">
          {/* Notch */}
          <div className="relative h-6 bg-black/60">
            <div className="absolute left-1/2 top-1.5 h-3 w-24 -translate-x-1/2 rounded-full bg-black" />
          </div>
          {/* Screen */}
          <div className="p-4 bg-gradient-to-b from-[#062A22] to-[#04170F] text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-cs-mint/70">Bonjour</div>
                <div className="font-display text-sm font-bold">Coup Sûr</div>
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-full bg-cs-orange shadow-cs-orange text-[10px] font-black text-[#2A1400]">CS</div>
            </div>

            {/* Balance card */}
            <div className="relative mt-3 overflow-hidden rounded-2xl p-3 shadow-cs-inset"
              style={{ background: "linear-gradient(135deg,#0B5C4A 0%,#083E33 100%)" }}>
              <div className="cs-shine absolute inset-0" />
              <div className="text-[9px] uppercase tracking-widest text-cs-mint/70">Solde</div>
              <div className="mt-0.5 font-display text-xl font-black tabular-nums">42 500 <span className="text-[10px] font-semibold text-cs-mint/70">FCFA</span></div>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold">Recharger</span>
                <span className="rounded-full bg-cs-orange px-2 py-0.5 text-[9px] font-bold text-[#2A1400]">Retirer</span>
              </div>
            </div>

            {/* Games grid */}
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { l: "Loto", e: "🎱" },
                { l: "PMU", e: "🏇" },
                { l: "Foot", e: "⚽" },
              ].map((g) => (
                <div key={g.l} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                  <div className="text-lg">{g.e}</div>
                  <div className="mt-0.5 text-[9px] font-bold">{g.l}</div>
                </div>
              ))}
            </div>

            {/* Ticket line */}
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-cs-mint/70">Ticket #A21</span>
                <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">GAGNÉ</span>
              </div>
              <div className="mt-1 flex gap-1">
                {[7, 12, 21, 33, 45].map((n) => (
                  <span key={n} className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-black"
                    style={{ background: "linear-gradient(135deg,#FFB347,#FF8A00)", color: "#2A1400" }}>{n}</span>
                ))}
              </div>
            </div>
          </div>
          {/* Home bar */}
          <div className="flex justify-center py-1.5 bg-black/60">
            <div className="h-1 w-16 rounded-full bg-white/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Sections --------------------------- */
const STEPS = [
  { icon: UserPlus, title: "Créer un compte", desc: "30 secondes avec votre numéro de téléphone. Aucune paperasse." },
  { icon: Gamepad2, title: "Choisir son jeu", desc: "Loto, PMU, paris foot — sélectionnez, misez, validez en 3 clics." },
  { icon: Wallet, title: "Encaisser ses gains", desc: "Retrait Mobile Money instantané. Notification SMS automatique." },
];

const PERKS = [
  { icon: LockKeyhole, title: "Sécurité maximale", desc: "Reçus signés QR Code. Aucune fraude possible." },
  { icon: Zap, title: "Paiements rapides", desc: "Airtel, Moov, Zamani, Nita, Amanata — encaissement immédiat." },
  { icon: Sparkles, title: "Simplicité", desc: "Interface pensée mobile-first, lisible et sans jargon." },
  { icon: Clock, title: "Disponible 24h/24", desc: "Jouez et retirez à toute heure, où que vous soyez." },
];

/* --------------------------- 2.5D Icon shell --------------------------- */
function IconTile({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative grid h-14 w-14 place-items-center rounded-2xl shadow-cs-inset"
      style={{ background: "linear-gradient(160deg,#0F5A4A 0%,#083E33 100%)" }}>
      <div className="absolute inset-0 rounded-2xl opacity-40"
        style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 55%)" }} />
      <Icon className="relative h-7 w-7 text-cs-mint" />
    </div>
  );
}

function IconTileOrange({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-cs-orange shadow-cs-orange">
      <div className="absolute inset-0 rounded-2xl opacity-50"
        style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 55%)" }} />
      <Icon className="relative h-7 w-7 text-[#2A1400]" />
    </div>
  );
}

function Index() {
  const scrollY = useScrollY();
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-cs-deep text-white">
      {/* ================= HERO ================= */}
      <section ref={heroRef} className="relative overflow-hidden bg-cs-hero">
        <FloatingBalls />
        <div className="absolute inset-0 grid-bg opacity-[0.06]" aria-hidden />

        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:pt-16 sm:pb-20 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-6">
          {/* Left — copy + CTA */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5 text-cs-mint" />
              Plateforme agréée · Paiement Mobile Money
            </span>

            <h1 className="mt-5 font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl lg:text-6xl">
              Jouez en confiance.
              <br />
              <span className="bg-gradient-to-r from-[#FFB347] to-[#FF8A00] bg-clip-text text-transparent">
                Gagnez en toute simplicité.
              </span>
            </h1>

            <p className="mt-4 max-w-xl text-base text-cs-mint/85 sm:text-lg">
              Loto, PMU et paris sportifs sur votre téléphone. Reçus sécurisés,
              gains encaissés en un clic, service disponible 24h/24.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group relative inline-flex items-center gap-2 rounded-full bg-cs-orange px-7 py-3.5 text-base font-bold text-[#2A1400] shadow-cs-orange transition hover:brightness-105 active:scale-[0.98]"
              >
                <UserPlus className="h-5 w-5" />
                Créer un compte
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur hover:bg-white/10"
              >
                <LogIn className="h-4 w-4" />
                Se connecter
              </Link>
            </div>

            {/* trust chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { i: LockKeyhole, l: "Chiffré" },
                { i: Smartphone, l: "100% mobile" },
                { i: Zap, l: "Retrait instantané" },
              ].map((c) => (
                <span key={c.l} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-cs-mint/90">
                  <c.i className="h-3.5 w-3.5 text-cs-mint" />
                  {c.l}
                </span>
              ))}
            </div>
          </div>

          {/* Right — phone */}
          <div className="relative flex items-center justify-center py-6 lg:py-0">
            <PhoneMockup tiltY={scrollY} />
          </div>
        </div>

        {/* scroll cue */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center opacity-60">
          <ChevronDown className="h-5 w-5 animate-bounce text-cs-mint" />
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-cs-orange">Comment ça marche</div>
          <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Trois étapes, zéro friction.</h2>
          <p className="mt-2 text-sm text-cs-mint/70">De l'inscription au premier gain — tout se fait depuis votre téléphone.</p>
        </div>

        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-cs-panel p-6 shadow-cs-deep transition hover:-translate-y-1 hover:border-white/20"
            >
              {/* subtle glow */}
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-30 blur-2xl transition group-hover:opacity-50"
                style={{ background: "radial-gradient(circle, rgba(16,185,129,0.6), transparent 70%)" }} />

              <div className="flex items-center gap-3">
                <IconTile Icon={s.icon} />
                <div className="font-display text-xs font-bold uppercase tracking-widest text-cs-mint/60">Étape {i + 1}</div>
              </div>
              <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cs-mint/75">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= PERKS ================= */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40"
          style={{ background: "radial-gradient(800px 400px at 50% 0%, rgba(16,185,129,0.15), transparent 60%)" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-cs-orange">Pourquoi Coup Sûr</div>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              La sérénité d'abord.
            </h2>
            <p className="mt-2 text-sm text-cs-mint/70">
              Une plateforme conçue pour être sûre, rapide et honnête — que vous jouiez 500 ou 500 000 FCFA.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p) => (
              <div
                key={p.title}
                className="group rounded-2xl border border-white/10 bg-cs-panel p-5 shadow-cs-deep transition hover:-translate-y-1 hover:border-white/20"
              >
                <IconTile Icon={p.icon} />
                <h3 className="mt-4 font-display text-base font-bold">{p.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-cs-mint/75">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Operators strip */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.2em] text-cs-mint/70">
              <span className="text-cs-mint/50">Paiements acceptés</span>
              <span>Airtel Money</span>
              <span>·</span>
              <span>Moov Flooz</span>
              <span>·</span>
              <span>Zamani Cash</span>
              <span>·</span>
              <span>Nita</span>
              <span>·</span>
              <span>Amanata</span>
              <span>·</span>
              <span>MyNita</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0"
          style={{
            background:
              "radial-gradient(600px 300px at 50% 0%, rgba(255,138,0,0.18), transparent 65%), linear-gradient(180deg,#072922 0%,#051F1A 100%)",
          }} aria-hidden />
        <div className="relative mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <HeartHandshake className="h-3.5 w-3.5 text-cs-orange" />
            Prêt à tenter votre chance ?
          </div>
          <h2 className="mt-4 font-display text-3xl font-extrabold sm:text-5xl">
            Votre prochain <span className="text-cs-orange">Coup Sûr</span> commence maintenant.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-cs-mint/80 sm:text-base">
            Inscription en 30 secondes avec votre numéro. Aucun frais caché.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-cs-orange px-8 py-4 text-base font-bold text-[#2A1400] shadow-cs-orange transition hover:brightness-105 active:scale-[0.98]"
            >
              <UserPlus className="h-5 w-5" />
              Créer un compte
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              J'ai déjà un compte
            </Link>
          </div>
          <p className="mt-6 text-[11px] uppercase tracking-widest text-cs-mint/50">
            Jeu réservé aux personnes majeures · Jouez responsable
          </p>
        </div>
      </section>
    </div>
  );
}
