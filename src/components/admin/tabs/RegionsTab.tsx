import { MapPin } from "lucide-react";
import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export type RegionStat = {
  region: string;
  players: number;
  tickets: number;
  staked: number;
  paid: number;
  delta7d: number;
};
export function RegionsTab({
  regionStats,
  maxRegion,
}: {
  regionStats: RegionStat[];
  maxRegion: number;
}) {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold">{t("admin.regions.title")}</h2>
      </div>
      <p className="text-xs text-muted-foreground">{t("admin.regions.subtitle")}</p>
      <ul className="mt-4 space-y-3">
        {regionStats.map((r) => {
          const pct = (r.staked / maxRegion) * 100;
          return (
            <li key={r.region}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-bold">
                  {r.region}{" "}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ·{" "}
                    {t("admin.regions.playersTickets", { players: r.players, tickets: r.tickets })}
                  </span>
                </span>
                <span className="tabular-nums">
                  <span className="font-display font-bold">{formatFcfa(r.staked)}</span>
                  <span className="ml-2 text-xs text-success">+{formatFcfa(r.paid)}</span>
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      r.delta7d >= 0
                        ? "bg-success/15 text-success"
                        : "bg-destructive/15 text-destructive",
                    )}
                  >
                    {r.delta7d >= 0 ? "+" : ""}
                    {r.delta7d}%
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
  );
}
