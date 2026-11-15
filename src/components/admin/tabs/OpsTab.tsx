import { CalendarClock, Check, Clock3, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { adminUpdateGameSchedule, getGameSchedules } from "@/lib/game-schedule.functions";
import { useI18n } from "@/lib/i18n";

const DAYS = [
  { id: 1, label: "Lundi", short: "Lun." },
  { id: 2, label: "Mardi", short: "Mar." },
  { id: 3, label: "Mercredi", short: "Mer." },
  { id: 4, label: "Jeudi", short: "Jeu." },
  { id: 5, label: "Vendredi", short: "Ven." },
  { id: 6, label: "Samedi", short: "Sam." },
  { id: 0, label: "Dimanche", short: "Dim." },
] as const;

type DaySchedule = {
  day: number;
  open_hour: number;
  open_minute: number;
  close_hour: number;
  close_minute: number;
  draw_hour: number;
  draw_minute: number;
};
type Schedule = {
  open_hour: number;
  close_hour: number;
  draw_hour: number;
  draw_minute: number;
  enabled: boolean;
  daily_stats_date: string;
  today_winners_count: number | null;
  today_paid_fcfa: number | null;
  day_schedules: DaySchedule[];
};
type Game = "pmu" | "loto";
type EditableSchedule = Pick<DaySchedule, "open_hour" | "open_minute" | "close_hour" | "close_minute" | "draw_hour" | "draw_minute">;

const fallback = (s: EditableSchedule): DaySchedule[] =>
  DAYS.map(({ id }) => ({ day: id, open_minute: 0, close_minute: 0, ...s }));

const timeValue = (hour: number, minute = 0) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

export function OpsTab() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<Partial<Record<Game, Schedule>>>({});
  const [selected, setSelected] = useState<Record<Game, number[]>>({ pmu: [1], loto: [1] });
  const [edit, setEdit] = useState<Record<Game, EditableSchedule>>({
    pmu: { open_hour: 8, open_minute: 0, close_hour: 14, close_minute: 0, draw_hour: 15, draw_minute: 0 },
    loto: { open_hour: 8, open_minute: 0, close_hour: 14, close_minute: 0, draw_hour: 15, draw_minute: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Game | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getGameSchedules()
      .then((rows) => {
        for (const row of rows) {
          if (row.game_id !== "pmu" && row.game_id !== "loto") continue;
          const game = row.game_id as Game;
          const legacy = {
            open_hour: row.open_hour,
            close_hour: row.close_hour,
            draw_hour: row.draw_hour,
            draw_minute: row.draw_minute,
          };
          const daySchedules =
            Array.isArray(row.day_schedules) && row.day_schedules.length === 7
              ? (row.day_schedules as unknown as DaySchedule[])
              : fallback(legacy);
          const monday = daySchedules.find((day) => day.day === 1) ?? daySchedules[0];
          setSchedules((prev) => ({
            ...prev,
            [game]: {
              ...legacy,
              enabled: true,
              daily_stats_date: row.daily_stats_date,
              today_winners_count: row.today_winners_count,
              today_paid_fcfa: row.today_paid_fcfa,
              day_schedules: daySchedules,
            },
          }));
          if (monday) {
            setEdit((prev) => ({
              ...prev,
              [game]: {
                open_hour: monday.open_hour,
                open_minute: monday.open_minute ?? 0,
                close_hour: monday.close_hour,
                close_minute: monday.close_minute ?? 0,
                draw_hour: monday.draw_hour,
                draw_minute: monday.draw_minute,
              },
            }));
          }
        }
      })
      .catch(() => setMessage(t("admin.static.scheduleLoadError")))
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (game: Game, day: number) => {
    const currentSelection = selected[game];
    const exists = currentSelection.includes(day);
    if (!exists && currentSelection.length === 0) {
      const current = schedules[game]?.day_schedules.find((item) => item.day === day);
      if (current) {
        setEdit((values) => ({
          ...values,
          [game]: {
            open_hour: current.open_hour,
            open_minute: current.open_minute ?? 0,
            close_hour: current.close_hour,
            close_minute: current.close_minute ?? 0,
            draw_hour: current.draw_hour,
            draw_minute: current.draw_minute,
          },
        }));
      }
    }
    setSelected((prev) => ({
      ...prev,
      [game]: exists ? currentSelection.filter((value) => value !== day) : [...currentSelection, day],
    }));
  };

  const updateTime = (game: Game, field: "open" | "close" | "draw", value: string) => {
    const [hourText, minuteText = "0"] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    setEdit((prev) => ({
      ...prev,
      [game]: {
        ...prev[game],
        ...(field === "open" ? { open_hour: hour, open_minute: minute } : {}),
        ...(field === "close" ? { close_hour: hour, close_minute: minute } : {}),
        ...(field === "draw" ? { draw_hour: hour, draw_minute: minute } : {}),
      },
    }));
  };

  const save = async (game: Game) => {
    const current = schedules[game];
    if (!current || selected[game].length === 0) return;
    const value = edit[game];
    const openMinutes = value.open_hour * 60 + value.open_minute;
    const closeMinutes = value.close_hour * 60 + value.close_minute;
    if (openMinutes === closeMinutes) {
      setMessage("L’ouverture et la clôture des mises doivent être différentes.");
      return;
    }
    if (value.draw_hour * 60 + value.draw_minute < closeMinutes) {
      setMessage("La course ou le tirage ne peut pas commencer avant la clôture des mises.");
      return;
    }
    const daySchedules = current.day_schedules.map((day) =>
      selected[game].includes(day.day) ? { ...day, ...value } : day,
    );
    setSaving(game);
    setMessage(null);
    try {
      const date = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Niamey" });
      await adminUpdateGameSchedule({
        data: {
          gameId: game,
          ...value,
          enabled: true,
          dailyStatsDate: date,
          todayWinnersCount: current.today_winners_count,
          todayPaidFcfa: current.today_paid_fcfa,
          daySchedules,
        },
      });
      setSchedules((prev) => ({
        ...prev,
        [game]: { ...current, ...value, day_schedules: daySchedules },
      }));
      setMessage(`Horaires ${game === "pmu" ? "PMU" : "Loto Balsa"} enregistrés.`);
    } catch (error) {
      setMessage((error as Error).message || "Échec de l’enregistrement.");
    } finally {
      setSaving(null);
    }
  };

  const gameCard = (game: Game) => {
    const schedule = schedules[game];
    const selectedDays = selected[game];
    const title = game === "pmu" ? "PMU" : "Loto Balsa";
    const drawLabel = game === "pmu" ? "Départ de la course" : "Heure du tirage";
    const value = edit[game];

    return (
      <section key={game} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">{title}</h3>
              <p className="text-xs text-muted-foreground">Programmation hebdomadaire</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            7 jours / 7
          </span>
        </div>

        {!schedule ? (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            {loading ? "Chargement des horaires…" : t("admin.static.noSchedule", { game: title })}
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Quels jours souhaitez-vous modifier ?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Vous pouvez en choisir un ou plusieurs.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected((prev) => ({ ...prev, [game]: DAYS.map((day) => day.id) }))}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  Toute la semaine
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map((day) => {
                  const active = selectedDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(game, day.id)}
                      className={`flex min-h-10 items-center justify-center rounded-xl border px-2 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
                    >
                      {day.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Horaires à appliquer</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedDays.length === 0
                      ? "Sélectionnez au moins un jour."
                      : `Ces horaires seront appliqués à ${selectedDays.length === 7 ? "tous les jours" : selectedDays.length + (selectedDays.length > 1 ? " jours" : " jour")} sélectionné(s).`}
                  </p>
                </div>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Ouverture des mises</span>
                  <input
                    type="time"
                    step={60}
                    value={timeValue(value.open_hour, value.open_minute)}
                    onChange={(event) => updateTime(game, "open", event.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Clôture des mises</span>
                  <input
                    type="time"
                    step={60}
                    value={timeValue(value.close_hour, value.close_minute)}
                    onChange={(event) => updateTime(game, "close", event.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{drawLabel}</span>
                  <input
                    type="time"
                    step={60}
                    value={timeValue(value.draw_hour, value.draw_minute)}
                    onChange={(event) => updateTime(game, "draw", event.target.value)}
                    className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Fuseau horaire : <span className="font-semibold text-foreground">Niamey (GMT+1)</span></p>
                <button
                  type="button"
                  disabled={!selectedDays.length || saving !== null}
                  onClick={() => void save(game)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving === game ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer les horaires
                </button>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Vue de la semaine</p>
                <span className="text-[11px] text-muted-foreground">Horaires actuellement actifs</span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
                {DAYS.map((day) => {
                  const current = schedule.day_schedules.find((item) => item.day === day.id);
                  const active = selectedDays.includes(day.id);
                  return (
                    <div key={day.id} className={`flex items-center justify-between gap-3 px-3 py-3 sm:px-4 ${active ? "bg-primary/5" : "bg-background"}`}>
                      <div className="flex min-w-0 items-center gap-2">
                        {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
                        <span className="text-sm font-medium">{day.label}</span>
                      </div>
                      {current ? (
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground">
                          <span>{timeValue(current.open_hour, current.open_minute ?? 0)} – {timeValue(current.close_hour, current.close_minute ?? 0)}</span>
                          <span className="font-semibold text-foreground">{timeValue(current.draw_hour, current.draw_minute)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non configuré</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Le premier horaire correspond à l’ouverture et à la clôture des mises ; le second indique la course ou le tirage.</p>
            </div>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
        <p className="text-sm font-semibold">Horaires des jeux</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Configurez chaque jeu séparément. Sélectionnez les jours, réglez les heures, puis enregistrez : les changements sont appliqués à toute la plateforme sans mise à jour de l’application.
        </p>
      </div>
      {gameCard("pmu")}
      {gameCard("loto")}
      {message && (
        <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
