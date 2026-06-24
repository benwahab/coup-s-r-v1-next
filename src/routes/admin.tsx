import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, TrendingUp, Users, Wallet, Trophy, Send, FileText, Download, MessageCircle, Check, BellRing, Sparkles, MapPin, Circle, BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTickets } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa, formatDate } from "@/lib/utils";
import { computeBallStats, computePlayerStats, computeRegionStats, generateSimTickets } from "@/lib/mock-stats";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — LoNaNi" }] }),
  component: AdminPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  losing: "bg-muted text-muted-foreground",
  winning: "bg-success/15 text-success",
  paid: "bg-success text-success-foreground",
};

type Tab = "overview" | "players" | "regions" | "balls" | "ops";

function AdminPage() {
  const { t } = useI18n();
  const { tickets, updateStatus, updateLegStatus } = useTickets();
  const sims = useMemo(() => generateSimTickets(260), []);
  const [tab, setTab] = useState<Tab>("overview");
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [csvFrom, setCsvFrom] = useState(weekAgoIso);
  const [csvTo, setCsvTo] = useState(todayIso);
  const [csvScope, setCsvScope] = useState<"all" | "winners" | "cashout">("all");

  const [autoSms, setAutoSms] = useState(true);
  const [sentLog, setSentLog] = useState<{ id: string; phone: string; prize: number; at: number }[]>([]);
  const [cashoutRequests, setCashoutRequests] = useState<string[]>([]);

  // Auto-SMS: whenever a ticket flips to "winning" and we haven't notified yet, log a "sent" entry
  // and create a cash-out request on behalf of the winner.
  useEffect(() => {
    if (!autoSms) return;
    const winners = tickets.filter((t) => t.status === "winning");
    const known = new Set(sentLog.map((s) => s.id));
    const fresh = winners.filter((w) => !known.has(w.id));
    if (fresh.length === 0) return;
    setSentLog((prev) => [
      ...fresh.map((w) => ({ id: w.id, phone: w.phone, prize: w.prize ?? 0, at: Date.now() })),
      ...prev,
    ]);
    setCashoutRequests((prev) => Array.from(new Set([...fresh.map((w) => w.id), ...prev])));
  }, [tickets, autoSms, sentLog]);

  // KPIs combinés (simulés + tickets réels)
  const totalStaked = sims.reduce((s, t) => s + t.stake, 0) + tickets.reduce((s, t) => s + t.stake, 0);
  const totalPayout = sims.filter(s => s.status === "paid").reduce((s, t) => s + t.prize, 0) + tickets.filter((t) => t.status === "paid").reduce((s, t) => s + (t.prize ?? 0), 0);
  const winnersCount = sims.filter((s) => s.status === "paid" || s.status === "winning").length + tickets.filter((t) => t.status === "winning" || t.status === "paid").length;
  const activePlayers = new Set(sims.map((s) => s.player)).size;

  const bars = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const fromSims = sims.filter((s) => s.iso === iso).reduce((s, t) => s + t.stake, 0);
      const fromTickets = tickets.filter((t) => t.createdAt.slice(0, 10) === iso).reduce((s, t) => s + t.stake, 0);
      days.push({ label: ["D", "L", "M", "M", "J", "V", "S"][d.getDay()], value: fromSims + fromTickets });
    }
    return days;
  }, [sims, tickets]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  const playerStats = useMemo(() => computePlayerStats(sims), [sims]);
  const regionStats = useMemo(() => computeRegionStats(sims), [sims]);
  const ballStats = useMemo(() => computeBallStats(sims), [sims]);
  const maxBall = Math.max(1, ...ballStats.map((b) => b.total));
  const maxRegion = Math.max(1, ...regionStats.map((r) => r.staked));

  const [searchPlayer, setSearchPlayer] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const filteredPlayers = playerStats.filter(
    (p) => (filterRegion === "all" || p.region === filterRegion) && p.player.toLowerCase().includes(searchPlayer.toLowerCase()),
  ).slice(0, 30);

  const [selectedBall, setSelectedBall] = useState<number | null>(null);
  const selBallStat = selectedBall ? ballStats.find((b) => b.ball === selectedBall) : null;

  const exportCsv = (scope: "all" | "winners" | "cashout" = csvScope) => {
    const from = csvFrom; const to = csvTo;
    const inRange = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
    const live = tickets.filter((t) => inRange(t.createdAt));
    const simRows = sims.filter((s) => s.iso >= from && s.iso <= to);
    const filtered: { id: string; date: string; game: string; phone: string; region: string; picks: string; stake: number; status: string; payment: string; prize: number }[] = [
      ...live.map((t) => ({ id: t.id, date: t.createdAt.slice(0, 10), game: t.gameName, phone: t.phone, region: t.region ?? "", picks: t.picksLabel, stake: t.stake, status: t.status, payment: t.payment, prize: t.prize ?? 0 })),
      ...simRows.map((s) => ({ id: `SIM-${s.iso}-${s.player.slice(0, 3)}-${Math.round(s.stake)}`, date: s.iso, game: s.game, phone: s.phone, region: s.region, picks: s.picksLabel, stake: s.stake, status: s.status, payment: s.payment, prize: s.prize })),
    ];
    const rows = filtered.filter((r) =>
      scope === "all" ? true :
      scope === "winners" ? (r.status === "winning" || r.status === "paid") :
      r.status === "paid",
    );
    const header = ["id", "date", "jeu", "telephone", "region", "selections", "mise_fcfa", "statut", "paiement", "gain_fcfa"];
    const csvBody = rows.map((r) => [r.id, r.date, r.game, r.phone, r.region, `"${r.picks.replace(/"/g, "''")}"`, r.stake, r.status, r.payment, r.prize].join(","));
    const csv = [header.join(","), ...csvBody].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lonani-${scope}-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cycle = (id: string, current: string) => {
    const next =
      current === "pending" ? "winning" :
      current === "winning" ? "paid" :
      current === "paid" ? "losing" : "pending";
    const prize = next === "winning" ? Math.round((tickets.find(t => t.id === id)?.stake ?? 0) * 12) : undefined;
    updateStatus(id, next as "pending" | "winning" | "paid" | "losing", prize);
  };

  const cycleLeg = (ticketId: string, legId: string, current: string, stake: number) => {
    const next =
      current === "pending" ? "winning" :
      current === "winning" ? "paid" :
      current === "paid" ? "losing" : "pending";
    const prize = next === "winning" ? Math.round(stake * 12) : undefined;
    updateLegStatus(ticketId, legId, next as "pending" | "winning" | "paid" | "losing", prize);
  };

  const approveCashout = (id: string) => {
    updateStatus(id, "paid", tickets.find((t) => t.id === id)?.prize);
    setCashoutRequests((prev) => prev.filter((x) => x !== id));
  };

  const tabs: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
    { id: "overview", label: t("overview"), icon: BarChart3 },
    { id: "players", label: t("players"), icon: Users },
    { id: "regions", label: t("regions"), icon: MapPin },
    { id: "balls", label: t("ballsStats"), icon: Circle },
    { id: "ops", label: "SMS & Encaissements", icon: Send },
  ];

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle="Espace administrateur" icon={<ShieldCheck className="h-5 w-5" />} />

      <div className="mx-auto max-w-6xl px-4 py-4">
        {/* KPIs toujours visibles */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={TrendingUp} label={t("totalRevenue")} value={`${formatFcfa(totalStaked)} FCFA`} />
          <Kpi icon={Users} label={t("players")} value={String(activePlayers)} />
          <Kpi icon={Trophy} label={t("winners")} value={String(winnersCount)} accent />
          <Kpi icon={Wallet} label={t("payouts")} value={`${formatFcfa(totalPayout)} FCFA`} />
        </div>

        {/* Tabs */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-2">
          {tabs.map((tb) => {
            const active = tab === tb.id;
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)} className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition whitespace-nowrap",
                active ? "border-primary bg-primary/15 text-primary shadow-green" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}>
                <tb.icon className="h-3.5 w-3.5" /> {tb.label}
              </button>
            );
          })}
          <Link to="/pronostics" className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5" /> {t("aiPronos")}
          </Link>
        </div>

        {tab === "overview" && (
          <>
            <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">{t("revenue7d")}</h2>
                <span className="text-xs text-muted-foreground">live + simulation</span>
              </div>
              <div className="mt-4 grid grid-cols-7 items-end gap-2 h-40">
                {bars.map((b, i) => (
                  <div key={i} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <div className="w-full rounded-t-lg bg-green-gradient shadow-green" style={{ height: `${Math.max(8, (b.value / maxBar) * 100)}%` }} title={`${formatFcfa(b.value)} FCFA`} />
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{b.label}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-border bg-card shadow-soft">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="font-display text-lg font-bold">Tickets (live)</h2>
                <button onClick={exportCsv} disabled={!tickets.length} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-40">
                  <Download className="h-3.5 w-3.5" /> {t("exportCsv")}
                </button>
              </div>
              {tickets.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun ticket joueur pour le moment.</p>
              ) : (
                <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
                  {tickets.map((tk) => (
                    <div key={tk.id} className="grid grid-cols-[1fr_auto] gap-3 px-5 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold">{tk.id}</div>
                        <div className="truncate text-sm">{tk.gameName} • {tk.picksLabel}</div>
                        <div className="text-xs text-muted-foreground">{tk.phone} {tk.region ? `• ${tk.region}` : ""}</div>
                      </div>
                      <div className="font-display text-sm font-bold tabular-nums">{formatFcfa(tk.stake)}</div>
                      <button onClick={() => cycle(tk.id, tk.status)} className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", statusColor[tk.status])}>{tk.status}</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === "players" && (
          <section className="mt-5 rounded-3xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <h2 className="font-display text-lg font-bold">{t("players")}</h2>
              <div className="flex items-center gap-2">
                <input value={searchPlayer} onChange={(e) => setSearchPlayer(e.target.value)} placeholder="Rechercher…" className="rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
                <select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs">
                  <option value="all">Toutes régions</option>
                  {regionStats.map((r) => <option key={r.region} value={r.region}>{r.region}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
                  <tr><th className="px-4 py-2 text-left">Joueur</th><th className="px-4 py-2 text-left">Région</th><th className="px-4 py-2 text-right">Tickets</th><th className="px-4 py-2 text-right">Misé</th><th className="px-4 py-2 text-right">Gagné</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPlayers.map((p) => (
                    <tr key={p.player + p.region}>
                      <td className="px-4 py-2 font-semibold">{p.player}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.region}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.tickets}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatFcfa(p.staked)}</td>
                      <td className={cn("px-4 py-2 text-right tabular-nums font-bold", p.won > 0 ? "text-success" : "text-muted-foreground")}>{formatFcfa(p.won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "regions" && (
          <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <h2 className="font-display text-lg font-bold">Tendance par région</h2>
            <p className="text-xs text-muted-foreground">Montant misé, gains versés et évolution sur 7 jours.</p>
            <ul className="mt-4 space-y-3">
              {regionStats.map((r) => {
                const pct = (r.staked / maxRegion) * 100;
                return (
                  <li key={r.region}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold">{r.region} <span className="ml-1 text-xs font-normal text-muted-foreground">· {r.players} joueurs · {r.tickets} tickets</span></span>
                      <span className="tabular-nums">
                        <span className="font-display font-bold">{formatFcfa(r.staked)}</span>
                        <span className="ml-2 text-xs text-success">+{formatFcfa(r.paid)}</span>
                        <span className={cn("ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold", r.delta7d >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
                          {r.delta7d >= 0 ? "+" : ""}{r.delta7d}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full bg-green-gradient" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "balls" && (
          <section className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-bold">Boules — fréquence de jeu</h2>
              <p className="text-xs text-muted-foreground">Cliquez une boule pour voir la répartition seule / combinaison et ses paires fréquentes.</p>
              <div className="mt-4 grid grid-cols-9 gap-1.5 sm:grid-cols-10">
                {ballStats.map((b) => {
                  const intensity = b.total / maxBall;
                  const active = selectedBall === b.ball;
                  return (
                    <button key={b.ball} onClick={() => setSelectedBall(b.ball)} className={cn(
                      "flex flex-col items-center justify-center rounded-lg border p-1 transition",
                      active ? "border-primary bg-primary/20" : "border-border bg-card/60 hover:border-primary/40",
                    )} style={{ background: !active ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 35)}%, var(--card))` : undefined }}>
                      <span className="font-display text-xs font-bold">{b.ball}</span>
                      <span className="text-[9px] tabular-nums text-muted-foreground">{b.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              {selBallStat ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="number-ball">{selBallStat.ball}</span>
                    <div>
                      <div className="font-display text-xl font-extrabold">{selBallStat.total} <span className="text-xs font-normal text-muted-foreground">{t("timesPlayed")}</span></div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("soloVsCombo")}</div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="bg-gold" style={{ width: `${(selBallStat.solo / Math.max(1, selBallStat.total)) * 100}%` }} />
                      <div className="bg-primary" style={{ width: `${(selBallStat.combo / Math.max(1, selBallStat.total)) * 100}%` }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] tabular-nums">
                      <span className="text-gold">Seule : {selBallStat.solo}</span>
                      <span className="text-primary">Combinée : {selBallStat.combo}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Top paires</div>
                    <ul className="space-y-1.5">
                      {selBallStat.topPairs.map((p) => (
                        <li key={p.ball} className="flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-2"><span className="number-ball number-ball-sm">{p.ball}</span></span>
                          <span className="tabular-nums font-bold">×{p.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sélectionnez une boule pour afficher ses statistiques détaillées.</p>
              )}
            </div>
          </section>
        )}

        {tab === "ops" && (
          <>
            <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-lg font-bold">Actions</h2>
              <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">{t("autoSmsTitle")}</span>
                      <button type="button" onClick={() => setAutoSms((v) => !v)} className={cn("relative h-6 w-11 rounded-full transition", autoSms ? "bg-primary" : "bg-muted")} aria-pressed={autoSms}>
                        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", autoSms ? "left-5" : "left-0.5")} />
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("autoSmsDesc")}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <section className="rounded-3xl border border-border bg-card shadow-soft">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="font-display text-lg font-bold">{t("cashoutRequests")}</h2>
                  <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">{cashoutRequests.length}</span>
                </div>
                {cashoutRequests.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("noRequests")}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {cashoutRequests.map((id) => {
                      const tk = tickets.find((x) => x.id === id);
                      if (!tk) return null;
                      return (
                        <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-bold">{tk.id}</div>
                            <div className="truncate text-sm">{tk.phone} • {tk.gameName}</div>
                            <div className="text-xs text-success font-bold">{formatFcfa(tk.prize ?? 0)} FCFA</div>
                          </div>
                          <button onClick={() => approveCashout(id)} className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-3 py-1.5 text-xs font-bold text-[var(--gold-foreground)] shadow-gold">
                            <Check className="h-3.5 w-3.5" /> {t("approve")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-3xl border border-border bg-card shadow-soft">
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="font-display text-lg font-bold">{t("sendSms")} — log auto</h2>
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                {sentLog.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun SMS envoyé. Passez un ticket en « winning » pour déclencher l'envoi automatique.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {sentLog.slice(0, 8).map((s) => (
                      <li key={s.id + s.at} className="px-5 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold">{s.id}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(s.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">→ {s.phone} : « Bravo ! Votre ticket {s.id} est gagnant ({formatFcfa(s.prize)} FCFA). Répondez OUI pour encaisser. »</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}

      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border p-4 shadow-soft", accent ? "bg-gold-gradient text-[var(--gold-foreground)]" : "bg-card")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-xs font-semibold uppercase tracking-widest", accent ? "text-[var(--gold-foreground)]/70" : "text-muted-foreground")}>{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}