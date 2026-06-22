import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Smartphone, Zap, Flame, Radio, Clock, CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { games, recentResults, pmuJackpot, lotoJackpot, hotNumbers, drawSchedule } from "@/lib/mock-data";
import { formatDate, formatFcfa } from "@/lib/utils";
import heroBg from "@/assets/hero-winners.jpg";

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

/** Prochain événement PMU : si avant 14h aujourd'hui → clôture 14h ; entre 14-15h → tirage 15h ; sinon demain 14h. */
function nextPmuEvent(now = new Date()) {
  const today14 = new Date(now); today14.setHours(drawSchedule.pmu.closeHour, 0, 0, 0);
  const today15 = new Date(now); today15.setHours(drawSchedule.pmu.drawHour, 0, 0, 0);
  if (now < today14) return { label: "closesIn" as const, target: today14 };
  if (now < today15) return { label: "drawIn" as const, target: today15 };
  const tomorrow14 = new Date(today14); tomorrow14.setDate(tomorrow14.getDate() + 1);
  return { label: "closesIn" as const, target: tomorrow14 };
}

/** Prochain événement Loto Balsa : vendredi 20h (clôture) puis 21h (tirage). */
function nextLotoEvent(now = new Date()) {
  const day = now.getDay();
  const friday20 = new Date(now);
  const delta = (5 - day + 7) % 7;
  friday20.setDate(friday20.getDate() + delta);
  friday20.setHours(drawSchedule.loto.closeHour, 0, 0, 0);
  const friday21 = new Date(friday20); friday21.setHours(drawSchedule.loto.drawHour, 0, 0, 0);
  if (now < friday20) return { label: "closesIn" as const, target: friday20 };
  if (now < friday21) return { label: "drawIn" as const, target: friday21 };
  const next = new Date(friday20); next.setDate(next.getDate() + 7);
  return { label: "closesIn" as const, target: next };
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
  const lastPmu = recentResults.find((r) => r.gameId === "pmu");
  const pmuEvt = nextPmuEvent();
  const lotoEvt = nextLotoEvent();
  const pmuCd = useCountdown(pmuEvt.target);
  const lotoCd = useCountdown(lotoEvt.target);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 sm:opacity-40"
          style={{ backgroundImage: `url(${heroBg})`, backgroundPosition: "right center" }}
          aria-hidden
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, oklch(0.16 0.025 225 / 0.96) 0%, oklch(0.16 0.025 225 / 0.85) 45%, oklch(0.16 0.025 225 / 0.45) 100%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 grid-bg opacity-30" aria-hidden />
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
            PMU quotidien à 15h, Loto Balsa du vendredi (1 à 5 boules sur 90) et Pari Foot.
            Paiement Airtel, Moov, Zamani, Nita, Amanata, MyNita. Reçu QR sécurisé, SMS gagnant automatique.
          </p>

          {/* Jackpot principal — PMU */}
          <div className="mt-6 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/15 via-white/[0.03] to-transparent p-5 shadow-gold backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gold/90">{t("jackpot")} — {t("dailyQuinte")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  <Clock className="h-3 w-3" /> {drawSchedule.pmu.label}
                </span>
              </div>
              <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                {formatFcfa(pmuJackpot)} <span className="text-lg font-semibold text-white/70">{t("fcfa")}</span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">{t(pmuEvt.label)}</div>
                {pmuCd ? (
                  <div className="mt-1.5 grid grid-cols-4 gap-1.5 tabular-nums">
                    {[
                      { v: pmuCd.d, l: t("days") },
                      { v: pmuCd.h, l: t("hours") },
                      { v: pmuCd.m, l: t("minutes") },
                      { v: pmuCd.s, l: t("seconds") },
                    ].map((b, i) => (
                      <div key={i} className="rounded-lg bg-white/5 px-1 py-1.5 text-center">
                        <div className="font-display text-xl font-extrabold text-white">{String(b.v).padStart(2, "0")}</div>
                        <div className="text-[9px] uppercase tracking-widest text-white/60">{b.l}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1.5 h-[52px] animate-pulse rounded-lg bg-white/5" />
                )}
              </div>

              <Link to="/pmu" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110">
                {t("playNow")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Loto Balsa — secondary card */}
            <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-white/[0.03] to-transparent p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Loto Balsa</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <CalendarDays className="h-3 w-3" /> {drawSchedule.loto.label}
                </span>
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold tabular-nums text-white">
                {formatFcfa(lotoJackpot)} <span className="text-sm font-semibold text-white/70">{t("fcfa")}</span>
              </div>
              <div className="mt-3 text-[11px] uppercase tracking-widest text-white/60">{t(lotoEvt.label)}</div>
              {lotoCd ? (
                <div className="mt-1.5 grid grid-cols-4 gap-1.5 tabular-nums">
                  {[
                    { v: lotoCd.d, l: t("days") },
                    { v: lotoCd.h, l: t("hours") },
                    { v: lotoCd.m, l: t("minutes") },
                    { v: lotoCd.s, l: t("seconds") },
                  ].map((b, i) => (
                    <div key={i} className="rounded-lg bg-white/5 px-1 py-1.5 text-center">
                      <div className="font-display text-lg font-extrabold text-white">{String(b.v).padStart(2, "0")}</div>
                      <div className="text-[9px] uppercase tracking-widest text-white/60">{b.l}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1.5 h-[44px] animate-pulse rounded-lg bg-white/5" />
              )}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/60">
                <Flame className="h-3.5 w-3.5 text-gold" /> {t("hotNumbers")} :
                <span className="ml-1 font-bold text-gold tabular-nums">{hotNumbers.slice(0, 4).join(" · ")}</span>
              </div>
              <Link to="/loto-balsa" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                {t("playNow")} <ArrowRight className="h-4 w-4" />
              </Link>
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
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-10 sm:grid-cols-2">
        {lastPmu?.horses && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">PMU — {t("pmuDaily")}</div>
                <div className="font-display text-xl font-bold">{t("latestWinning")}</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDate(lastPmu.date)}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {lastPmu.horses.map((h, i) => (
                <span key={h} className="inline-flex items-center gap-1.5">
                  <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
                  <span className="number-ball number-ball-sm">{h}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {lastLoto?.numbers && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Loto Balsa — {t("lotoWeekly")}</div>
                <div className="font-display text-xl font-bold">{t("latestWinning")}</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{formatDate(lastLoto.date)}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {lastLoto.numbers.map((n) => (
                <span key={n} className="number-ball">{n}</span>
              ))}
            </div>
          </div>
        )}
        <Link to="/resultats" className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
          Voir tous les résultats <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">{t("secured")}</p>
    </div>
  );
}
