import { Download, ListChecks, Search } from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { statusColor, gameLabel, type TxRow } from "../shared";

interface Props {
  filteredRows: TxRow[];
  pageRows: TxRow[];
  txSearch: string;
  setTxSearch: (v: string) => void;
  txGame: "all" | "pmu" | "loto" | "foot";
  setTxGame: (v: "all" | "pmu" | "loto" | "foot") => void;
  txStatus: "all" | "pending" | "winning" | "paid" | "losing";
  setTxStatus: (v: "all" | "pending" | "winning" | "paid" | "losing") => void;
  txSort: "date-desc" | "date-asc" | "stake-desc" | "stake-asc";
  setTxSort: (v: "date-desc" | "date-asc" | "stake-desc" | "stake-asc") => void;
  txPage: number;
  setTxPage: (v: number | ((p: number) => number)) => void;
  totalPages: number;
  gameColor: Record<string, string>;
  exportTransactionsCsv: () => void;
}

export function TransactionsTab(p: Props) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:flex sm:flex-wrap sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="font-display text-lg font-bold truncate">{t("admin.tx.title")}</h2>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {t("admin.tx.resultsCount", { count: p.filteredRows.length })}
          </p>
        </div>
        <button
          onClick={p.exportTransactionsCsv}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40"
        >
          <Download className="h-3.5 w-3.5" /> {t("admin.logs.exportCsv")}
        </button>
      </div>
      <div className="grid gap-2 border-b border-border px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={p.txSearch}
            onChange={(e) => {
              p.setTxSearch(e.target.value);
              p.setTxPage(1);
            }}
            placeholder={t("admin.tx.searchPlaceholder")}
            className="w-full rounded-full border border-border bg-background pl-10 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={p.txGame}
          onChange={(e) => {
            p.setTxGame(e.target.value as typeof p.txGame);
            p.setTxPage(1);
          }}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">{t("admin.tx.allGames")}</option>
          <option value="pmu">PMU</option>
          <option value="loto">Loto Balsa</option>
          <option value="foot">Pari Foot</option>
        </select>
        <select
          value={p.txStatus}
          onChange={(e) => {
            p.setTxStatus(e.target.value as typeof p.txStatus);
            p.setTxPage(1);
          }}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">{t("admin.tx.allStatuses")}</option>
          <option value="pending">{t("admin.tx.pending")}</option>
          <option value="winning">{t("admin.dash.winners")}</option>
          <option value="paid">{t("admin.tx.paid")}</option>
          <option value="losing">{t("admin.tx.losing")}</option>
        </select>
        <select
          value={p.txSort}
          onChange={(e) => p.setTxSort(e.target.value as typeof p.txSort)}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="date-desc">{t("admin.tx.dateDesc")}</option>
          <option value="date-asc">{t("admin.tx.dateAsc")}</option>
          <option value="stake-desc">{t("admin.tx.stakeDesc")}</option>
          <option value="stake-asc">{t("admin.tx.stakeAsc")}</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">{t("admin.tx.date")}</th>
              <th className="px-3 py-2 text-left">{t("admin.tx.game")}</th>
              <th className="px-3 py-2 text-left hidden sm:table-cell">{t("phone")}</th>
              <th className="px-3 py-2 text-left hidden md:table-cell">{t("region")}</th>
              <th className="px-3 py-2 text-right">{t("admin.tx.stake")}</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">{t("admin.tx.gain")}</th>
              <th className="px-3 py-2 text-left">{t("admin.tx.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {p.pageRows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-3 py-2 font-mono text-xs font-bold">{r.id}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                  {r.date.slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ background: `${p.gameColor[r.game]}22`, color: p.gameColor[r.game] }}
                  >
                    {gameLabel[r.game] ?? r.game}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs hidden sm:table-cell">{r.phone}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                  {r.region}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {formatFcfa(r.stake)}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums hidden sm:table-cell",
                    r.prize > 0 ? "text-success font-bold" : "text-muted-foreground",
                  )}
                >
                  {r.prize > 0 ? formatFcfa(r.prize) : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      statusColor[r.status],
                    )}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {p.pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-sm text-muted-foreground">
                  {t("admin.tx.noResult")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
        <span className="text-xs text-muted-foreground">
          {t("admin.tx.pageOf", { page: p.txPage, total: p.totalPages })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            disabled={p.txPage === 1}
            onClick={() => p.setTxPage((prev: number) => Math.max(1, prev - 1))}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs disabled:opacity-40"
          >
            {t("admin.tx.previous")}
          </button>
          <button
            disabled={p.txPage >= p.totalPages}
            onClick={() => p.setTxPage((prev: number) => Math.min(p.totalPages, prev + 1))}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs disabled:opacity-40"
          >
            {t("admin.tx.next")}
          </button>
        </div>
      </div>
    </section>
  );
}
