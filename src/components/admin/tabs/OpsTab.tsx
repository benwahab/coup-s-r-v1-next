import { Download, Settings, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { adminUpdateGameSchedule, getGameSchedules } from "@/lib/game-schedule.functions";

import { useI18n } from "@/lib/i18n";

interface Props {
  csvFrom: string;
  setCsvFrom: (v: string) => void;
  csvTo: string;
  setCsvTo: (v: string) => void;
  csvScope: "all" | "winners" | "cashout";
  setCsvScope: (v: "all" | "winners" | "cashout") => void;
  exportCsv: (scope?: "all" | "winners" | "cashout") => void;
}

export function OpsTab(p: Props) {
  const { t } = useI18n();
  type Schedule = {
    open_hour: number;
    close_hour: number;
    draw_hour: number;
    draw_minute: number;
    enabled: boolean;
    daily_stats_date: string;
    today_winners_count: number | null;
    today_paid_fcfa: number | null;
  };
  const [schedules, setSchedules] = useState<Partial<Record<"pmu" | "loto", Schedule>>>({});
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  useEffect(() => {
    void getGameSchedules()
      .then((rows) => {
        setSchedules((prev) => {
          const next = { ...prev };
          for (const row of rows)
            if (row.game_id === "pmu" || row.game_id === "loto")
              next[row.game_id] = {
                open_hour: row.open_hour,
                close_hour: row.close_hour,
                draw_hour: row.draw_hour,
                draw_minute: row.draw_minute,
                enabled: row.enabled,
                daily_stats_date: row.daily_stats_date,
                today_winners_count: row.today_winners_count,
                today_paid_fcfa: row.today_paid_fcfa,
              };
          return next;
        });
      })
      .catch(() => setScheduleMsg(t("admin.static.scheduleLoadError")));
  }, []);
  const saveSchedule = async (gameId: "pmu" | "loto") => {
    const s = schedules[gameId];
    if (!s) {
      setScheduleMsg(t("admin.static.noSchedule", { game: gameId === "pmu" ? "PMU" : "Loto Balsa" }));
      return;
    }
    try {
      const dailyStatsDate = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Niamey" });
      await adminUpdateGameSchedule({
        data: {
          gameId,
          ...s,
          dailyStatsDate,
          todayWinnersCount: s.today_winners_count,
          todayPaidFcfa: s.today_paid_fcfa,
        },
      });
      setScheduleMsg(t("admin.static.scheduleSaved", { game: gameId === "pmu" ? "PMU" : "Loto Balsa" }));
    } catch (e) {
      setScheduleMsg((e as Error).message || "Échec de l'enregistrement.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.static.gameSchedule")}</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Les horaires PMU et Loto sont définis manuellement par l'administration. Fuseau :
          Africa/Niamey.
        </p>
        {(["pmu", "loto"] as const).map((gameId) => {
          const s = schedules[gameId];
          if (!s)
            return (
              <div
                key={gameId}
                className="mt-4 rounded-2xl border border-border p-4 text-sm text-muted-foreground"
              >
                {t("admin.static.noSchedule", { game: gameId === "pmu" ? "PMU" : "Loto Balsa" })}
              </div>
            );
          const field = (
            key: "open_hour" | "close_hour" | "draw_hour" | "draw_minute",
            label: string,
          ) => (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {label}
              </span>
              <input
                type="number"
                min={0}
                max={key === "draw_minute" ? 59 : 23}
                value={s[key]}
                onChange={(e) =>
                  setSchedules((prev) => ({
                    ...prev,
                    [gameId]: { ...prev[gameId], [key]: Number(e.target.value) },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          );
          return (
            <div key={gameId} className="mt-4 rounded-2xl border border-border p-4">
              <div className="mb-3 font-bold">{gameId === "pmu" ? "PMU" : "Loto Balsa"}</div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {field("open_hour", t("openAt"))}
                {field("close_hour", t("closeAt"))}
                {field("draw_hour", t("drawAt"))}
                {field("draw_minute", t("admin.static.drawMinute"))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) =>
                    setSchedules((prev) => ({
                      ...prev,
                      [gameId]: { ...prev[gameId]!, enabled: e.target.checked },
                    }))
                  }
                />
                Jeu actif
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("todayWinners")}</span>
                  <input
                    type="number"
                    min={0}
                    value={s.today_winners_count ?? ""}
                    onChange={(e) =>
                      setSchedules((prev) => ({
                        ...prev,
                        [gameId]: { ...prev[gameId]!, today_winners_count: e.target.value === "" ? null : Number(e.target.value) },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("totalPaidToday")} ({t("fcfa")})</span>
                  <input
                    type="number"
                    min={0}
                    value={s.today_paid_fcfa ?? ""}
                    onChange={(e) =>
                      setSchedules((prev) => ({
                        ...prev,
                        [gameId]: { ...prev[gameId]!, today_paid_fcfa: e.target.value === "" ? null : Number(e.target.value) },
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void saveSchedule(gameId)}
                className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                Enregistrer
              </button>
            </div>
          );
        })}
        {scheduleMsg && <p className="mt-3 text-xs font-semibold text-primary">{scheduleMsg}</p>}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.ops.title")}</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{t("admin.static.smsDisabled")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Aucun SMS de gain n’est envoyé ou simulé tant qu’un fournisseur SMS réel n’est pas
            configuré.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={p.csvFrom}
            onChange={(e) => p.setCsvFrom(e.target.value)}
            className="rounded-full border border-border bg-background px-2 py-1 text-[11px]"
          />
          <input
            type="date"
            value={p.csvTo}
            onChange={(e) => p.setCsvTo(e.target.value)}
            className="rounded-full border border-border bg-background px-2 py-1 text-[11px]"
          />
          <select
            value={p.csvScope}
            onChange={(e) => p.setCsvScope(e.target.value as "all" | "winners" | "cashout")}
            className="rounded-full border border-border bg-background px-2 py-1 text-[11px]"
          >
            <option value="all">{t("admin.ops.scopeAll")}</option>
            <option value="winners">{t("admin.ops.scopeWinners")}</option>
            <option value="cashout">{t("admin.ops.scopeCashedOut")}</option>
          </select>
          <button
            onClick={() => p.exportCsv()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <Download className="h-3.5 w-3.5" /> {t("exportCsv")}
          </button>
        </div>
      </section>
    </div>
  );
}
