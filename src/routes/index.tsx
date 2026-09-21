import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Smartphone, Zap, Radio, Clock, CalendarDays, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

import { supabase } from "@/integrations/supabase/client";
import { formatFcfa, formatHour } from "@/lib/utils";
import { nextDailyEvent, diffParts, drawNameForDate, nigerDateLabel } from "@/lib/schedule";
import heroJpg from "@/assets/hero-winners.jpg";
// Variantes optimisées (vite-imagetools) — WebP couvre ~97 % du parc, AVIF ~90 %.
// image-set() ci-dessous laisse le navigateur choisir le format le plus léger,
// le JPG restant en fallback.
import heroWebp from "@/assets/hero-winners.jpg?format=webp&w=1600&quality=72&url";
import heroAvif from "@/assets/hero-winners.jpg?format=avif&w=1600&quality=55&url";
import ogImage from "@/assets/og-coup-sur.png.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG_IMAGE_URL = absoluteOgUrl(ogImage.url);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coup Sûr — Jouez en ligne au Niger" },
      { name: "description", content: "Jouez au PMU, Loto Balsa et Pari Foot depuis votre téléphone. Paiement mobile, reçu QR Code, notification de gain par SMS." },
      { property: "og:title", content: "Coup Sûr — Jouez en ligne au Niger" },
      { property: "og:description", content: "PMU, Loto Balsa, Pari Foot. Jouez en 3 clics depuis Niamey ou partout au Niger." },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1254" },
      { property: "og:image:height", content: "1254" },
      { property: "og:image:alt", content: "Coup Sûr — Loterie Nationale du Niger" },
      { property: "og:url", content: SITE_ORIGIN },
      { name: "twitter:image", content: OG_IMAGE_URL },
      { name: "twitter:image:alt", content: "Coup Sûr — Loterie Nationale du Niger" },
    ],
    links: [
      { rel: "canonical", href: SITE_ORIGIN },
      // Précharge le hero (LCP de la home) au format WebP — variante réellement utilisée par la majorité des navigateurs.
      { rel: "preload", as: "image", href: heroWebp, type: "image/webp", fetchpriority: "high" },
    ],
  }),
  component: Index,
});

const gameLinks = { pmu: "/pmu", loto: "/loto-balsa", foot: "/pari-foot" } as const;

function useCountdown(target: Date) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Client-only : rien tant que l'horloge n'est pas montée côté navigateur,
  // et rien non plus pour une cible invalide (évite tout flash SSR/hydration).
  if (now === null) return null;
  if (!target || Number.isNaN(target.getTime()) || target.getTime() <= 0) return null;
  return diffParts(target, new Date(now));
}

/**
 * Recompute the "stage" (openAt / closesIn / drawIn) client-side to avoid
 * SSR hydration mismatch: the server may render one stage and the client
 * another because minutes pass between renders.
 */
function useLiveStage(openHour: number, closeHour: number, drawHour: number, drawMinute = 0) {
  const [stage, setStage] = useState<ReturnType<typeof nextDailyEvent> | null>(null);
  useEffect(() => {
    const compute = () => setStage(nextDailyEvent(openHour, closeHour, drawHour, new Date(), drawMinute));
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [openHour, closeHour, drawHour, drawMinute]);
  return stage;
}

function Index() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<Partial<Record<"pmu" | "loto", { open_hour:number; close_hour:number; draw_hour:number; draw_minute:number; enabled:boolean }>>>({});
  useEffect(() => { void supabase.from("game_schedules").select("game_id,open_hour,close_hour,draw_hour,draw_minute,enabled").in("game_id", ["pmu","loto"]).then(({ data }) => { const next: typeof schedules = {}; for (const row of data ?? []) if (row.game_id === "pmu" || row.game_id === "loto") next[row.game_id] = row; setSchedules(next); }); }, []);
  const pmuSchedule = schedules.pmu;
  const lotoSchedule = schedules.loto;
  const pmuEvt = pmuSchedule ? useLiveStage(pmuSchedule.open_hour, pmuSchedule.close_hour, pmuSchedule.draw_hour, pmuSchedule.draw_minute) : null;
  const [lastPmu, setLastPmu] = useState<{ date: string; horses: number[] } | null>(null);
  const [lastLoto, setLastLoto] = useState<{ date: string; numbers: number[] } | null>(null);
  useEffect(() => {
    const loadResults = async () => {
      const [{ data: pmuRows }, { data: lotoRows }] = await Promise.all([
        supabase.from("draw_results").select("draw_date,result").eq("game_id","pmu").eq("status","published").order("draw_date",{ascending:false}).limit(1),
        supabase.from("draw_results").select("draw_date,result").eq("game_id","loto").eq("status","published").order("draw_date",{ascending:false}).limit(1),
      ]);
      const pmu = pmuRows?.[0];
      const loto = lotoRows?.[0];
      const pr = pmu?.result as Record<string, unknown> | null | undefined;
      const lr = loto?.result as Record<string, unknown> | null | undefined;
      setLastPmu(pmu && Array.isArray(pr?.horses) ? { date: pmu.draw_date, horses: pr.horses.filter((n): n is number => typeof n === "number") } : null);
      setLastLoto(loto && Array.isArray(lr?.numbers) ? { date: loto.draw_date, numbers: lr.numbers.filter((n): n is number => typeof n === "number") } : null);
    };
    void loadResults();
  }, []);
  const lotoEvt = lotoSchedule ? useLiveStage(lotoSchedule.open_hour, lotoSchedule.close_hour, lotoSchedule.draw_hour, lotoSchedule.draw_minute) : null;
  const pmuCd = useCountdown(pmuEvt?.target ?? new Date(0));
  const lotoCd = useCountdown(lotoEvt?.target ?? new Date(0));
  const lotoDrawName = drawNameForDate();

  const todayWinnersCount: number | null = null;
  const todayPaid: number | null = null;
  const todayLabel = nigerDateLabel();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 sm:opacity-40"
          style={{
            // image-set() : le navigateur choisit AVIF > WebP > JPG selon le support.
            backgroundImage: `image-set(url(${heroAvif}) type("image/avif"), url(${heroWebp}) type("image/webp"), url(${heroJpg}) type("image/jpeg"))`,
            backgroundPosition: "right center",
          }}
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
            PMU et Loto Balsa suivent leur cycle quotidien ; le Pari Foot dépend des fixtures réelles disponibles.
            Le paiement actuellement connecté est Airtel Money. Reçu QR sécurisé.
          </p>

          {/* Jackpot principal — PMU */}
          <div className="mt-6 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/15 via-white/[0.03] to-transparent p-5 shadow-gold backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gold/90">{t("jackpot")} — {t("dailyQuinte")}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  <CalendarDays className="h-3 w-3" /> {todayLabel}
                </span>
              </div>
              <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                — <span className="text-lg font-semibold text-white/70">{t("fcfa")}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                {[
                  { l: t("closeAt"), v: pmuSchedule ? formatHour(pmuSchedule.close_hour) : "—" },
                  { l: t("drawAt"), v: pmuSchedule ? formatHour(pmuSchedule.draw_hour, pmuSchedule.draw_minute) : "—" },
                  { l: t("openAt"), v: pmuSchedule ? formatHour(pmuSchedule.open_hour) : "—" },
                ].map((b, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-white/55">{b.l}</div>
                    <div className="font-display text-sm font-bold tabular-nums text-white">{b.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 min-h-4">
                  {pmuEvt
                    ? pmuEvt.stage === "openAt"
                      ? `${t("openAt")} ${pmuSchedule ? formatHour(pmuSchedule.open_hour) : "—"}`
                      : t(pmuEvt.stage)
                    : "\u00A0"}
                </div>
                {pmuEvt && pmuCd ? (
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

            {/* Loto Balsa — secondary card (quotidien, sans jackpot affiché) */}
            <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-white/[0.03] to-transparent p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Loto Balsa</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Clock className="h-3 w-3" /> {t("today")} {todayLabel}
                </span>
              </div>

              {/* Nom du tirage du jour */}
              <div className="mt-1 font-display text-lg font-extrabold text-gold leading-tight">{lotoDrawName}</div>

              {/* Bloc gagnants du jour à la place du jackpot */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    <Users className="h-3 w-3" /> {t("todayWinners")}
                  </div>
                  <div className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-primary">{todayWinnersCount ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    <Trophy className="h-3 w-3" /> {t("totalPaidToday")}
                  </div>
                  <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-gold">{todayPaid === null ? "—" : formatFcfa(todayPaid)} <span className="text-[10px] font-semibold text-white/70">{t("fcfa")}</span></div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                {[
                  { l: t("closeAt"), v: lotoSchedule ? formatHour(lotoSchedule.close_hour) : "—" },
                  { l: t("drawAt"), v: lotoSchedule ? formatHour(lotoSchedule.draw_hour, lotoSchedule.draw_minute) : "—" },
                  { l: t("openAt"), v: lotoSchedule ? formatHour(lotoSchedule.open_hour) : "—" },
                ].map((b, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center">
                    <div className="text-[9px] uppercase tracking-widest text-white/55">{b.l}</div>
                    <div className="font-display text-xs font-bold tabular-nums text-white">{b.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[10px] font-bold uppercase tracking-widest text-white/60 min-h-4">
                {lotoEvt
                  ? lotoEvt.stage === "openAt"
                    ? `${t("openAt")} ${lotoSchedule ? formatHour(lotoSchedule.open_hour) : "—"}`
                    : t(lotoEvt.stage)
                  : "\u00A0"}
              </div>
              {lotoEvt && lotoCd ? (
                <div className="mt-1 grid grid-cols-4 gap-1.5 tabular-nums">
                  {[
                    { v: lotoCd.d, l: t("days") },
                    { v: lotoCd.h, l: t("hours") },
                    { v: lotoCd.m, l: t("minutes") },
                    { v: lotoCd.s, l: t("seconds") },
                  ].map((b, i) => (
                    <div key={i} className="rounded-lg bg-white/5 px-1 py-1.5 text-center">
                      <div className="font-display text-base font-extrabold text-white">{String(b.v).padStart(2, "0")}</div>
                      <div className="text-[9px] uppercase tracking-widest text-white/60">{b.l}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1.5 h-[44px] animate-pulse rounded-lg bg-white/5" />
              )}
              <div className="mt-2 text-[11px] text-white/60">Les statistiques et tendances seront affichées après réception de résultats réels.</div>
              <Link to="/loto-balsa" className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110">
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
          {[
  { id: "pmu" as const, name: "PMU", emoji: "🐎", color: "from-gold/80 to-gold/30" },
  { id: "loto" as const, name: "Loto Balsa", emoji: "🎱", color: "from-primary/80 to-primary/30" },
  { id: "foot" as const, name: "Pari Foot", emoji: "⚽", color: "from-teal-500/80 to-teal-500/30" },
].map((g) => (
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
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{t("closes")} : {g.id === "pmu" ? (pmuSchedule ? formatHour(pmuSchedule.close_hour) : "—") : g.id === "loto" ? (lotoSchedule ? formatHour(lotoSchedule.close_hour) : "—") : "—"}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:translate-x-0.5 transition">
                  {t("playNow")} <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <Link to="/resultats" className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40">
          Voir les derniers résultats publiés <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">{t("secured")}</p>
    </div>
  );
}
