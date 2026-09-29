import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Zap,
  Radio,
  Clock,
  CalendarDays,
  Trophy,
  Users,
  Goal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

import { supabase } from "@/integrations/supabase/client";
import { formatFcfa, formatHour } from "@/lib/utils";
import { nextDailyEvent, diffParts, drawNameForDate, nigerDateLabel } from "@/lib/schedule";
import heroBackground from "@/assets/coup-sur-home-background.webp";
import ogImage from "@/assets/og-coup-sur.png.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG_IMAGE_URL = absoluteOgUrl(ogImage.url);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coup Sûr — Jouez en ligne au Niger" },
      {
        name: "description",
        content:
          "Jouez au PMU, Loto Balsa et Pari Foot depuis votre téléphone. Paiement mobile, reçu QR Code, notification de gain par SMS.",
      },
      { property: "og:title", content: "Coup Sûr — Jouez en ligne au Niger" },
      {
        property: "og:description",
        content: "PMU, Loto Balsa, Pari Foot. Jouez en 3 clics depuis Niamey ou partout au Niger.",
      },
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
      { rel: "preload", as: "image", href: heroBackground, type: "image/webp", fetchPriority: "high" },
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
    const compute = () =>
      setStage(nextDailyEvent(openHour, closeHour, drawHour, new Date(), drawMinute));
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [openHour, closeHour, drawHour, drawMinute]);
  return stage;
}

function Index() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<
    Partial<
      Record<
        "pmu" | "loto",
        {
          open_hour: number;
          close_hour: number;
          draw_hour: number;
          draw_minute: number;
          enabled: boolean;
        }
      >
    >
  >({});
  useEffect(() => {
    void supabase
      .from("game_schedules")
      .select("game_id,open_hour,close_hour,draw_hour,draw_minute,enabled")
      .in("game_id", ["pmu", "loto"])
      .then(({ data }) => {
        const next: typeof schedules = {};
        for (const row of data ?? [])
          if (row.game_id === "pmu" || row.game_id === "loto") next[row.game_id] = row;
        setSchedules(next);
      });
  }, []);
  const pmuSchedule = schedules.pmu;
  const lotoSchedule = schedules.loto;
  const pmuEvtRaw = useLiveStage(
    pmuSchedule?.open_hour ?? 0,
    pmuSchedule?.close_hour ?? 0,
    pmuSchedule?.draw_hour ?? 0,
    pmuSchedule?.draw_minute ?? 0,
  );
  const pmuEvt = pmuSchedule ? pmuEvtRaw : null;
  const [lastPmu, setLastPmu] = useState<{ date: string; horses: number[] } | null>(null);
  const [lastLoto, setLastLoto] = useState<{ date: string; numbers: number[] } | null>(null);
  const [footHighlights, setFootHighlights] = useState<
    Array<{
      id: string;
      league: string;
      kickoffAt: string;
      home: string;
      away: string;
      odds: { home: number; draw: number; away: number };
    }>
  >([]);
  useEffect(() => {
    const loadResults = async () => {
      const [{ data: pmuRows }, { data: lotoRows }] = await Promise.all([
        supabase
          .from("draw_results")
          .select("draw_date,result")
          .eq("game_id", "pmu")
          .eq("status", "published")
          .order("draw_date", { ascending: false })
          .limit(1),
        supabase
          .from("draw_results")
          .select("draw_date,result")
          .eq("game_id", "loto")
          .eq("status", "published")
          .order("draw_date", { ascending: false })
          .limit(1),
      ]);
      const pmu = pmuRows?.[0];
      const loto = lotoRows?.[0];
      const pr = pmu?.result as Record<string, unknown> | null | undefined;
      const lr = loto?.result as Record<string, unknown> | null | undefined;
      setLastPmu(
        pmu && Array.isArray(pr?.horses)
          ? {
              date: pmu.draw_date,
              horses: pr.horses.filter((n): n is number => typeof n === "number"),
            }
          : null,
      );
      setLastLoto(
        loto && Array.isArray(lr?.numbers)
          ? {
              date: loto.draw_date,
              numbers: lr.numbers.filter((n): n is number => typeof n === "number"),
            }
          : null,
      );
    };
    void loadResults();
  }, []);
  useEffect(() => {
    const loadFootHighlights = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("foot_fixtures")
        .select("id,league_name,kickoff_at,home_team,away_team,odds_home,odds_draw,odds_away")
        .eq("status", "scheduled")
        .gte("kickoff_at", now)
        .order("kickoff_at", { ascending: true })
        .limit(100);

      const rows = (data ?? [])
        .filter(
          (m) =>
            m.odds_home != null &&
            m.odds_draw != null &&
            m.odds_away != null &&
            Number(m.odds_home) > 0 &&
            Number(m.odds_draw) > 0 &&
            Number(m.odds_away) > 0,
        )
        .map((m) => ({
          id: m.id,
          league: m.league_name,
          kickoffAt: m.kickoff_at,
          home: m.home_team,
          away: m.away_team,
          odds: {
            home: Number(m.odds_home),
            draw: Number(m.odds_draw),
            away: Number(m.odds_away),
          },
        }));

      const majorCompetition = (league: string) =>
        /champions|ligue des champions|premier league|la liga|laliga|serie a|bundesliga|ligue 1|europa|conference league|coupe du monde|world cup|can|afcon/i.test(
          league,
        );

      const score = (m: (typeof rows)[number]) => {
        const maxOdd = Math.max(m.odds.home, m.odds.draw, m.odds.away);
        return (majorCompetition(m.league) ? 100 : 0) + maxOdd + (m.league ? 1 : 0);
      };

      const selected = [...rows]
        .sort((a, b) => score(b) - score(a))
        .slice(0, 3);

      setFootHighlights(selected);
    };

    void loadFootHighlights();
  }, []);

  const lotoEvtRaw = useLiveStage(
    lotoSchedule?.open_hour ?? 0,
    lotoSchedule?.close_hour ?? 0,
    lotoSchedule?.draw_hour ?? 0,
    lotoSchedule?.draw_minute ?? 0,
  );
  const lotoEvt = lotoSchedule ? lotoEvtRaw : null;
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
            backgroundImage: `url(${heroBackground})`,
            backgroundPosition: "center center",
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
            Jouez. Gagnez.{" "}
            <span className="bg-gradient-to-r from-[oklch(0.82_0.20_150)] to-[oklch(0.86_0.16_88)] bg-clip-text text-transparent">
              Encaissez.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-white/75">
            PMU et Loto Balsa suivent leur cycle quotidien ; le Pari Foot dépend des fixtures
            réelles disponibles. Le paiement actuellement connecté est Airtel Money. Reçu QR
            sécurisé.
          </p>

          {/* Jackpot principal — PMU */}
          <div className="mt-6 grid gap-3 lg:grid-cols-3 items-stretch">
            <div className="rounded-3xl border border-teal-400/30 bg-gradient-to-br from-teal-400/10 via-white/[0.03] to-transparent p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-300">
                  {t("jackpot")} — {t("dailyQuinte")}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                  <CalendarDays className="h-3 w-3" /> {todayLabel}
                </span>
              </div>
              <div className="mt-2 font-display text-4xl sm:text-5xl font-extrabold tabular-nums text-white">
                — <span className="text-lg font-semibold text-white/70">{t("fcfa")}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                {[
                  { l: t("closeAt"), v: pmuSchedule ? formatHour(pmuSchedule.close_hour) : "—" },
                  {
                    l: t("drawAt"),
                    v: pmuSchedule
                      ? formatHour(pmuSchedule.draw_hour, pmuSchedule.draw_minute)
                      : "—",
                  },
                  { l: t("openAt"), v: pmuSchedule ? formatHour(pmuSchedule.open_hour) : "—" },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-center"
                  >
                    <div className="text-[9px] uppercase tracking-widest text-white/55">{b.l}</div>
                    <div className="font-display text-sm font-bold tabular-nums text-white">
                      {b.v}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
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
                        <div className="font-display text-xl font-extrabold text-white">
                          {String(b.v).padStart(2, "0")}
                        </div>
                        <div className="text-[9px] uppercase tracking-widest text-white/60">
                          {b.l}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1.5 h-[52px] animate-pulse rounded-lg bg-white/5" />
                )}
              </div>

              <Link
                to="/pmu"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110"
              >
                {t("playNow")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Loto Balsa — secondary card (quotidien, sans jackpot affiché) */}
            <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-white/[0.03] to-transparent p-5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Loto Balsa
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  <Clock className="h-3 w-3" /> {t("today")} {todayLabel}
                </span>
              </div>

              {/* Nom du tirage du jour */}
              <div className="mt-1 font-display text-lg font-extrabold text-teal-200 leading-tight">
                {lotoDrawName}
              </div>

              {/* Bloc gagnants du jour à la place du jackpot */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    <Users className="h-3 w-3" /> {t("todayWinners")}
                  </div>
                  <div className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-primary">
                    {todayWinnersCount ?? "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                    <Trophy className="h-3 w-3" /> {t("totalPaidToday")}
                  </div>
                  <div className="mt-0.5 font-display text-xl font-extrabold tabular-nums text-teal-200">
                    {todayPaid === null ? "—" : formatFcfa(todayPaid)}{" "}
                    <span className="text-[10px] font-semibold text-white/70">{t("fcfa")}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                {[
                  { l: t("closeAt"), v: lotoSchedule ? formatHour(lotoSchedule.close_hour) : "—" },
                  {
                    l: t("drawAt"),
                    v: lotoSchedule
                      ? formatHour(lotoSchedule.draw_hour, lotoSchedule.draw_minute)
                      : "—",
                  },
                  { l: t("openAt"), v: lotoSchedule ? formatHour(lotoSchedule.open_hour) : "—" },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-center"
                  >
                    <div className="text-[9px] uppercase tracking-widest text-white/55">{b.l}</div>
                    <div className="font-display text-xs font-bold tabular-nums text-white">
                      {b.v}
                    </div>
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
                      <div className="font-display text-base font-extrabold text-white">
                        {String(b.v).padStart(2, "0")}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-white/60">
                        {b.l}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1.5 h-[44px] animate-pulse rounded-lg bg-white/5" />
              )}
              <div className="mt-2 text-[11px] text-white/60">
                Les statistiques et tendances seront affichées après réception de résultats réels.
              </div>
              <Link
                to="/loto-balsa"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110"
              >
                {t("playNow")} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          {/* Pari Foot — affiches importantes, classiques et meilleures cotes */}
          <div className="rounded-3xl border border-teal-400/30 bg-gradient-to-br from-teal-400/10 via-white/[0.03] to-transparent p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-teal-300">
                <Goal className="h-3.5 w-3.5" /> Pari Foot
              </span>
              <span className="rounded-full bg-teal-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                À venir
              </span>
            </div>

            <div className="mt-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                Grandes affiches
              </div>
              {footHighlights.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {footHighlights.map((m) => {
                    const maxOdd = Math.max(m.odds.home, m.odds.draw, m.odds.away);
                    return (
                      <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-[9px] text-white/55">
                          <span className="truncate">{m.league}</span>
                          <span className="shrink-0">
                            {new Date(m.kickoffAt).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                            })}{" "}
                            ·{" "}
                            {new Date(m.kickoffAt).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] font-bold">
                          <span className="min-w-0 truncate">{m.home}</span>
                          <span className="text-white/40">–</span>
                          <span className="min-w-0 truncate text-right">{m.away}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[9px]">
                          <span className="text-white/50">Meilleure cote</span>
                          <span className="font-bold tabular-nums text-teal-200">×{maxOdd.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-center text-[10px] text-white/55">
                  Les prochaines affiches apparaîtront dès que les matchs réels seront disponibles.
                </div>
              )}
            </div>

            <Link
              to="/pari-foot"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-2.5 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110"
            >
              Voir les matchs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 max-w-xl">
            {[
              { icon: Zap, label: "3 clics" },
              { icon: Smartphone, label: "Mobile Money" },
              { icon: ShieldCheck, label: "QR sécurisé" },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur"
              >
                <b.icon className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold text-white/85">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <Link
          to="/resultats"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-bold text-primary hover:border-primary/40"
        >
          Voir les derniers résultats publiés <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <p className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">
        {t("secured")}
      </p>
    </div>
  );
}
