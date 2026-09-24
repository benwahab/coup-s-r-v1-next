import { createFileRoute, Link } from "@tanstack/react-router";
import { Ticket as TicketIcon, Search, ArrowUpDown, Loader2, Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useTickets, type Ticket } from "@/lib/tickets";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mes-tickets")({
  head: () => ({
    meta: [{ title: "Mes tickets — Coup Sûr" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: TicketsPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  losing: "bg-muted text-muted-foreground",
  winning: "bg-success/15 text-success",
  paid: "bg-success text-success-foreground",
};

const gameLabel: Record<string, string> = {
  pmu: "PMU",
  loto: "Loto Balsa",
  foot: "Pari Foot",
};

const PAGE_SIZE = 10;
type StatusFilter = "all" | "pending" | "winning" | "paid" | "losing";
type GameFilter = "all" | "pmu" | "loto" | "foot";
type PeriodFilter = "7d" | "30d" | "all";

function TicketsPage() {
  const { t } = useI18n();
  const { tickets, loading, error, refresh } = useTickets();

  const [status, setStatus] = useState<StatusFilter>("all");
  const [game, setGame] = useState<GameFilter>("all");
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date-desc" | "date-asc">("date-desc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      period === "7d" ? now - 7 * 86_400_000 : period === "30d" ? now - 30 * 86_400_000 : 0;
    let list = tickets.filter((tk) => {
      if (status !== "all" && tk.status !== status) return false;
      if (game !== "all" && tk.gameId !== game) return false;
      if (cutoff && new Date(tk.createdAt).getTime() < cutoff) return false;
      if (search && !tk.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === "date-desc" ? db - da : da - db;
    });
    return list;
  }, [tickets, status, game, period, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const activeFilters = status !== "all" || game !== "all" || period !== "all" || !!search;
  const resetFilters = () => {
    setStatus("all");
    setGame("all");
    setPeriod("all");
    setSearch("");
    setPage(1);
  };

  return (
    <>
      <PageHeader title={t("myTickets")} icon={<TicketIcon className="h-5 w-5" />} />
      <div className="mx-auto max-w-3xl px-4 py-4 space-y-4">
        <div className="sticky top-[64px] z-20 -mx-4 px-4 py-3 bg-background/85 backdrop-blur border-b border-border/50">
          <div className="flex flex-col gap-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t("account.searchTicket")}
                className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusFilter);
                  setPage(1);
                }}
                className="min-w-0 rounded-xl border border-border bg-card px-2 py-2 text-xs font-semibold outline-none focus:border-primary/60"
                aria-label={t("account.filterByStatus")}
              >
                <option value="all">{t("account.allStatuses")}</option>
                <option value="pending">{t("pending")}</option>
                <option value="winning">{t("winning")}</option>
                <option value="paid">{t("account.paid")}</option>
                <option value="losing">{t("losing")}</option>
              </select>
              <select
                value={game}
                onChange={(e) => {
                  setGame(e.target.value as GameFilter);
                  setPage(1);
                }}
                className="min-w-0 rounded-xl border border-border bg-card px-2 py-2 text-xs font-semibold outline-none focus:border-primary/60"
                aria-label={t("account.filterByGame")}
              >
                <option value="all">{t("account.allGames")}</option>
                <option value="pmu">PMU</option>
                <option value="loto">Loto Balsa</option>
                <option value="foot">Pari Foot</option>
              </select>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as PeriodFilter);
                  setPage(1);
                }}
                className="min-w-0 rounded-xl border border-border bg-card px-2 py-2 text-xs font-semibold outline-none focus:border-primary/60"
                aria-label={t("account.filterByPeriod")}
              >
                <option value="all">{t("account.allPeriods")}</option>
                <option value="7d">{t("account.last7days")}</option>
                <option value="30d">{t("account.last30days")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSort((s) => (s === "date-desc" ? "date-asc" : "date-desc"))}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sort === "date-desc" ? t("account.newestFirst") : t("account.oldestFirst")}
              </button>
              <span className="text-muted-foreground tabular-nums">
                {t("account.ticketCount", {
                  count: filtered.length,
                  plural: filtered.length > 1 ? "s" : "",
                })}
                {activeFilters && (
                  <button
                    onClick={resetFilters}
                    className="ml-2 font-semibold text-primary hover:underline"
                  >
                    {t("account.reset")}
                  </button>
                )}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <ul className="space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="animate-pulse rounded-2xl border border-border bg-card p-4">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="mt-2 h-4 w-32 rounded bg-muted" />
                <div className="mt-2 h-3 w-3/4 rounded bg-muted" />
              </li>
            ))}
            <li className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("account.loadingTickets")}
            </li>
          </ul>
        ) : error ? (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <p className="text-sm font-semibold text-destructive">
              {t("account.loadTicketsError")}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-4 inline-flex rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-primary hover:border-primary/60"
            >
              {t("account.retry")}
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">{t("noTickets")}</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-soft"
            >
              {t("startPlaying")}
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("account.noFilteredTickets")}</p>
            <button
              onClick={resetFilters}
              className="mt-4 inline-flex rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-primary hover:border-primary/60"
            >
              {t("account.resetFilters")}
            </button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {pageItems.map((tk) => (
                <TicketCard key={tk.id} tk={tk} />
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="flex items-center justify-between gap-2 pt-2" aria-label="Pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={clampedPage === 1}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("account.previous")}
                </button>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {t("account.pageOf", { current: clampedPage, total: totalPages })}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={clampedPage === totalPages}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("account.next")}
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TicketCard({ tk }: { tk: Ticket }) {
  const { t } = useI18n();
  const statusLabel: Record<string, string> = {
    pending: t("pending"),
    losing: t("losing"),
    winning: t("winning"),
    paid: t("account.paid"),
  };
  return (
    <li>
      <Link
        to="/ticket/$id"
        params={{ id: tk.id }}
        className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>{gameLabel[tk.gameId] ?? tk.gameName}</span>
              <span aria-hidden>·</span>
              <time dateTime={tk.createdAt}>
                {new Date(tk.createdAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </time>
            </div>
            <div className="mt-0.5 font-mono text-sm font-bold text-foreground">{tk.id}</div>
            <div className="mt-1 truncate text-sm text-muted-foreground">{tk.picksLabel}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-lg font-bold tabular-nums">
              {tk.stake.toLocaleString()}{" "}
              <span className="text-xs font-semibold text-muted-foreground">{t("fcfa")}</span>
            </div>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                statusColor[tk.status],
              )}
            >
              {statusLabel[tk.status] ?? tk.status}
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
