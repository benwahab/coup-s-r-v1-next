import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Info, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { isGameOpen, nigerDateIso } from "@/lib/schedule";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { pmuBets, findBet, type PmuBetId } from "@/lib/pmu-bets";
import type { TicketLeg } from "@/lib/tickets";
import { cn } from "@/lib/utils";

interface PmuHorse {
  number: number;
  name: string;
  intlName: string | null;
  jockey: string;
  status: "partant" | "non-partant";
  form: string | null;
  winRate: number | null;
  placeRate: number | null;
  weight: number | null;
}
import ogAsset from "@/assets/og-pmu.jpg.asset.json";
import { SITE_ORIGIN, absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

export const Route = createFileRoute("/pmu")({
  head: () => ({
    meta: [
      { title: "PMU — Pariez sur les chevaux | Coup Sûr" },
      {
        name: "description",
        content:
          "Pariez en ligne sur le PMU au Niger : choisissez votre tiercé et payez par mobile money.",
      },
      { property: "og:title", content: "PMU — Coup Sûr" },
      { property: "og:description", content: "Choisissez vos chevaux et jouez en quelques clics." },
      { property: "og:image", content: OG },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Coup Sûr PMU — chevaux au galop" },
      { property: "og:url", content: "/pmu" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/pmu` }],
  }),
  component: PmuPage,
});

const STAKE_CHIPS = [300, 500, 1000, 2000, 5000, 10_000];
const MIN_STAKE = 300;
const MAX_STAKE = 100_000;

function PmuPage() {
  const { t } = useI18n();
  const [betId, setBetId] = useState<PmuBetId>("tierce_d");
  const [picks, setPicks] = useState<number[]>([]);
  const [cart, setCart] = useState<TicketLeg[]>([]);
  const [unitStake, setUnitStake] = useState(MIN_STAKE);
  const [horses, setHorses] = useState<PmuHorse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [raceStartAt, setRaceStartAt] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{
    open_hour: number;
    close_hour: number;
    draw_hour: number;
    draw_minute: number;
    enabled: boolean;
  } | null>(null);
  useEffect(() => {
    void supabase
      .from("game_schedules")
      .select("open_hour,close_hour,draw_hour,draw_minute,enabled,day_schedules")
      .eq("game_id", "pmu")
      .maybeSingle()
      .then(({ data }) => {
        setSchedule(data ?? null);
      });
  }, []);

  const todaySchedule = schedule?.day_schedules?.length === 7 ? scheduleForNigerDay(schedule.day_schedules) : schedule;\n\n  const loadRace = async () => {
    setLoading(true);
    setLoadError(false);
    const today = nigerDateIso();
    const { data: races, error: raceError } = await supabase
      .from("pmu_races")
      .select("id,start_at")
      .eq("race_date", today)
      .in("status", ["scheduled", "open"])
      .order("start_at", { ascending: true })
      .limit(1);
    if (raceError || !races?.[0]) {
      setHorses([]);
      setRaceStartAt(null);
      setLoadError(Boolean(raceError));
      setLoading(false);
      return;
    }
    setRaceStartAt(races[0].start_at);
    const { data, error } = await supabase
      .from("pmu_horses")
      .select("number,name,intl_name,jockey,status,form,win_rate,place_rate,weight")
      .eq("race_id", races[0].id)
      .order("number");
    if (error) {
      setHorses([]);
      setLoadError(true);
    } else
      setHorses(
        (data ?? []).map((h) => ({
          number: h.number,
          name: h.name,
          intlName: h.intl_name,
          jockey: h.jockey,
          status: h.status === "non-partant" ? "non-partant" : "partant",
          form: h.form,
          winRate: h.win_rate,
          placeRate: h.place_rate,
          weight: h.weight,
        })),
      );
    setLoading(false);
  };
  useEffect(() => {
    void loadRace();
  }, []);
  const bet = findBet(betId);
  const partants = useMemo(() => horses.filter((h) => h.status === "partant"), [horses]);
  const nonPartants = useMemo(() => horses.filter((h) => h.status === "non-partant"), [horses]);

  const toggle = (n: number) => {
    const horse = horses.find((h) => h.number === n);
    if (!horse || horse.status === "non-partant") return;
    setPicks((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : prev.length < bet.maxPicks
          ? [...prev, n]
          : prev,
    );
  };
  const onBetChange = (id: PmuBetId) => {
    setBetId(id);
    const next = findBet(id);
    setPicks((p) => p.slice(0, next.maxPicks));
  };

  const combos = bet.combos(picks.length);
  const totalStake = combos * unitStake;
  const picksLabel = picks.length
    ? `[${bet.short}] ${picks.map((n, i) => `${bet.ordered ? `${i + 1}. ` : ""}${n}. ${horses.find((h) => h.number === n)?.name ?? ""}`).join(" • ")}`
    : `[${bet.short}] —`;
  const currentValid =
    picks.length >= bet.minPicks && picks.length <= bet.maxPicks && unitStake >= MIN_STAKE;
  const canContinue = currentValid || cart.length > 0;

  const drawDateIso = raceStartAt;

  const addCurrentToCart = () => {
    if (!currentValid) return;
    const leg: TicketLeg = {
      legId: `${Date.now()}-${cart.length}`,
      gameId: "pmu",
      gameName: "PMU",
      picks: [...picks],
      picksLabel,
      stake: totalStake,
      drawDate: drawDateIso ?? "",
      status: "pending",
    };
    setCart((p) => [...p, leg]);
    setPicks([]);
  };
  const removeFromCart = (id: string) => setCart((p) => p.filter((l) => l.legId !== id));

  const liveLeg: TicketLeg | null = currentValid
    ? {
        legId: `cur-${Date.now()}`,
        gameId: "pmu",
        gameName: "PMU",
        picks: [...picks],
        picksLabel,
        stake: totalStake,
        drawDate: drawDateIso ?? "",
        status: "pending",
      }
    : null;
  const effectiveLegs: TicketLeg[] = cart.length > 0 ? (liveLeg ? [...cart, liveLeg] : cart) : [];
  const cartTotal = effectiveLegs.reduce((s, l) => s + l.stake, 0);

  return (
    <>
      <PageHeader title="PMU" subtitle={t("selectHorses")} icon={<Trophy className="h-5 w-5" />} />
      {loadError && (
        <div className="mx-auto max-w-3xl px-4 py-4 text-sm text-destructive">
          Impossible de charger la course PMU.{" "}
          <button onClick={() => void loadRace()} className="font-bold underline">
            Réessayer
          </button>
        </div>
      )}
      {loading && (
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-muted-foreground">
          Chargement de la course PMU…
        </div>
      )}
      {!loading && !loadError && horses.length === 0 && (
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-sm text-muted-foreground">
          Aucune course PMU disponible actuellement.
        </div>
      )}
      {!loading && horses.length > 0 && (
        <BetFlow
          gameId="pmu"
          gameName="PMU"
          drawDate={drawDateIso ?? ""}
          legs={effectiveLegs.length ? effectiveLegs : undefined}
          selection={picks}
          picksLabel={picksLabel}
          canContinue={canContinue}
          lockedStake={effectiveLegs.length ? undefined : totalStake}
          defaultStake={unitStake}
          minStake={MIN_STAKE}
          gameOpen={Boolean(
            schedule?.enabled && schedule && (schedule.day_schedules?.length === 7 ? isWeeklyGameOpen(schedule.day_schedules) : isGameOpen(schedule.open_hour, schedule.close_hour)),
          )}
          openHour={todaySchedule?.open_hour ?? schedule?.open_hour ?? 0}
          renderSelection={
            <div>
              {/* Sélecteur type de pari */}
              <div className="mb-3">
                <h2 className="font-display text-xl font-bold">{t("game.whichBet")}</h2>
                <p className="text-xs text-muted-foreground">{t("game.chooseBetType")}</p>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
                {pmuBets.map((b) => {
                  const active = b.id === betId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => onBetChange(b.id)}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-bold whitespace-nowrap transition min-h-11",
                        active
                          ? "border-primary bg-primary/15 text-primary shadow-soft"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      <span className="text-base leading-none">{b.emoji}</span> {b.short}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{bet.name}</div>
                    <div className="text-xs text-muted-foreground">{bet.help}</div>
                    <div className="mt-1 text-[11px] tabular-nums">
                      {bet.minPicks === bet.maxPicks
                        ? `${bet.minPicks} ${bet.minPicks > 1 ? t("horses").toLowerCase() : t("game.horse")}`
                        : `${bet.minPicks}–${bet.maxPicks} ${t("horses").toLowerCase()}`}{" "}
                      · {t("game.base")} {bet.baseStake} {t("fcfa")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sélection chevaux */}
              <div className="mt-5 mb-2 flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{t("game.startingHorses")}</h2>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold tabular-nums">
                  {picks.length}/{bet.maxPicks}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {partants.map((h) => {
                  const active = picks.includes(h.number);
                  const order = picks.indexOf(h.number) + 1;
                  return (
                    <button
                      key={h.number}
                      type="button"
                      onClick={() => toggle(h.number)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border-2 px-3 py-3 text-left transition min-h-16",
                        active
                          ? "border-primary bg-primary/10 shadow-soft"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-lg font-bold",
                          active
                            ? "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {h.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-bold">
                          {h.name}{" "}
                          <span className="ml-1 text-[10px] font-normal italic text-muted-foreground">
                            / {h.intlName ?? "—"}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {h.jockey} · {h.weight ?? "—"}kg
                        </span>
                        <span className="block text-[10px] font-bold text-primary tabular-nums">
                          ★ V:{h.winRate == null ? "—" : `${Math.round(h.winRate * 100)}%`} · P:
                          {h.placeRate == null ? "—" : `${Math.round(h.placeRate * 100)}%`} ·{" "}
                          {h.form ?? "—"}
                        </span>
                      </span>
                      {active && (
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {bet.ordered ? order : "✓"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {nonPartants.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("game.nonStarters")}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {nonPartants.map((h) => (
                      <div
                        key={h.number}
                        className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-3 py-2.5 opacity-60"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted font-display text-base font-bold line-through">
                          {h.number}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold line-through">{h.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {h.jockey}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive">
                          NP
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Mise unitaire : chips + input libre 300–100 000 */}
              <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("game.unitStake")} ({t("fcfa")})
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    min {MIN_STAKE.toLocaleString()} · max {MAX_STAKE.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {STAKE_CHIPS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setUnitStake(v)}
                      className={cn(
                        "rounded-xl border-2 px-2 py-2 text-xs font-bold tabular-nums transition",
                        unitStake === v
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      {v.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={MIN_STAKE}
                  max={MAX_STAKE}
                  value={unitStake === 0 ? "" : unitStake}
                  onChange={(e) =>
                    setUnitStake(
                      e.target.value === ""
                        ? 0
                        : Math.max(0, Math.min(MAX_STAKE, Number(e.target.value) || 0)),
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 font-display font-bold tabular-nums focus:border-primary outline-none"
                />
                {unitStake > 0 && unitStake < MIN_STAKE && (
                  <p className="mt-1 text-[11px] text-destructive">{t("minStake")}</p>
                )}
              </div>

              {/* Récap dynamique */}
              <div className="mt-5 rounded-2xl border border-gold/30 bg-gold/5 p-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t("game.combinations")}
                    </div>
                    <div className="font-display text-xl font-extrabold tabular-nums">{combos}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t("totalStake")}
                    </div>
                    <div className="font-display text-xl font-extrabold tabular-nums text-gold">
                      {totalStake.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {t("potentialWin")}
                    </div>
                    <div className="font-display text-sm font-extrabold text-success">
                      Calculé au règlement
                    </div>
                  </div>
                </div>
              </div>

              {/* Panier multi-tirages PMU */}
              <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-gold">
                    {t("game.basket")} · {cart.length}{" "}
                    {cart.length > 1 ? t("game.draws") : t("game.draw")}
                  </div>
                  <button
                    type="button"
                    onClick={addCurrentToCart}
                    disabled={!currentValid}
                    className="inline-flex items-center gap-1 rounded-full bg-gold-gradient px-3 py-1.5 text-[11px] font-bold text-[var(--gold-foreground)] shadow-gold disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> {t("game.addThisBet")}
                  </button>
                </div>
                {cart.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {cart.map((l, i) => (
                      <li
                        key={l.legId}
                        className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-2.5 py-1.5 text-xs"
                      >
                        <span className="min-w-0 truncate">
                          <b className="text-primary mr-1">T{i + 1}</b>
                          {l.picksLabel}
                        </span>
                        <span className="shrink-0 tabular-nums font-bold">
                          {l.stake.toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeFromCart(l.legId)}
                          aria-label={t("game.removeThisGrid")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {cartTotal > 0 && (
                  <div className="mt-2 flex items-center justify-between border-t border-gold/20 pt-2 text-xs">
                    <span className="font-bold uppercase tracking-widest text-muted-foreground">
                      {t("totalStake")}
                    </span>
                    <span className="font-display text-base font-extrabold tabular-nums text-gold">
                      {cartTotal.toLocaleString()} {t("fcfa")}
                    </span>
                  </div>
                )}
              </div>

              {!canContinue && picks.length < bet.minPicks && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("needMin")} <b>{bet.minPicks}</b>{" "}
                  {bet.minPicks > 1 ? t("horses").toLowerCase() : t("game.horse")}.
                </p>
              )}
            </div>
          }
        />
      )}
    </>
  );
}
