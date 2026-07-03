import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck, TrendingUp, Users, Trophy, Send, Download, MessageCircle, Check,
  BellRing, Sparkles, MapPin, Circle, BarChart3, LogIn, LifeBuoy, Search, X, Activity,
  ListChecks, ArrowUpRight, ArrowDownRight, Clock, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { useTickets, type Ticket } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn, formatFcfa } from "@/lib/utils";
import { computeBallStats, computePlayerStats, computeRegionStats, generateSimTickets, type SimTicket } from "@/lib/mock-stats";
void ((null as unknown) as SimTicket);
import { sendWinSms, readSmsLog, type SmsEntry } from "@/lib/sms";
import { readAuthLog, type AuthEvent, type AuthEventKind } from "@/lib/auth-logs";
import { useDrafts } from "@/lib/drafts";
import { listIntents } from "@/lib/payments";

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

const gameLabel: Record<string, string> = { pmu: "PMU", loto: "Loto Balsa", foot: "Pari Foot" };
const gameColor: Record<string, string> = { pmu: "hsl(30 90% 55%)", loto: "hsl(160 70% 42%)", foot: "hsl(200 85% 50%)" };

type Tab = "dashboard" | "transactions" | "players" | "regions" | "balls" | "ops" | "logs" | "claims";

function AdminPage() {
  const { t } = useI18n();
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

  // === KPIs ===
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

  // === Chart data ===
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
    sims.forEach(s => { acc[s.gameId] += s.stake; });
    tickets.forEach(t => { if (acc[t.gameId] !== undefined) acc[t.gameId] += t.stake; });
    return Object.entries(acc).map(([id, value]) => ({ id, name: gameLabel[id], value, fill: gameColor[id] }));
  }, [sims, tickets]);

  const hourlyData = useMemo(() => {
    const hours: { hour: string; count: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, count: 0 }));
    // simuler heures via seed
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

  // === Activity feed (recent tickets + auth events, merged) ===
  const activityFeed = useMemo(() => {
    type Item = { at: number; kind: string; label: string; sub: string; tone: "ok" | "warn" | "info" | "gold" };
    const items: Item[] = [];
    tickets.slice(0, 20).forEach(t => items.push({
      at: new Date(t.createdAt).getTime(),
      kind: "ticket", label: `Ticket ${t.id}`, sub: `${t.gameName} · ${formatFcfa(t.stake)} FCFA · ${t.phone}`,
      tone: t.status === "winning" ? "gold" : t.status === "paid" ? "ok" : "info",
    }));
    const logs = readAuthLog().slice(0, 15);
    logs.forEach(l => items.push({
      at: l.at, kind: "auth", label: l.kind, sub: `${l.phone} · ${l.ip}`,
      tone: l.kind === "verify-ok" ? "ok" : l.kind === "verify-fail" || l.kind === "locked" ? "warn" : "info",
    }));
    return items.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [tickets]);

  // === Transactions unified ===
  type Row = { id: string; date: string; game: string; phone: string; region: string; stake: number; status: string; prize: number; kind: "live" | "sim" };
  const allRows: Row[] = useMemo(() => {
    const rows: Row[] = [];
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
  const selBallStat = selectedBall ? ballStats.find((b) => b.ball === selectedBall) : null;

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
    const csv = [header.join(","), ...csvBody].join("\n");
    downloadCsv(csv, `lonani-${scope}-${from}_${to}.csv`);
  };

  const exportTransactionsCsv = () => {
    const header = ["id", "date", "jeu", "telephone", "region", "mise", "statut", "gain", "source"];
    const body = filteredRows.map(r => [r.id, r.date, r.game, r.phone, r.region, r.stake, r.status, r.prize, r.kind].join(","));
    downloadCsv([header.join(","), ...body].join("\n"), `lonani-transactions-${todayIso}.csv`);
  };

  const cycle = (id: string, current: string) => {
    const next = current === "pending" ? "winning" : current === "winning" ? "paid" : current === "paid" ? "losing" : "pending";
    const prize = next === "winning" ? Math.round((tickets.find(t => t.id === id)?.stake ?? 0) * 12) : undefined;
    updateStatus(id, next as Ticket["status"], prize);
  };
  void updateLegStatus;

  const approveCashout = (id: string) => {
    updateStatus(id, "paid", tickets.find((t) => t.id === id)?.prize);
    setCashoutRequests((prev) => prev.filter((x) => x !== id));
  };

  const nav: { id: Tab; label: string; icon: typeof TrendingUp }[] = [
    { id: "dashboard", label: "Tableau de bord", icon: BarChart3 },
    { id: "transactions", label: "Transactions", icon: ListChecks },
    { id: "players", label: t("players"), icon: Users },
    { id: "regions", label: t("regions"), icon: MapPin },
    { id: "balls", label: t("ballsStats"), icon: Circle },
    { id: "ops", label: "SMS & Encaissements", icon: Send },
    { id: "logs", label: "Journal connexions", icon: LogIn },
    { id: "claims", label: "Réclamations", icon: LifeBuoy },
  ];

  // === Journal ===
  const [authLog, setAuthLog] = useState<AuthEvent[]>([]);
  useEffect(() => { setAuthLog(readAuthLog()); }, [tab]);
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
    downloadCsv([header.join(","), ...body].join("\n"), "lonani-auth-logs.csv");
  };

  // === Réclamations ===
  const [claimPhone, setClaimPhone] = useState("");
  const claim = useMemo(() => {
    if (!claimPhone) return null;
    const norm = claimPhone.replace(/\s/g, "");
    return {
      tickets: tickets.filter((t) => t.phone.replace(/\s/g, "").includes(norm)),
      drafts: drafts.filter((d) => (d.phone ?? "").replace(/\s/g, "").includes(norm)),
      authEvents: authLog.filter((e) => e.phone.replace(/\s/g, "").includes(norm)).slice(0, 20),
      intents: listIntents().filter((i) => i.phone.replace(/\s/g, "").includes(norm)).slice(0, 20),
    };
  }, [claimPhone, tickets, drafts, authLog]);

  return (
    <>
      <PageHeader title={t("dashboard")} subtitle="Panneau administrateur" icon={<ShieldCheck className="h-5 w-5" />} />

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
          {/* SIDEBAR */}
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

          {/* MAIN */}
          <main className="mt-3 lg:mt-0 min-w-0">
            {tab === "dashboard" && (
              <div className="space-y-5">
                {/* KPI grid */}
                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Kpi icon={TrendingUp} label="Chiffre d'affaires" value={`${formatFcfa(totalStaked)} FCFA`} delta={weekGrowth} sub="vs 7j précédents" />
                  <Kpi icon={Zap} label="Ventes du jour" value={`${formatFcfa(todayStake)} FCFA`} delta={growth} sub="vs hier" />
                  <Kpi icon={Users} label="Joueurs inscrits" value={String(activePlayers)} sub={`+${tickets.length} tickets live`} />
                  <Kpi icon={Trophy} label="Gagnants" value={String(winnersCount)} accent sub={`${formatFcfa(totalPayout)} FCFA versés`} />
                </section>

                {/* Revenue area + game pie */}
                <section className="grid gap-4 xl:grid-cols-[2fr_1fr]">
                  <ChartCard title="Évolution des ventes (30 jours)" hint="Mises vs gains versés">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueSeries} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="mises" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(160 70% 45%)" stopOpacity={0.5} />
                              <stop offset="100%" stopColor="hsl(160 70% 45%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gains" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(38 92% 55%)" stopOpacity={0.5} />
                              <stop offset="100%" stopColor="hsl(38 92% 55%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={3} />
                          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000) | 0}k`} width={40} />
                          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `${formatFcfa(v)} FCFA`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" name="Mises" dataKey="mises" stroke="hsl(160 70% 45%)" fill="url(#mises)" strokeWidth={2} />
                          <Area type="monotone" name="Gains" dataKey="gains" stroke="hsl(38 92% 55%)" fill="url(#gains)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title="Répartition par jeu" hint="Volume misé">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={byGameData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                            {byGameData.map((entry) => <Cell key={entry.id} fill={entry.fill} />)}
                          </Pie>
                          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `${formatFcfa(v)} FCFA`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </section>

                {/* Hourly + monthly */}
                <section className="grid gap-4 xl:grid-cols-2">
                  <ChartCard title="Heures de forte activité" hint={`Pic à ${peakHour.hour} · ${peakHour.count} tickets`}>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData} margin={{ left: 0, right: 10, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="hour" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" interval={1} />
                          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
                          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                          <Bar dataKey="count" fill="hsl(160 70% 45%)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard title="Comparaison mensuelle" hint="Mises vs gains — 6 derniers mois">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ left: 0, right: 10, top: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000) | 0}k`} width={40} />
                          <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `${formatFcfa(v)} FCFA`} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="mises" name="Mises" fill="hsl(160 70% 45%)" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="gains" name="Gains" fill="hsl(38 92% 55%)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </section>

                {/* Activity feed + Quick actions */}
                <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                  <div className="rounded-3xl border border-border bg-card shadow-soft">
                    <div className="flex items-center justify-between border-b border-border px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <h2 className="font-display text-lg font-bold">Activité en temps réel</h2>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> live</span>
                    </div>
                    {activityFeed.length === 0 ? (
                      <p className="px-5 py-10 text-center text-sm text-muted-foreground">En attente d'activité…</p>
                    ) : (
                      <ul className="divide-y divide-border max-h-[380px] overflow-y-auto">
                        {activityFeed.map((it, i) => (
                          <li key={i} className="flex items-start gap-3 px-5 py-3">
                            <span className={cn(
                              "mt-1 h-2 w-2 shrink-0 rounded-full",
                              it.tone === "ok" ? "bg-success" : it.tone === "warn" ? "bg-destructive" : it.tone === "gold" ? "bg-gold" : "bg-primary",
                            )} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm truncate">{it.label}</span>
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0"><Clock className="inline h-3 w-3 mr-0.5" />{new Date(it.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">{it.sub}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-gold" />
                      <h2 className="font-display text-lg font-bold">Actions rapides</h2>
                    </div>
                    <div className="grid gap-2">
                      <QuickAction onClick={() => setTab("transactions")} icon={ListChecks} label="Voir toutes les transactions" hint={`${allRows.length} enregistrements`} />
                      <QuickAction onClick={() => setTab("ops")} icon={Send} label="Encaissements en attente" hint={`${cashoutRequests.length} demande(s)`} tone="gold" />
                      <QuickAction onClick={() => setTab("logs")} icon={LogIn} label="Journal des connexions" hint={`${authLog.length} événements`} />
                      <QuickAction onClick={() => setTab("claims")} icon={LifeBuoy} label="Ouvrir une réclamation" hint="Recherche par numéro" />
                      <QuickAction onClick={() => exportCsv("all")} icon={Download} label="Exporter toutes les données" hint={`${csvFrom} → ${csvTo}`} />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {tab === "transactions" && (
              <section className="rounded-3xl border border-border bg-card shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <div>
                    <h2 className="font-display text-lg font-bold">Transactions</h2>
                    <p className="text-xs text-muted-foreground">{filteredRows.length} résultats · live + simulation</p>
                  </div>
                  <button onClick={exportTransactionsCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>
                <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={txSearch} onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }} placeholder="ID, téléphone, région…" className="w-full rounded-full border border-border bg-background pl-10 pr-3 py-2 text-sm" />
                  </div>
                  <select value={txGame} onChange={(e) => { setTxGame(e.target.value as typeof txGame); setTxPage(1); }} className="rounded-full border border-border bg-background px-3 py-2 text-sm">
                    <option value="all">Tous les jeux</option>
                    <option value="pmu">PMU</option>
                    <option value="loto">Loto Balsa</option>
                    <option value="foot">Pari Foot</option>
                  </select>
                  <select value={txStatus} onChange={(e) => { setTxStatus(e.target.value as typeof txStatus); setTxPage(1); }} className="rounded-full border border-border bg-background px-3 py-2 text-sm">
                    <option value="all">Tous statuts</option>
                    <option value="pending">En attente</option>
                    <option value="winning">Gagnants</option>
                    <option value="paid">Payés</option>
                    <option value="losing">Perdants</option>
                  </select>
                  <select value={txSort} onChange={(e) => setTxSort(e.target.value as typeof txSort)} className="rounded-full border border-border bg-background px-3 py-2 text-sm">
                    <option value="date-desc">Date ↓</option>
                    <option value="date-asc">Date ↑</option>
                    <option value="stake-desc">Mise ↓</option>
                    <option value="stake-asc">Mise ↑</option>
                  </select>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Jeu</th>
                        <th className="px-3 py-2 text-left hidden sm:table-cell">Téléphone</th>
                        <th className="px-3 py-2 text-left hidden md:table-cell">Région</th>
                        <th className="px-3 py-2 text-right">Mise</th>
                        <th className="px-3 py-2 text-right hidden sm:table-cell">Gain</th>
                        <th className="px-3 py-2 text-left">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pageRows.map((r) => (
                        <tr key={r.id} className="hover:bg-secondary/30">
                          <td className="px-3 py-2 font-mono text-xs font-bold">{r.id}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{r.date.slice(0, 10)}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${gameColor[r.game]}22`, color: gameColor[r.game] }}>{gameLabel[r.game] ?? r.game}</span>
                          </td>
                          <td className="px-3 py-2 text-xs hidden sm:table-cell">{r.phone}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.region}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatFcfa(r.stake)}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums hidden sm:table-cell", r.prize > 0 ? "text-success font-bold" : "text-muted-foreground")}>{r.prize > 0 ? formatFcfa(r.prize) : "—"}</td>
                          <td className="px-3 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusColor[r.status])}>{r.status}</span></td>
                        </tr>
                      ))}
                      {pageRows.length === 0 && (
                        <tr><td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">Aucun résultat.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
                  <span className="text-xs text-muted-foreground">Page {txPage} / {totalPages}</span>
                  <div className="flex items-center gap-1.5">
                    <button disabled={txPage === 1} onClick={() => setTxPage(p => Math.max(1, p - 1))} className="rounded-full border border-border bg-background px-3 py-1 text-xs disabled:opacity-40">Précédent</button>
                    <button disabled={txPage >= totalPages} onClick={() => setTxPage(p => Math.min(totalPages, p + 1))} className="rounded-full border border-border bg-background px-3 py-1 text-xs disabled:opacity-40">Suivant</button>
                  </div>
                </div>
              </section>
            )}

            {tab === "players" && (
              <section className="rounded-3xl border border-border bg-card shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <h2 className="font-display text-lg font-bold">{t("players")}</h2>
                  <div className="flex flex-wrap items-center gap-2">
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
              <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                <h2 className="font-display text-lg font-bold">Tendance par région</h2>
                <p className="text-xs text-muted-foreground">Montant misé, gains versés et évolution sur 7 jours.</p>
                <ul className="mt-4 space-y-3">
                  {regionStats.map((r) => {
                    const pct = (r.staked / maxRegion) * 100;
                    return (
                      <li key={r.region}>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
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
              <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
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
              <div className="space-y-4">
                <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  <h2 className="font-display text-lg font-bold">Paramètres</h2>
                  <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary"><BellRing className="h-4 w-4" /></div>
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
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <input type="date" value={csvFrom} onChange={(e) => setCsvFrom(e.target.value)} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]" />
                    <input type="date" value={csvTo} onChange={(e) => setCsvTo(e.target.value)} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]" />
                    <select value={csvScope} onChange={(e) => setCsvScope(e.target.value as "all" | "winners" | "cashout")} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]">
                      <option value="all">Tous</option>
                      <option value="winners">Gagnants</option>
                      <option value="cashout">Encaissés</option>
                    </select>
                    <button onClick={() => exportCsv()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
                      <Download className="h-3.5 w-3.5" /> {t("exportCsv")}
                    </button>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-2">
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
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun SMS envoyé.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {sentLog.slice(0, 8).map((s) => (
                          <li key={s.id + s.at} className="px-5 py-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold">{s.id}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(s.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="mt-1 break-words text-xs text-muted-foreground">→ {s.phone} : « {s.body} »</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            )}

            {tab === "logs" && (
              <section className="rounded-3xl border border-border bg-card shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                  <h2 className="font-display text-lg font-bold">Journal des connexions</h2>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input value={logPhone} onChange={(e) => setLogPhone(e.target.value)} placeholder="Filtrer numéro" className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
                    <input value={logIp} onChange={(e) => setLogIp(e.target.value)} placeholder="Filtrer IP" className="rounded-full border border-border bg-background px-3 py-1 text-[11px]" />
                    <select value={logKind} onChange={(e) => setLogKind(e.target.value as AuthEventKind | "all")} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]">
                      <option value="all">Tous</option>
                      <option value="otp-request">OTP demandé</option>
                      <option value="verify-ok">Vérification OK</option>
                      <option value="verify-fail">Vérification échec</option>
                      <option value="locked">Verrouillage</option>
                      <option value="rate-limited">Rate limit</option>
                      <option value="logout">Déconnexion</option>
                      <option value="session-expired">Session expirée</option>
                    </select>
                    <button onClick={exportLogsCsv} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </button>
                  </div>
                </div>
                {filteredLog.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">Aucun événement.</p>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-secondary/60 backdrop-blur text-[10px] uppercase tracking-widest text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Horodatage</th>
                          <th className="px-3 py-2 text-left">Numéro</th>
                          <th className="px-3 py-2 text-left">IP</th>
                          <th className="px-3 py-2 text-left">Événement</th>
                          <th className="px-3 py-2 text-left">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredLog.slice(0, 200).map((e, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 tabular-nums text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR", { hour12: false })}</td>
                            <td className="px-3 py-2 font-mono">{e.phone || "—"}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{e.ip}</td>
                            <td className="px-3 py-2"><span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold",
                              e.kind === "verify-ok" ? "bg-success/15 text-success" :
                              e.kind === "verify-fail" ? "bg-destructive/15 text-destructive" :
                              e.kind === "locked" || e.kind === "rate-limited" ? "bg-amber-500/15 text-amber-400" :
                              "bg-secondary text-muted-foreground",
                            )}>{e.kind}</span></td>
                            <td className="px-3 py-2 text-muted-foreground">{e.note ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === "claims" && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  <h2 className="font-display text-lg font-bold">Réclamations — recherche par numéro</h2>
                  <p className="text-xs text-muted-foreground">Consultez l'historique complet du joueur.</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input value={claimPhone} onChange={(e) => setClaimPhone(e.target.value)} placeholder="ex. +227 90 12 34 56" className="w-full rounded-2xl border border-border bg-background pl-10 pr-3 py-2.5 text-sm" />
                    </div>
                    {claimPhone && (
                      <button onClick={() => setClaimPhone("")} className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
                {claim && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-border bg-card shadow-soft">
                      <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Tickets ({claim.tickets.length})</h3></div>
                      {claim.tickets.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun ticket.</p> : (
                        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                          {claim.tickets.map((tk) => (
                            <li key={tk.id} className="p-3 text-xs">
                              <div className="flex items-center justify-between"><span className="font-mono font-bold">{tk.id}</span><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", statusColor[tk.status])}>{tk.status}</span></div>
                              <div className="mt-0.5 text-muted-foreground truncate">{tk.gameName} · {formatFcfa(tk.stake)} FCFA</div>
                              <div className="mt-1 flex gap-1.5">
                                <button onClick={() => updateStatus(tk.id, "paid", tk.prize ?? tk.stake * 12)} className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">Marquer payé</button>
                                <button onClick={() => updateStatus(tk.id, "losing")} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Annuler</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-3xl border border-border bg-card shadow-soft">
                      <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Brouillons ({claim.drafts.length})</h3></div>
                      {claim.drafts.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun brouillon.</p> : (
                        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                          {claim.drafts.map((d) => (
                            <li key={d.id} className="p-3 text-xs flex items-center justify-between">
                              <div className="min-w-0"><div className="font-mono font-bold">{d.id}</div><div className="text-muted-foreground truncate">{d.gameName} · {formatFcfa(d.totalStake)} FCFA</div></div>
                              <button onClick={() => removeDraft(d.id)} className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive">Supprimer</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-3xl border border-border bg-card shadow-soft">
                      <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Événements auth ({claim.authEvents.length})</h3></div>
                      {claim.authEvents.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun événement.</p> : (
                        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                          {claim.authEvents.map((e, i) => (
                            <li key={i} className="p-3 text-xs flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">{new Date(e.at).toLocaleString("fr-FR", { hour12: false })}</span>
                              <span className="font-bold">{e.kind}</span>
                              <span className="font-mono text-muted-foreground">{e.ip}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-3xl border border-border bg-card shadow-soft">
                      <div className="border-b border-border px-5 py-3"><h3 className="font-display font-bold">Paiements ({claim.intents.length})</h3></div>
                      {claim.intents.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Aucun paiement.</p> : (
                        <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                          {claim.intents.map((p) => (
                            <li key={p.txRef} className="p-3 text-xs flex items-center justify-between gap-2">
                              <span className="font-mono">{p.txRef}</span>
                              <span className="tabular-nums font-bold">{formatFcfa(p.amount)} FCFA</span>
                              <span className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                p.status === "confirmed" ? "bg-success/15 text-success" :
                                p.status === "failed" ? "bg-destructive/15 text-destructive" :
                                "bg-secondary text-muted-foreground",
                              )}>{p.status}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

/* helpers */

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function Kpi({ icon: Icon, label, value, accent, delta, sub }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean; delta?: number; sub?: string }) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("rounded-2xl border border-border p-4 shadow-soft", accent ? "bg-gold-gradient text-[var(--gold-foreground)]" : "bg-card")}>
      <div className="flex items-center justify-between">
        <div className={cn("text-xs font-semibold uppercase tracking-widest", accent ? "text-[var(--gold-foreground)]/70" : "text-muted-foreground")}>{label}</div>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        {typeof delta === "number" && (
          <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold",
            accent ? "bg-black/10 text-[var(--gold-foreground)]" :
            positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {positive ? "+" : ""}{delta}%
          </span>
        )}
        {sub && <span className={cn(accent ? "text-[var(--gold-foreground)]/80" : "text-muted-foreground")}>{sub}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, hint, onClick, tone }: { icon: typeof TrendingUp; label: string; hint?: string; onClick: () => void; tone?: "gold" }) {
  return (
    <button onClick={onClick} className={cn(
      "group flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-primary/40 hover:bg-primary/5",
      tone === "gold" ? "border-gold/30 bg-gold/5" : "border-border bg-background/50",
    )}>
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone === "gold" ? "bg-gold/20 text-gold" : "bg-primary/15 text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold truncate">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

