import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, BarChart3, ListChecks, Users, MapPin, Circle, Send, LogIn, LifeBuoy, Settings, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTickets, type Ticket } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa } from "@/lib/utils";
import { computeBallStats, computePlayerStats, computeRegionStats, generateSimTickets } from "@/lib/mock-stats";
import { sendWinSms, readSmsLog, type SmsEntry } from "@/lib/sms";
import { readAuthLog, type AuthEvent, type AuthEventKind } from "@/lib/auth-logs";
import { useDrafts } from "@/lib/drafts";
import { listMyIntents, type PaymentIntent } from "@/lib/payments";
import { adminListAllPayments } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useThemeChartColors } from "@/hooks/use-theme-chart-colors";
import { downloadCsv, gameLabel, type TxRow } from "@/components/admin/shared";
import { DashboardTab, type ActivityItem } from "@/components/admin/tabs/DashboardTab";
import { TransactionsTab } from "@/components/admin/tabs/TransactionsTab";
import { PlayersTab } from "@/components/admin/tabs/PlayersTab";
import { RegionsTab } from "@/components/admin/tabs/RegionsTab";
import { BallsTab } from "@/components/admin/tabs/BallsTab";
import { OpsTab } from "@/components/admin/tabs/OpsTab";
import { LogsTab } from "@/components/admin/tabs/LogsTab";
import { ClaimsTab } from "@/components/admin/tabs/ClaimsTab";
import { AdminsSection } from "@/components/admin/AdminsSection";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin — Coup Sûr" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Tab = "dashboard" | "transactions" | "players" | "regions" | "balls" | "ops" | "logs" | "claims" | "admins";

function AdminPage() {
  const { t } = useI18n();
  const { authed, session } = useAuth();
  const chart = useThemeChartColors();
  const gameColor: Record<string, string> = { pmu: chart.gold, loto: chart.teal, foot: chart.primary };
  const isAdminResult = useIsAdmin();
  const gate: "checking" | "ok" | "denied" | "anon" =
    !authed || !session
      ? "anon"
      : isAdminResult === null
        ? "checking"
        : isAdminResult
          ? "ok"
          : "denied";

  const { tickets, updateStatus, updateLegStatus } = useTickets();
  const { drafts, removeDraft } = useDrafts();
  const sims = useMemo(() => generateSimTickets(260), []);
  const [tab, setTab] = useState<Tab>("dashboard");

  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [csvFrom, setCsvFrom] = useState(weekAgoIso);
  const [csvTo, setCsvTo] = useState(todayIso);
  const [csvScope, setCsvScope] = useState<"all" | "winners" | "cashout">("all");

  const [autoSms, setAutoSms] = useState(true);
  const [sentLog, setSentLog] = useState<SmsEntry[]>([]);
  const [cashoutRequests, setCashoutRequests] = useState<string[]>([]);

  useEffect(() => { setSentLog(readSmsLog()); }, []);

  const [allIntents, setAllIntents] = useState<PaymentIntent[]>([]);
  useEffect(() => {
    if (gate !== "ok") return;
    (async () => {
      try {
        const { payments } = await adminListAllPayments();
        setAllIntents(payments.map((r) => ({
          key: r.payment_key ?? "",
          txRef: r.reference,
          gameId: "",
          phone: r.user_id,
          amount: r.amount,
          createdAt: new Date(r.created_at).getTime(),
          status: r.status,
        })));
      } catch { setAllIntents([]); }
    })();
    void listMyIntents;
  }, [gate]);

  useEffect(() => {
    if (!autoSms) return;
    const winners = tickets.filter((t) => t.status === "winning");
    const known = new Set(sentLog.map((s) => s.id.split("#")[0]));
    const fresh = winners.filter((w) => !known.has(w.id));
    if (fresh.length === 0) return;
    (async () => {
      const entries = await Promise.all(fresh.map((w) => sendWinSms(w)));
      setSentLog((prev) => [...entries, ...prev]);
    })();
    setCashoutRequests((prev) => Array.from(new Set([...fresh.map((w) => w.id), ...prev])));
  }, [tickets, autoSms, sentLog]);

  // KPIs
  const totalStaked = sims.reduce((s, t) => s + t.stake, 0) + tickets.reduce((s, t) => s + t.stake, 0);
  const totalPayout = sims.filter(s => s.status === "paid").reduce((s, t) => s + t.prize, 0)
    + tickets.filter((t) => t.status === "paid").reduce((s, t) => s + (t.prize ?? 0), 0);
  const winnersCount = sims.filter((s) => s.status === "paid" || s.status === "winning").length
    + tickets.filter((t) => t.status === "winning" || t.status === "paid").length;
  const activePlayers = new Set([...sims.map((s) => s.player), ...tickets.map((t) => t.phone)]).size;

  const todayStake = sims.filter(s => s.iso === todayIso).reduce((a, b) => a + b.stake, 0)
    + tickets.filter(t => t.createdAt.slice(0, 10) === todayIso).reduce((a, b) => a + b.stake, 0);
  const yestIso = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const yestStake = sims.filter(s => s.iso === yestIso).reduce((a, b) => a + b.stake, 0)
    + tickets.filter(t => t.createdAt.slice(0, 10) === yestIso).reduce((a, b) => a + b.stake, 0);
  const growth = yestStake === 0 ? 100 : Math.round(((todayStake - yestStake) / yestStake) * 100);
  const last7 = sims.filter(s => s.daysAgo < 7).reduce((a, b) => a + b.stake, 0);
  const prev7 = sims.filter(s => s.daysAgo >= 7 && s.daysAgo < 14).reduce((a, b) => a + b.stake, 0);
  const weekGrowth = prev7 === 0 ? 0 : Math.round(((last7 - prev7) / prev7) * 100);

  const revenueSeries = useMemo(() => {
    const days: { date: string; label: string; mises: number; gains: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const mises = sims.filter(s => s.iso === iso).reduce((a, b) => a + b.stake, 0)
        + tickets.filter(t => t.createdAt.slice(0, 10) === iso).reduce((a, b) => a + b.stake, 0);
      const gains = sims.filter(s => s.iso === iso && s.status === "paid").reduce((a, b) => a + b.prize, 0)
        + tickets.filter(t => t.createdAt.slice(0, 10) === iso && t.status === "paid").reduce((a, b) => a + (b.prize ?? 0), 0);
      days.push({ date: iso, label: `${d.getDate()}/${d.getMonth() + 1}`, mises, gains });
    }
    return days;
  }, [sims, tickets]);

  const byGameData = useMemo(() => {
    const acc: Record<string, number> = { pmu: 0, loto: 0, foot: 0 };
    const counts: Record<string, number> = { pmu: 0, loto: 0, foot: 0 };
    sims.forEach(s => { acc[s.gameId] += s.stake; counts[s.gameId] += 1; });
    tickets.forEach(t => { if (acc[t.gameId] !== undefined) { acc[t.gameId] += t.stake; counts[t.gameId] += 1; } });
    const total = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(acc).map(([id, value]) => ({
      id, name: gameLabel[id], value, fill: gameColor[id],
      count: counts[id], pct: Math.round((value / total) * 100),
    }));
  }, [sims, tickets, gameColor]);

  const hourlyData = useMemo(() => {
    const hours: { hour: string; count: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, count: 0 }));
    tickets.forEach(t => { const h = new Date(t.createdAt).getHours(); hours[h].count += 1; });
    sims.forEach((s, i) => { const h = ((i * 17 + s.stake / 100) | 0) % 24; hours[h].count += 1; });
    return hours;
  }, [sims, tickets]);
  const peakHour = hourlyData.reduce((m, x) => x.count > m.count ? x : m, hourlyData[0]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; mises: number; gains: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { month: d.toLocaleDateString("fr-FR", { month: "short" }), mises: 0, gains: 0 };
    }
    const bump = (iso: string, stake: number, prize: number) => {
      const key = iso.slice(0, 7);
      if (map[key]) { map[key].mises += stake; map[key].gains += prize; }
    };
    sims.forEach(s => bump(s.iso, s.stake, s.status === "paid" ? s.prize : 0));
    tickets.forEach(t => bump(t.createdAt.slice(0, 10), t.stake, t.status === "paid" ? (t.prize ?? 0) : 0));
    return Object.values(map);
  }, [sims, tickets]);

  const [authLog, setAuthLog] = useState<AuthEvent[]>([]);
  useEffect(() => { setAuthLog(readAuthLog()); }, [tab]);

  const activityFeed: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    tickets.slice(0, 20).forEach(t => items.push({
      at: new Date(t.createdAt).getTime(),
      kind: "ticket", label: `Ticket ${t.id}`, sub: `${t.gameName} · ${formatFcfa(t.stake)} FCFA · ${t.phone}`,
      tone: t.status === "winning" ? "gold" : t.status === "paid" ? "ok" : "info",
    }));
    readAuthLog().slice(0, 15).forEach(l => items.push({
      at: l.at, kind: "auth", label: l.kind, sub: `${l.phone} · ${l.ip}`,
      tone: l.kind === "verify-ok" ? "ok" : l.kind === "verify-fail" || l.kind === "locked" ? "warn" : "info",
    }));
    return items.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [tickets]);

  const allRows: TxRow[] = useMemo(() => {
    const rows: TxRow[] = [];
    tickets.forEach(t => rows.push({
      id: t.id, date: t.createdAt, game: t.gameId, phone: t.phone, region: t.region ?? "—",
      stake: t.stake, status: t.status, prize: t.prize ?? 0, kind: "live",
    }));
    sims.forEach(s => rows.push({
      id: s.id, date: s.iso, game: s.gameId, phone: "—", region: s.region,
      stake: s.stake, status: s.status, prize: s.prize, kind: "sim",
    }));
    return rows;
  }, [tickets, sims]);

  const [txSearch, setTxSearch] = useState("");
  const [txGame, setTxGame] = useState<"all" | "pmu" | "loto" | "foot">("all");
  const [txStatus, setTxStatus] = useState<"all" | "pending" | "winning" | "paid" | "losing">("all");
  const [txSort, setTxSort] = useState<"date-desc" | "date-asc" | "stake-desc" | "stake-asc">("date-desc");
  const [txPage, setTxPage] = useState(1);
  const PAGE = 20;
  const filteredRows = useMemo(() => {
    let r = allRows.filter(x =>
      (txGame === "all" || x.game === txGame) &&
      (txStatus === "all" || x.status === txStatus) &&
      (!txSearch || x.id.toLowerCase().includes(txSearch.toLowerCase()) || x.phone.toLowerCase().includes(txSearch.toLowerCase()) || x.region.toLowerCase().includes(txSearch.toLowerCase()))
    );
    r = r.sort((a, b) => {
      switch (txSort) {
        case "date-desc": return b.date.localeCompare(a.date);
        case "date-asc": return a.date.localeCompare(b.date);
        case "stake-desc": return b.stake - a.stake;
        case "stake-asc": return a.stake - b.stake;
      }
    });
    return r;
  }, [allRows, txSearch, txGame, txStatus, txSort]);
  const pageRows = filteredRows.slice((txPage - 1) * PAGE, txPage * PAGE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE));

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
  const selBallStat = selectedBall ? ballStats.find((b) => b.ball === selectedBall) ?? null : null;

  const exportCsv = (scope: "all" | "winners" | "cashout" = csvScope) => {
    const from = csvFrom; const to = csvTo;
    const inRange = (iso: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;
    const live = tickets.filter((t) => inRange(t.createdAt));
    const simRows = sims.filter((s) => s.iso >= from && s.iso <= to);
    const filtered = [
      ...live.map((t) => ({ id: t.id, date: t.createdAt.slice(0, 10), game: t.gameName, phone: t.phone, region: t.region ?? "", picks: t.picksLabel, stake: t.stake, status: t.status, payment: t.payment, prize: t.prize ?? 0 })),
      ...simRows.map((s) => ({ id: s.id, date: s.iso, game: s.gameId, phone: "—", region: s.region, picks: s.picks.join(" · "), stake: s.stake, status: s.status, payment: "sim", prize: s.prize })),
    ];
    const rows = filtered.filter((r) =>
      scope === "all" ? true : scope === "winners" ? (r.status === "winning" || r.status === "paid") : r.status === "paid",
    );
    const header = ["id", "date", "jeu", "telephone", "region", "selections", "mise_fcfa", "statut", "paiement", "gain_fcfa"];
    const csvBody = rows.map((r) => [r.id, r.date, r.game, r.phone, r.region, `"${r.picks.replace(/"/g, "''")}"`, r.stake, r.status, r.payment, r.prize].join(","));
    downloadCsv([header.join(","), ...csvBody].join("\n"), `coupsur-${scope}-${from}_${to}.csv`);
  };

  const exportTransactionsCsv = () => {
    const header = ["id", "date", "jeu", "telephone", "region", "mise", "statut", "gain", "source"];
    const body = filteredRows.map(r => [r.id, r.date, r.game, r.phone, r.region, r.stake, r.status, r.prize, r.kind].join(","));
    downloadCsv([header.join(","), ...body].join("\n"), `coupsur-transactions-${todayIso}.csv`);
  };

  void updateLegStatus;

  const approveCashout = (id: string) => {
    updateStatus(id, "paid" as Ticket["status"], tickets.find((t) => t.id === id)?.prize);
    setCashoutRequests((prev) => prev.filter((x) => x !== id));
  };

  const nav: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "dashboard", label: t("admin.nav.dashboard"), icon: BarChart3 },
    { id: "transactions", label: t("admin.tx.title"), icon: ListChecks },
    { id: "players", label: t("players"), icon: Users },
    { id: "regions", label: t("regions"), icon: MapPin },
    { id: "balls", label: t("ballsStats"), icon: Circle },
    { id: "ops", label: t("admin.nav.ops"), icon: Send },
    { id: "admins", label: t("admin.ops.title"), icon: Settings },
    { id: "logs", label: t("admin.nav.logs"), icon: LogIn },
    { id: "claims", label: t("admin.nav.claims"), icon: LifeBuoy },
  ];

  // Logs filters
  const [logPhone, setLogPhone] = useState("");
  const [logIp, setLogIp] = useState("");
  const [logKind, setLogKind] = useState<AuthEventKind | "all">("all");
  const filteredLog = useMemo(() => authLog.filter((e) =>
    (logKind === "all" || e.kind === logKind) &&
    (!logPhone || e.phone.includes(logPhone)) &&
    (!logIp || e.ip.includes(logIp)),
  ), [authLog, logPhone, logIp, logKind]);

  const exportLogsCsv = () => {
    const header = ["horodatage", "telephone", "ip", "evenement", "note"];
    const body = filteredLog.map((e) => [new Date(e.at).toISOString(), e.phone, e.ip, e.kind, `"${(e.note ?? "").replace(/"/g, "''")}"`].join(","));
    downloadCsv([header.join(","), ...body].join("\n"), "coupsur-auth-logs.csv");
  };

  // Claims
  const [claimPhone, setClaimPhone] = useState("");
  const claim = useMemo(() => {
    if (!claimPhone) return null;
    const norm = claimPhone.replace(/\s/g, "");
    return {
      tickets: tickets.filter((t) => t.phone.replace(/\s/g, "").includes(norm)),
      drafts: drafts.filter((d) => (d.phone ?? "").replace(/\s/g, "").includes(norm)),
      authEvents: authLog.filter((e) => e.phone.replace(/\s/g, "").includes(norm)).slice(0, 20),
      intents: allIntents.slice(0, 20),
    };
  }, [claimPhone, tickets, drafts, authLog, allIntents]);

  if (gate === "checking") return <div className="min-h-[60vh]" aria-hidden />;
  if (gate === "anon") return <Navigate to="/auth" replace />;
  if (gate === "denied") {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="max-w-md rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-xl font-extrabold">{t("admin.denied.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin.denied.message")}
          </p>
          <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
            {t("admin.denied.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle={t("admin.nav.subtitle")} icon={<ShieldCheck className="h-5 w-5" />} />
      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <nav className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 lg:flex-col lg:items-stretch lg:gap-1 lg:overflow-visible lg:rounded-3xl lg:border lg:border-border lg:bg-card lg:p-2 lg:shadow-soft">
              {nav.map(n => {
                const active = tab === n.id;
                return (
                  <button key={n.id} onClick={() => setTab(n.id)} className={cn(
                    "shrink-0 inline-flex items-center gap-2 rounded-full lg:rounded-xl border px-3 py-1.5 lg:py-2 lg:px-3 text-xs lg:text-sm font-semibold whitespace-nowrap transition lg:justify-start lg:w-full",
                    active
                      ? "border-primary bg-primary/15 text-primary shadow-green"
                      : "border-transparent lg:border-transparent bg-card lg:bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                  )}>
                    <n.icon className="h-4 w-4" /> <span>{n.label}</span>
                  </button>
                );
              })}
              <Link to="/pronostics" className="ml-auto lg:ml-0 lg:mt-2 shrink-0 inline-flex items-center gap-2 rounded-full lg:rounded-xl border border-gold/40 bg-gold/15 px-3 py-1.5 lg:py-2 text-xs lg:text-sm font-bold text-gold whitespace-nowrap lg:justify-start">
                <Sparkles className="h-4 w-4" /> {t("aiPronos")}
              </Link>
            </nav>
          </aside>

          <main className="mt-3 lg:mt-0 min-w-0">
            {tab === "dashboard" && (
              <DashboardTab
                totalStaked={totalStaked} todayStake={todayStake} activePlayers={activePlayers}
                winnersCount={winnersCount} weekGrowth={weekGrowth} growth={growth}
                ticketsCount={tickets.length} totalPayout={totalPayout}
                revenueSeries={revenueSeries} byGameData={byGameData} hourlyData={hourlyData}
                monthlyData={monthlyData} peakHour={peakHour} chart={chart}
                activityFeed={activityFeed} allRowsCount={allRows.length}
                cashoutRequestsCount={cashoutRequests.length} authLogCount={authLog.length}
                csvFrom={csvFrom} csvTo={csvTo} setTab={setTab} exportCsv={exportCsv}
              />
            )}
            {tab === "transactions" && (
              <TransactionsTab
                filteredRows={filteredRows} pageRows={pageRows}
                txSearch={txSearch} setTxSearch={setTxSearch}
                txGame={txGame} setTxGame={setTxGame}
                txStatus={txStatus} setTxStatus={setTxStatus}
                txSort={txSort} setTxSort={setTxSort}
                txPage={txPage} setTxPage={setTxPage} totalPages={totalPages}
                gameColor={gameColor} exportTransactionsCsv={exportTransactionsCsv}
              />
            )}
            {tab === "players" && (
              <PlayersTab
                filteredPlayers={filteredPlayers} regionStats={regionStats}
                searchPlayer={searchPlayer} setSearchPlayer={setSearchPlayer}
                filterRegion={filterRegion} setFilterRegion={setFilterRegion}
              />
            )}
            {tab === "regions" && <RegionsTab regionStats={regionStats} maxRegion={maxRegion} />}
            {tab === "balls" && (
              <BallsTab ballStats={ballStats} maxBall={maxBall}
                selectedBall={selectedBall} setSelectedBall={setSelectedBall}
                selBallStat={selBallStat} />
            )}
            {tab === "ops" && (
              <OpsTab autoSms={autoSms} setAutoSms={(fn) => setAutoSms(fn)}
                csvFrom={csvFrom} setCsvFrom={setCsvFrom}
                csvTo={csvTo} setCsvTo={setCsvTo}
                csvScope={csvScope} setCsvScope={setCsvScope}
                exportCsv={exportCsv}
                cashoutRequests={cashoutRequests} tickets={tickets}
                approveCashout={approveCashout} sentLog={sentLog}
              />
            )}
            {tab === "admins" && <AdminsSection />}
            {tab === "logs" && (
              <LogsTab filteredLog={filteredLog}
                logPhone={logPhone} setLogPhone={setLogPhone}
                logIp={logIp} setLogIp={setLogIp}
                logKind={logKind} setLogKind={setLogKind}
                exportLogsCsv={exportLogsCsv}
              />
            )}
            {tab === "claims" && (
              <ClaimsTab claimPhone={claimPhone} setClaimPhone={setClaimPhone}
                claim={claim} updateStatus={updateStatus} removeDraft={removeDraft}
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}