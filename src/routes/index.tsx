import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Smartphone, Zap, Flame, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { games, recentResults, jackpot, hotNumbers } from "@/lib/mock-data";
import { formatDate, formatFcfa } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoNaNi — Loterie Nationale du Niger en ligne" },
      { name: "description", content: "Jouez au PMU, Loto Balsa et Pari Foot depuis votre téléphone. Paiement mobile, reçu QR Code, notification de gain par SMS." },
      { property: "og:title", content: "LoNaNi — Loterie Nationale du Niger" },
      { property: "og:description", content: "PMU, Loto Balsa, Pari Foot. Jouez en 3 clics depuis Niamey ou partout au Niger." },
    ],
  }),
  component: Index,
});

const gameLinks = { pmu: "/pmu", loto: "/loto-balsa", foot: "/pari-foot" } as const;

function nextFriday21h() {
  const now = new Date();
  const target = new Date(now);
  const day = target.getDay(); // 0..6
  const delta = ((5 - day + 7) % 7) || 7;
  target.setDate(target.getDate() + delta);
  target.setHours(21, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
  return target;
}

function useCountdown(target: Date) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return null;
  const diff = Math.max(0, target.getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  return { d, h, m, s };
}

function Index() {
  const { t } = useI18n();
  const lastLoto = recentResults.find((r) => r.gameId === "loto");
  const cd = useCountdown(nextFriday21h());

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest backdrop-blur">
              🇳🇪 {t("tagline")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              <Radio className="h-3 w-3 animate-pulse" /> {t("liveNow")}
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl sm:text-6xl font-extrabold leading-[1.05]">
            Jouez. Gagnez. <span className="bg-gradient-to-r from-[oklch(0.82_0.20_150)] to-[oklch(0.86_0.16_88)] bg-clip-text text-transparent">Encaissez.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-white/75">
            PMU, Loto Balsa (1 à 5 boules sur 90) et Pari Foot. Paiement Airtel, Moov, Zamani, Nita. Reçu QR sécurisé, gain notifié par SMS.
          </p>

          {/* Jackpot card */}
          <div className="mt-6 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-white/5 to-white/0 p-5 shadow-gold backdrop-blur">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gold/90">{t("jackpot")} — Loto Balsa</span>
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">Vendredi 21h</span>
              </div>
              <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                {formatFcfa(jackpot)} <span className="text-lg font-semibold text-white/70">{t("fcfa")}</span>
              </div>
              <Link to="/loto-balsa" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110">
                {t("playNow")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/60">{t("nextDrawIn")}</div>
              {cd ? (
                <div className="mt-2 grid grid-cols-4 gap-2 tabular-nums">
                  {[
                    { v: cd.d, l: t("days") },
                    { v: cd.h, l: t("hours") },
                    { v: cd.m, l: t("minutes") },
                    { v: cd.s, l: t("seconds") },
                  ].map((b, i) => (
                    <div key={i} className="rounded-xl bg-white/5 px-2 py-2 text-center">
                      <div className="font-display text-2xl font-extrabold text-white">{String(b.v).padStart(2, "0")}</div>
                      <div className="text-[10px] uppercase tracking-widest text-white/60">{b.l}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 h-[68px] animate-pulse rounded-xl bg-white/5" />
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/60">
                <Flame className="h-3.5 w-3.5 text-gold" /> Numéros chauds :
                <span className="ml-1 font-bold text-gold tabular-nums">{hotNumbers.slice(0, 4).join(" · ")}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 max-w-xl">
            {[
              { icon: Zap, label: "3 clics" },
              { icon: Smartphone, label: "Mobile Money" },
              { icon: ShieldCheck, label: "QR sécurisé" },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur">
                <b.icon className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold text-white/85">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games */}
      <section id="jeux" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("chooseGame")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sélectionnez un jeu pour commencer à parier.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <Link
              key={g.id}
              to={gameLinks[g.id]}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card-gradient p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className={`absolute -right-8 -top-8 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br ${g.color} text-5xl shadow-elevated`}>
                <span className="-translate-y-1">{g.emoji}</span>
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("play")}</div>
              <div className="mt-1 font-display text-2xl font-bold">{g.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {g.id === "pmu" ? t("pmuDesc") : g.id === "loto" ? t("lotoDesc") : t("footDesc")}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{t("closes")} : {g.closes}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:translate-x-0.5 transition">
                  {t("playNow")} <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Last draw highlight */}
      {lastLoto?.numbers && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Loto Balsa</div>
                <div className="font-display text-xl font-bold">Derniers numéros gagnants</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDate(lastLoto.date)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {lastLoto.numbers.map((n) => (
                <span key={n} className="number-ball">{n}</span>
              ))}
            </div>
            <Link to="/resultats" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Voir tous les résultats <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <p className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">{t("secured")}</p>
    </div>
  );
}
