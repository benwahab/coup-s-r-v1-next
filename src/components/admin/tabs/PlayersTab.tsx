import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { RegionStat } from "@/lib/mock-stats";
import { computePlayerStats } from "@/lib/mock-stats";

type PlayerStat = ReturnType<typeof computePlayerStats>[number];

interface Props {
  filteredPlayers: PlayerStat[];
  regionStats: RegionStat[];
  searchPlayer: string; setSearchPlayer: (v: string) => void;
  filterRegion: string; setFilterRegion: (v: string) => void;
}

export function PlayersTab(p: Props) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card shadow-soft">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-5 py-3 sm:flex sm:flex-wrap sm:justify-between">
        <h2 className="font-display text-lg font-bold min-w-0 truncate">{t("players")}</h2>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input value={p.searchPlayer} onChange={(e) => p.setSearchPlayer(e.target.value)} placeholder="Rechercher…" className="rounded-full border border-border bg-background px-3 py-1.5 text-xs" />
          <select value={p.filterRegion} onChange={(e) => p.setFilterRegion(e.target.value)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs">
            <option value="all">Toutes régions</option>
            {p.regionStats.map((r) => <option key={r.region} value={r.region}>{r.region}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="px-4 py-2 text-left">Joueur</th><th className="px-4 py-2 text-left">Région</th><th className="px-4 py-2 text-right">Tickets</th><th className="px-4 py-2 text-right">Misé</th><th className="px-4 py-2 text-right">Gagné</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {p.filteredPlayers.map((row) => (
              <tr key={row.player + row.region}>
                <td className="px-4 py-2 font-semibold">{row.player}</td>
                <td className="px-4 py-2 text-muted-foreground">{row.region}</td>
                <td className="px-4 py-2 text-right tabular-nums">{row.tickets}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatFcfa(row.staked)}</td>
                <td className={cn("px-4 py-2 text-right tabular-nums font-bold", row.won > 0 ? "text-success" : "text-muted-foreground")}>{formatFcfa(row.won)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}