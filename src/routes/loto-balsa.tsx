import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles, Shuffle, Eraser, Clock, Plus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BetFlow } from "@/components/BetFlow";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa, formatHour } from "@/lib/utils";
import { lotoMultipliers, drawSchedule } from "@/lib/mock-data";
import { drawNameForDate, nigerDateLabel, isGameOpen } from "@/lib/schedule";
import type { TicketLeg } from "@/lib/tickets";
import ogAsset from "@/assets/og-loto.jpg.asset.json";
import { absoluteOgUrl } from "@/lib/og";

const OG = absoluteOgUrl(ogAsset.url);

export const Route = createFileRoute("/loto-balsa")({
  head: () => ({
    meta: [
      { title: "Loto Balsa — Coup Sûr" },
      { name: "description", content: "Choisissez vos numéros du Loto Balsa et jouez en ligne avec paiement mobile." },
      { property: "og:title", content: "Loto Balsa — Coup Sûr" },
      { property: "og:description", content: "Sélectionnez 1 à 5 boules sur 90 et tentez votre chance." },
      { property: "og:image", content: OG },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Coup Sûr Loto Balsa — boules numérotées" },
      { property: "og:url", content: "/loto-balsa" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG },
    ],
    links: [{ rel: "canonical", href: "/loto-balsa" }],
  }),
  component: LotoPage,
});

const RANGE = 90;
const MODES = [1, 2, 3, 4, 5] as const;
type Mode = (typeof MODES)[number];
const DEFAULT_STAKE = 500;
const MIN_STAKE = 300;
const MAX_STAKE = 100_000;
const STAKE_CHIPS = [300, 500, 1000, 2000, 5000, 10_000];

function LotoPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(2);
  const [picks, setPicks] = useState<number[]>([]);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  const [cart, setCart] = useState<TicketLeg[]>([]);

  const drawName = drawNameForDate();
  const dateLabel = nigerDateLabel();
  const drawDateIso = useMemo(() => {
    const d = new Date();
    d.setHours(drawSchedule.loto.drawHour, 0, 0, 0);
    return d.toISOString();
  }, []);

  const changeMode = (m: Mode) => { setMode(m); setPicks((prev) => prev.slice(0, m)); };

  const toggle = (n: number) =>
    setPicks((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : prev.length < mode ? [...prev, n] : prev,
    );

  const quickPick = () => {
    const pool = Array.from({ length: RANGE }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicks(pool.slice(0, mode));
  };

  const sorted = [...picks].sort((a, b) => a - b);
  const picksLabel = sorted.length ? sorted.join(" · ") : "—";

  const multiplier = lotoMultipliers[mode];
  const potentialWin = stake * multiplier;

  const currentLeg = (): TicketLeg | null => {
    if (picks.length !== mode || stake < MIN_STAKE || stake > MAX_STAKE) return null;
    return {
      legId: `cur-${Date.now()}`,
      gameId: "loto",
      gameName: "Loto Balsa",
      picks: sorted,
      picksLabel: `${drawName} · ${mode} ${mode === 1 ? t("game.ball") : t("balls")} : ${picksLabel}`,
      stake,
      drawName,
      drawDate: drawDateIso,
      status: "pending",
    };
  };

  const addGridToCart = () => {
    const leg = currentLeg();
    if (!leg) return;
    setCart((prev) => [...prev, { ...leg, legId: `${Date.now()}-${prev.length}` }]);
    setPicks([]);
  };

  const removeFromCart = (legId: string) =>
    setCart((prev) => prev.filter((l) => l.legId !== legId));

  // Si panier non vide ET grille courante prête, on l'ajoute automatiquement avant paiement
  const liveLeg = currentLeg();
  const effectiveLegs: TicketLeg[] =
    cart.length > 0
      ? (liveLeg ? [...cart, liveLeg] : cart)
      : [];

  const cartTotal = effectiveLegs.reduce((s, l) => s + l.stake, 0);

  return (
    <>
      <PageHeader title="Loto Balsa" subtitle={t("selectNumbers")} icon={<Sparkles className="h-5 w-5" />} />

      <div className="mx-auto max-w-3xl px-4">
        <div className="rounded-2xl border border-gold/30 bg-card-gradient p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" /> {t("today")} {dateLabel}
            </div>
            <div className="font-display text-base font-extrabold text-gold leading-tight">{drawName}</div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {[
              { l: t("openAt"), v: formatHour(drawSchedule.loto.openHour) },
              { l: t("closeAt"), v: formatHour(drawSchedule.loto.closeHour) },
              { l: t("drawAt"), v: formatHour(drawSchedule.loto.drawHour, drawSchedule.loto.drawMinute) },
            ].map((b, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/40 px-3 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{b.l}</div>
                <div className="font-display text-sm font-bold tabular-nums text-foreground">{b.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BetFlow
        gameId="loto"
        gameName="Loto Balsa"
        drawDate={drawDateIso}
        drawName={drawName}
        minStake={MIN_STAKE}
        maxStake={MAX_STAKE}
        legs={effectiveLegs.length ? effectiveLegs : undefined}
        selection={sorted}
        picksLabel={`${drawName} · ${mode} ${mode === 1 ? t("game.ball") : t("balls")} : ${picksLabel}`}
        canContinue={effectiveLegs.length > 0 || picks.length === mode}
        defaultStake={stake}
        skipStake
        gameOpen={isGameOpen(drawSchedule.loto.openHour, drawSchedule.loto.closeHour)}
        openHour={drawSchedule.loto.openHour}
        renderSelection={
          <div>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("pickMode")}</span>
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                  x{multiplier.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {MODES.map((m) => (
                  <button key={m} type="button" onClick={() => changeMode(m)} className={cn(
                    "rounded-xl border-2 py-2.5 text-center transition",
                    mode === m
                      ? "border-primary bg-primary/15 text-primary shadow-green"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40",
                  )}>
                    <div className="font-display text-lg font-bold leading-none">{m}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider">x{lotoMultipliers[m].toLocaleString()}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">{t("selectNumbers")}</h2>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={quickPick} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
                  <Shuffle className="h-3 w-3" /> {t("quickPick")}
                </button>
                <button type="button" onClick={() => setPicks([])} disabled={!picks.length} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-40">
                  <Eraser className="h-3 w-3" /> {t("clear")}
                </button>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground tabular-nums">
                  {picks.length}/{mode}
                </span>
              </div>
            </div>

            <div className="mb-4 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-secondary/40 p-3">
              {Array.from({ length: mode }).map((_, i) =>
                sorted[i] != null ? (
                  <span key={i} className="number-ball">{sorted[i]}</span>
                ) : (
                  <span key={i} className="number-ball-empty">?</span>
                ),
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
              {Array.from({ length: RANGE }, (_, i) => i + 1).map((n) => {
                const active = picks.includes(n);
                const disabled = !active && picks.length >= mode;
                return (
                  <button key={n} type="button" onClick={() => toggle(n)} disabled={disabled} className={cn(
                    "aspect-square rounded-full font-display text-sm font-bold tabular-nums transition",
                    active
                      ? "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold scale-105"
                      : "border border-border bg-card/60 text-foreground hover:border-primary hover:text-primary",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}>
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Mise unique : chips + input libre 300–100 000 */}
            <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("stake")} ({t("fcfa")})</span>
                <span className="text-[10px] text-muted-foreground">min 300 · max 100 000</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {STAKE_CHIPS.map((v) => (
                  <button key={v} type="button" onClick={() => setStake(v)} className={cn(
                    "rounded-xl border-2 px-2 py-2 text-xs font-bold tabular-nums transition",
                    stake === v ? "border-primary bg-primary/15 text-primary" : "border-border bg-card hover:border-primary/40",
                  )}>{v.toLocaleString()}</button>
                ))}
              </div>
              <input
                type="number" min={MIN_STAKE} max={MAX_STAKE} value={stake === 0 ? "" : stake}
                onChange={(e) => setStake(e.target.value === "" ? 0 : Math.max(0, Math.min(MAX_STAKE, Number(e.target.value) || 0)))}
                className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 font-display font-bold tabular-nums focus:border-primary outline-none"
              />
              {stake > 0 && stake < MIN_STAKE && <p className="mt-1 text-[11px] text-destructive">{t("minStake")}</p>}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-background/40 px-3 py-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("potentialWin")}</div>
                  <div className="font-display text-xl font-extrabold tabular-nums text-primary">
                    {formatFcfa(potentialWin)} <span className="text-xs font-semibold text-muted-foreground">{t("fcfa")}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("multiplier")}</div>
                  <div className="font-display text-base font-bold text-gold">x{multiplier.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Multi-grilles : panier */}
            <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-widest text-gold">
                  {t("game.basket")} · {cart.length} {cart.length > 1 ? t("grids") : t("grid").toLowerCase()}
                </div>
                <button type="button" onClick={addGridToCart} disabled={!liveLeg}
                  className="inline-flex items-center gap-1 rounded-full bg-gold-gradient px-3 py-1.5 text-[11px] font-bold text-[var(--gold-foreground)] shadow-gold disabled:opacity-40">
                  <Plus className="h-3 w-3" /> {t("addGrid")}
                </button>
              </div>
              {cart.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {cart.map((l, i) => (
                    <li key={l.legId} className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-2.5 py-1.5 text-xs">
                      <span className="min-w-0 truncate"><b className="text-primary mr-1">G{i + 1}</b>{l.picksLabel}</span>
                      <span className="shrink-0 tabular-nums font-bold">{l.stake.toLocaleString()}</span>
                      <button onClick={() => removeFromCart(l.legId)} aria-label={t("game.removeThisGrid")} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {cartTotal > 0 && (
                <div className="mt-2 flex items-center justify-between border-t border-gold/20 pt-2 text-xs">
                  <span className="font-bold uppercase tracking-widest text-muted-foreground">{t("totalStake")}</span>
                  <span className="font-display text-base font-extrabold tabular-nums text-gold">{cartTotal.toLocaleString()} {t("fcfa")}</span>
                </div>
              )}
            </div>

            {picks.length < mode && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("needMin")} {mode} {mode === 1 ? t("game.ball") : t("balls")} — {picks.length} {t("selected")}.
              </p>
            )}
          </div>
        }
      />
    </>
  );
}
