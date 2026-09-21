import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, BarChart3, ListChecks, Users, MapPin, Circle, Send, LogIn, Settings, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa } from "@/lib/utils";

import { readAuthLog, type AuthEvent, type AuthEventKind } from "@/lib/auth-logs";
import type { PaymentIntent } from "@/lib/payments";
import { adminGetLotoBallStatistics, adminListPlayerActivities, adminListTickets, getMyAdminPermissions, type AdminPermission, type LotoBallWagerStat, type LotoCombinationWagerStat } from "@/lib/admin.functions";
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
import { ResultsTab } from "@/components/admin/tabs/ResultsTab";
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

type Tab = "dashboard" | "transactions" | "players" | "regions" | "balls" | "ops" | "results" | "logs" | "claims" | "admins";

function AdminPage() {
  const { t } = useI18n();
  const { authed, session } = useAuth();
  const chart = useThemeChartColors();
  const gameColor: Record<string, string> = { pmu: chart.gold, loto: chart.teal, foot: chart.primary };
  const isAdminResult = useIsAdmin();
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[] | "all">([]);
  const [lotoBallWagerStats, setLotoBallWagerStats] = useState<LotoBallWagerStat[]>([]);
  const [lotoCombinationWagerStats, setLotoCombinationWagerStats] = useState<LotoCombinationWagerStat[]>([]);
  const [lotoBallStatsLive, setLotoBallStatsLive] = useState(false);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const gate: "checking" | "ok" | "denied" | "anon" =
    !authed || !session
      ? "anon"
      : isAdminResult === null
        ? "checking"
        : isAdminResult
          ? "ok"
          : "denied";

  useEffect(() => {
    if (gate !== "ok") return;
    setPermissionsReady(false);
    getMyAdminPermissions()
      .then((result) => setAdminPermissions(result.permissions))
      .catch(() => setAdminPermissions([]))
      .finally(() => setPermissionsReady(true));
  }, [gate]);

  // SECURITY: the admin surface deliberately has no access to client tickets,
  // selections, legs, ticket status or prizes. Only aggregate/demo statistics
  // and sanitized player activity are available here.
  const [adminTicketRows, setAdminTicketRows] = useState<Awaited<ReturnType<typeof adminListTickets>>["tickets"]>([]);
  useEffect(() => {
    if (gate !== "ok" || !permissionsReady || !can("player_activity")) return;
    adminListTickets().then((r) => setAdminTicketRows(r.tickets)).catch(() => setAdminTicketRows([]));
  }, [gate, permissionsReady, adminPermissions]);
  const [tab, setTab] = useState<Tab>("dashboard");
  useEffect(() => {
    if (!permissionsReady || adminPermissions === "all" || tab !== "dashboard") return;
    const first =
      adminPermissions.includes("player_activity") ? "transactions" :
      adminPermissions.includes("player_stats") ? "players" :
      adminPermissions.includes("region_stats") ? "regions" :
      adminPermissions.includes("ball_stats") ? "balls" :
      adminPermissions.includes("publish_results") ? "results" :
      adminPermissions.includes("complaints") ? "claims" :
      adminPermissions.includes("security_logs") ? "logs" :
      "dashboard";
    setTab(first);
  }, [permissionsReady, adminPermissions, tab]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [csvFrom, setCsvFrom] = useState(weekAgoIso);
  const [csvTo, setCsvTo] = useState(todayIso);
  const [csvScope, setCsvScope] = useState<"all" | "winners" | "cashout">("all");

  const sentLog: never[] = [];

  const [allIntents, setAllIntents] = useState<PaymentIntent[]>([]);
  useEffect(() => {
    if (gate !== "ok" || !permissionsReady) return;
    if (adminPermissions !== "all" && !adminPermissions.includes("ball_stats")) return;
    adminGetLotoBallStatistics()
      .then((result) => {
        setLotoBallWagerStats(result.balls);
        setLotoCombinationWagerStats(result.combinations);
        setLotoBallStatsLive(true);
      })
      .catch(() => setLotoBallStatsLive(false));
  }, [gate, permissionsReady, adminPermissions]);

  useEffect(() => {
    if (gate !== "ok") return;
    (async () => {
      try {
        const { payments } = await adminListPlayerActivities();
        setAllIntents(payments.map((r) => ({
          key: "",
          txRef: r.reference,
          gameId: r.gameId ?? "",
          phone: r.playerId,
          amount: r.amount,
          createdAt: new Date(r.occurredAt).getTime(),
          status: r.status,
        })));
      } catch { setAllIntents([]); }
    })();
  }, [gate, permissionsReady]);

  useEffect(() => {
    if (!autoSms) return;
    const winners = adminTicketRows.filter((t) => t.status === "winning");
    const known = new Set(sentLog.map((s) => s.id.split("#")[0]));
    const fresh = winners.filter((w) => !known.has(w.id));
    if (fresh.length === 0) return;
    (async () => {
      const entries = await Promise.all(fresh.map((w) => sendWinSms(w)));
      setSentLog((prev) => [...entries, ...prev]);
    })();
    setCashoutRequests((prev) => Array.from(new Set([...fresh.map((w) => w.id), ...prev])));
  }, [adminTicketRows, autoSms, sentLog]);

  // KPIs
  const totalStaked = adminTicketRows.reduce((s, t) => s + t.stake, 0);
  const totalPayout = adminTicketRows.filter((t) => t.status === "paid").reduce((s, t) => s + (t.prize ?? 0), 0);
  const winnersCount = adminTicketRows.filter((t) => t.status === "paid" || t.status === "winning").length;
  const activePlayers = new Set(adminTicketRows.map((t) => t.userId)).size;

  const todayStake = adminTicketRows.filter(t => t.createdAt.slice(0, 10) === todayIso).reduce((a, b) => a + b.stake, 0);
  const yestIso = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const yestStake = adminTicketRows.filter(t => t.createdAt.slice(0, 10) === yestIso).reduce((a, b) => a + b.stake, 0);
  const growth = yestStake === 0 ? 100 : Math.round(((todayStake - yestStake) / yestStake) * 100);
  const last7 = adminTicketRows.filter(s => Date.now() - new Date(s.createdAt).getTime() < 7 * 86400000).reduce((a, b) => a + b.stake, 0);
  const prev7 = adminTicketRows.filter(s => { const age = Date.now() - new Date(s.createdAt).getTime(); return age >= 7 * 86400000 && age < 14 * 86400000; }).reduce((a, b) => a + b.stake, 0);
  const weekGrowth = prev7 === 0 ? 0 : Math.round(((last7 - prev7) / prev7) * 100);

  const revenueSeries = useMemo(() => {
    const days: { date: string; label: string; mises: number; gains: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const rows = adminTicketRows.filter(t => t.createdAt.slice(0, 10) === iso);
      days.push({
        date: iso, label: `${d.getDate()}/${d.getMonth() + 1}`,
        mises: rows.reduce((a, b) => a + b.stake, 0),
        gains: rows.filter(t => t.status === "paid").reduce((a, b) => a + (b.prize ?? 0), 0),
      });
    }
    return days;
  }, [adminTicketRows]);

  const byGameData = useMemo(() => {
    const acc: Record<string, number> = { pmu: 0, loto: 0, foot: 0 };
    const counts: Record<string, number> = { pmu: 0, loto: 0, foot: 0 };
    adminTicketRows.forEach(t => { if (acc[t.gameId] !== undefined) { acc[t.gameId] += t.stake; counts[t.gameId] += 1; } });
    const total = Object.values(acc).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(acc).map(([id, value]) => ({ id, name: gameLabel[id], value, fill: gameColor[id], count: counts[id], pct: Math.round((value / total) * 100) }));
  }, [adminTicketRows, gameColor]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, count: 0 }));
    adminTicketRows.forEach(t => { hours[new Date(t.createdAt).getHours()].count += 1; });
    return hours;
  }, [adminTicketRows]);
  const peakHour = hourlyData.reduce((m, x) => x.count > m.count ? x : m, hourlyData[0]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; mises: number; gains: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = { month: d.toLocaleDateString("fr-FR", { month: "short" }), mises: 0, gains: 0 };
    }
    adminTicketRows.forEach(t => {
      const key = t.createdAt.slice(0, 7);
      if (map[key]) { map[key].mises += t.stake; map[key].gains += t.status === "paid" ? (t.prize ?? 0) : 0; }
    });
    return Object.values(map);
  }, [adminTicketRows]);

  const allRows: TxRow[] = useMemo(() => adminTicketRows.map(t => ({
    id: t.code, date: t.createdAt, game: t.gameId, phone: t.phone ?? "—", region: t.region ?? "—",
    stake: t.stake, status: t.status, prize: t.prize ?? 0, kind: "live",
  })), [adminTicketRows]);

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

  type RegionStat = { region: string; players: number; tickets: number; staked: number; paid: number; delta7d: number };
  type PlayerStat = { player: string; region: string; tickets: number; staked: number; won: number };
  type BallStat = { ball: number; total: number; solo: number; combo: number; topPairs: { ball: number; count: number }[] };

  const regionStats: RegionStat[] = useMemo(() => {
    const map = new Map<string, { players: Set<string>; tickets: number; staked: number; paid: number }>();
    adminTicketRows.forEach(t => {
      const region = t.region || "Non renseignée";
      const row = map.get(region) ?? { players: new Set<string>(), tickets: 0, staked: 0, paid: 0 };
      row.players.add(t.userId); row.tickets += 1; row.staked += t.stake;
      if (t.status === "paid") row.paid += t.prize ?? 0;
      map.set(region, row);
    });
    return Array.from(map, ([region, v]) => ({ region, players: v.players.size, tickets: v.tickets, staked: v.staked, paid: v.paid, delta7d: 0 })).sort((a,b) => b.staked-a.staked);
  }, [adminTicketRows]);
  const maxRegion = Math.max(1, ...regionStats.map(r => r.staked));

  const playerStats: PlayerStat[] = useMemo(() => {
    const map = new Map<string, PlayerStat>();
    adminTicketRows.forEach(t => {
      const key = t.userId;
      const row = map.get(key) ?? { player: t.phone || t.userId.slice(0, 8), region: t.region || "Non renseignée", tickets: 0, staked: 0, won: 0 };
      row.tickets += 1; row.staked += t.stake; if (t.status === "paid") row.won += t.prize ?? 0;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a,b) => b.staked-a.staked);
  }, [adminTicketRows]);

  const ballStats: BallStat[] = useMemo(() => Array.from({ length: 90 }, (_, i) => {
    const live = lotoBallWagerStats.find(s => s.ball === i + 1);
    return { ball: i + 1, total: live?.wagerCount ?? 0, solo: live?.wagerCount ?? 0, combo: 0, topPairs: [] };
  }), [lotoBallWagerStats]);
  const maxBall = Math.max(1, ...ballStats.map(b => b.total));
  const displayLotoBallWagerStats = lotoBallWagerStats;
  const displayLotoCombinationWagerStats = lotoCombinationWagerStats;

  const [searchPlayer, setSearchPlayer] = useState("");
  const [filterRegion, setFilterRegion] = useState("all");
  const filteredPlayers = playerStats.filter(
    (p) => (filterRegion === "all" || p.region === filterRegion) && p.player.toLowerCase().includes(searchPlayer.toLowerCase()),
  ).slice(0, 30);

  const [selectedBall, setSelectedBall] = useState<number | null>(null);
  const selBallStat = selectedBall ? ballStats.find((b) => b.ball === selectedBall) ?? null : null;

  const exportCsv = (scope: "all" | "winners" | "cashout" = csvScope) => {
    const from = csvFrom; const to = csvTo;
    const rows = adminTicketRows.filter(t => t.createdAt.slice(0, 10) >= from && t.createdAt.slice(0, 10) <= to)
      .filter(t => scope === "all" ? true : scope === "winners" ? (t.status === "winning" || t.status === "paid") : t.status === "paid")
      .map(t => ({ id: t.code, date: t.createdAt.slice(0, 10), game: t.gameName, phone: t.phone ?? "", region: t.region ?? "", picks: "", stake: t.stake, status: t.status, payment: t.paymentMethod, prize: t.prize ?? 0 }));
    const header = ["id","date","jeu","telephone","region","selections","mise_fcfa","statut","paiement","gain_fcfa"];
    downloadCsv([header.join(","), ...rows.map(r => [r.id,r.date,r.game,r.phone,r.region,r.picks,r.stake,r.status,r.payment,r.prize].join(","))].join("\n"), `coupsur-${scope}-${from}_${to}.csv`);
  };

  const exportTransactionsCsv = () => {
    const header = ["id","date","jeu","telephone","region","mise","statut","gain","source"];
    const body = filteredRows.map(r => [r.id,r.date,r.game,r.phone,r.region,r.stake,r.status,r.prize,r.kind].join(","));
    downloadCsv([header.join(","), ...body].join("\n"), `coupsur-transactions-${todayIso}.csv`);
  };

  const nav: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "dashboard", label: t("admin.nav.dashboard"), icon: BarChart3 },
    { id: "transactions", label: t("admin.tx.title"), icon: ListChecks },
    { id: "players", label: t("players"), icon: Users },
    { id: "regions", label: t("regions"), icon: MapPin },
    { id: "balls", label: t("ballsStats"), icon: Circle },
    { id: "ops", label: t("admin.nav.ops"), icon: Send },
    { id: "results", label: "Résultats", icon: ListChecks },
    { id: "claims", label: "Réclamations", icon: ShieldCheck },
    { id: "admins", label: t("admin.ops.title"), icon: Settings },
    { id: "logs", label: t("admin.nav.logs"), icon: LogIn },
      ];

  const visibleNav = adminPermissions === "all"
    ? nav
    : nav.filter((item) => {
        switch (item.id) {
          case "transactions": return can("player_activity");
          case "players": return can("player_stats");
          case "regions": return can("region_stats");
          case "balls": return can("ball_stats");
          case "results": return can("publish_results");
          case "claims": return can("complaints");
          case "logs": return can("security_logs");
          case "ops": return can("operations");
          case "claims": return can("complaints");
          case "ops": return can("operations");
          default: return false;
        }
      });

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
    downloadCsv([header.join(","), ...body].join("
"), "coupsur-auth-logs.csv");
  };

  if (gate === "checking" || !permissionsReady) return <div className="min-h-[60vh]" aria-hidden />;
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
              {visibleNav.map(n => {
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
            {adminPermissions === "all" && tab === "dashboard" && (
              <DashboardTab
                totalStaked={totalStaked} todayStake={todayStake} activePlayers={activePlayers}
                winnersCount={winnersCount} weekGrowth={weekGrowth} growth={growth}
                ticketsCount={adminTicketRows.length} totalPayout={totalPayout}
                revenueSeries={revenueSeries} byGameData={byGameData} hourlyData={hourlyData}
                monthlyData={monthlyData} peakHour={peakHour} chart={chart}
                activityFeed={activityFeed} allRowsCount={allRows.length}
                cashoutRequestsCount={cashoutRequests.length} authLogCount={authLog.length}
                csvFrom={csvFrom} csvTo={csvTo} setTab={setTab} exportCsv={exportCsv}
              />
            )}
            {can("player_activity") && tab === "transactions" && (
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
            {can("player_stats") && tab === "players" && (
              <PlayersTab
                filteredPlayers={filteredPlayers} regionStats={regionStats}
                searchPlayer={searchPlayer} setSearchPlayer={setSearchPlayer}
                filterRegion={filterRegion} setFilterRegion={setFilterRegion}
              />
            )}
            {can("region_stats") && tab === "regions" && <RegionsTab regionStats={regionStats} maxRegion={maxRegion} />}
            {can("ball_stats") && tab === "balls" && (
              <BallsTab ballStats={ballStats} maxBall={maxBall}
                selectedBall={selectedBall} setSelectedBall={setSelectedBall}
                selBallStat={selBallStat}
                wagerStats={displayLotoBallWagerStats}
                combinationStats={displayLotoCombinationWagerStats}
                live={lotoBallStatsLive} />
            )}
            {can("publish_results") && tab === "results" && <ResultsTab />}
            {can("operations") && tab === "ops" && (
              <OpsTab autoSms={false} setAutoSms={() => undefined}
                csvFrom={csvFrom} setCsvFrom={setCsvFrom}
                csvTo={csvTo} setCsvTo={setCsvTo}
                csvScope={csvScope} setCsvScope={setCsvScope}
                exportCsv={exportCsv}
                cashoutRequests={cashoutRequests} tickets={[]}
                approveCashout={() => { throw new Error("admin_cashout_ui_disabled"); }} sentLog={sentLog}
              />
            )}
            {adminPermissions === "all" && tab === "admins" && <AdminsSection />}
            {can("complaints") && tab === "claims" && (
              <section className="rounded-3xl border border-border bg-card p-6 shadow-soft"><h2 className="font-display text-lg font-bold">Réclamations</h2><p className="mt-2 text-sm text-muted-foreground">La source réelle des réclamations n’est pas encore connectée. Aucune action fictive n’est proposée.</p></section>
            )}\n            {can("security_logs") && tab === "logs" && (
              <LogsTab filteredLog={filteredLog}
                logPhone={logPhone} setLogPhone={setLogPhone}
                logIp={logIp} setLogIp={setLogIp}
                logKind={logKind} setLogKind={setLogKind}
                exportLogsCsv={exportLogsCsv}
              />
            )}

          </main>
        </div>
      </div>
    </>
  );
}