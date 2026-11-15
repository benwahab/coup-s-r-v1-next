import { CalendarClock, Check, ChevronDown, ChevronUp, Clock3, Loader2, Save, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { adminUpdateGameSchedule, getGameSchedules, publishGameSchedules } from "@/lib/game-schedule.functions";
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
  active_day_schedules: DaySchedule[];
};
type Game = "pmu" | "loto";
type EditableSchedule = Pick<DaySchedule, "open_hour" | "open_minute" | "close_hour" | "close_minute" | "draw_hour" | "draw_minute">;

const fallback = (s: Pick<DaySchedule, "open_hour" | "close_hour" | "draw_hour" | "draw_minute">): DaySchedule[] =>
  DAYS.map(({ id }) => ({ day: id, open_minute: 0, close_minute: 0, ...s }));

const timeValue = (hour: number, minute = 0) =>
  `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const sameSchedule = (a: DaySchedule[], b: DaySchedule[]) => JSON.stringify(a) === JSON.stringify(b);

export function OpsTab() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState<Partial<Record<Game, Schedule>>>({});
  const [selected, setSelected] = useState<Record<Game, number[]>>({ pmu: [1], loto: [1] });
  const [expanded, setExpanded] = useState<Record<Game, boolean>>({ pmu: false, loto: false });
  const [edit, setEdit] = useState<Record<Game, EditableSchedule>>({
    pmu: { open_hour: 8, open_minute: 0, close_hour: 14, close_minute: 0, draw_hour: 15, draw_minute: 0 },
    loto: { open_hour: 8, open_minute: 0, close_hour: 14, close_minute: 0, draw_hour: 15, draw_minute: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Game | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSchedules = async () => {
    const rows = await getGameSchedules();
    const next: Partial<Record<Game, Schedule>> = {};
    const nextEdit: Partial<Record<Game, EditableSchedule>> = {};
    for (const row of rows) {
      if (row.game_id !== "pmu" && row.game_id !== "loto") continue;
      const game = row.game_id as Game;
      const legacy = {
        open_hour: row.open_hour,
        close_hour: row.close_hour,
        draw_hour: row.draw_hour,
        draw_minute: row.draw_minute,
      };
      const active = Array.isArray(row.day_schedules) && row.day_schedules.length === 7
        ? row.day_schedules as unknown as DaySchedule[]
        : fallback(legacy);
      const draft = Array.isArray(row.draft_day_schedules) && row.draft_day_schedules.length === 7
        ? row.draft_day_schedules as unknown as DaySchedule[]
        : active;
      next[game] = {
        ...legacy,
        enabled: row.enabled,
        daily_stats_date: row.daily_stats_date,
        today_winners_count: row.today_winners_count,
        today_paid_fcfa: row.today_paid_fcfa,
        day_schedules: draft,
        active_day_schedules: active,
      };
      const monday = draft.find((day) => day.day === 1) ?? draft[0];
      if (monday) nextEdit[game] = {
        open_hour: monday.open_hour,
        open_minute: monday.open_minute ?? 0,
        close_hour: monday.close_hour,
        close_minute: monday.close_minute ?? 0,
        draw_hour: monday.draw_hour,
        draw_minute: monday.draw_minute,
      };
    }
    setSchedules(next);
    setEdit((previous) => ({ ...previous, ...nextEdit }));
  };

  useEffect(() => {
    void loadSchedules()
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

  const validateDays = (days: DaySchedule[]) => {
    for (const day of days) {
      const opening = day.open_hour * 60 + (day.open_minute ?? 0);
      const closing = day.close_hour * 60 + (day.close_minute ?? 0);
      const draw = day.draw_hour * 60 + day.draw_minute;
      if (opening === closing) return "L’ouverture et la clôture des mises doivent être différentes.";
      if (draw < closing) return "La course ou le tirage ne peut pas commencer avant la clôture des mises.";
    }
    return null;
  };

  const save = async (game: Game) => {
    const current = schedules[game];
    if (!current || selected[game].length === 0) return;
    const value = edit[game];
    const daySchedules = current.day_schedules.map((day) =>
      selected[game].includes(day.day) ? { ...day, ...value } : day,
    );
    const validation = validateDays(daySchedules.filter((day) => selected[game].includes(day.day)));
    if (validation) {
      setMessage(validation);
      return;
    }
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
        [game]: { ...current, day_schedules: daySchedules },
      }));
      setMessage(`Horaires ${game === "pmu" ? "PMU" : "Loto Balsa"} enregistrés en brouillon. Ils ne sont pas encore publiés.`);
    } catch (error) {
      setMessage((error as Error).message || "Échec de l’enregistrement.");
    } finally {
      setSaving(null);
    }
  };

  const hasPendingDrafts = (["pmu", "loto"] as const).some((game) => {
    const value = schedules[game];
    return value && !sameSchedule(value.day_schedules, value.active_day_schedules);
  });
  const canPublish = Boolean(schedules.pmu && schedules.loto && hasPendingDrafts);

  const publish = async () => {
    const missing = (["pmu", "loto"] as const).find((game) => {
      const value = schedules[game];
      return !value || value.day_schedules.length !== 7 || validateDays(value.day_schedules);
    });
    if (missing) {
      setMessage(`Vérifiez les sept jours du ${missing === "pmu" ? "PMU" : "Loto Balsa"} avant la publication.`);
      return;
    }
    setPublishing(true);
    setMessage(null);
    try {
      await publishGameSchedules();
      await loadSchedules();
      setMessage("Les horaires du PMU et du Loto Balsa sont maintenant publiés sur toute la plateforme.");
    } catch (error) {
      setMessage((error as Error).message || "Échec de la publication des horaires.");
    } finally {
      setPublishing(false);
    }
  };

  const gameCard = (game: Game) => {
    const schedule = schedules[game];
    const selectedDays = selected[game];
    const title = game === "pmu" ? "PMU" : "Loto Balsa";
    const drawLabel = game === "pmu" ? "Heure de la course" : "Heure du tirage";
    const value = edit[game];
    const hasDraft = Boolean(schedule && !sameSchedule(schedule.day_schedules, schedule.active_day_schedules));

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
          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${hasDraft ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
            {hasDraft ? "Brouillon à publier" : "Horaires publiés"}
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
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Clôture des mises</span>
                  <input type="time" step={60} value={timeValue(value.close_hour, value.close_minute)} onChange={(event) => updateTime(game, "close", event.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{drawLabel}</span>
                  <input type="time" step={60} value={timeValue(value.draw_hour, value.draw_minute)} onChange={(event) => updateTime(game, "draw", event.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Ouverture des mises</span>
                  <input type="time" step={60} value={timeValue(value.open_hour, value.open_minute)} onChange={(event) => updateTime(game, "open", event.target.value)} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base font-semibold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
                </label>
              </div>
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">Fuseau horaire : <span className="font-semibold text-foreground">Niamey (GMT+1)</span></p>
                <button type="button" disabled={!selectedDays.length || saving !== null || publishing} onClick={() => void save(game)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving === game ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer le brouillon
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                aria-expanded={expanded[game]}
                onClick={() => setExpanded((prev) => ({ ...prev, [game]: !prev[game] }))}
                className="flex min-h-12 w-full items-center justify-between gap-3 bg-muted/20 px-4 py-3 text-left transition hover:bg-muted/40"
              >
                <span>
                  <span className="block text-sm font-semibold">Vue de la semaine</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">Horaires préparés pour les sept jours</span>
                </span>
                <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                  {expanded[game] ? "Réduire" : "Dérouler"}
                  {expanded[game] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {expanded[game] && (
                <div className="divide-y divide-border">
                  {DAYS.map((day) => {
                    const current = schedule.day_schedules.find((item) => item.day === day.id);
                    const active = selectedDays.includes(day.id);
                    return (
                      <div key={day.id} className={`flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 ${active ? "bg-primary/5" : "bg-background"}`}>
                        <div className="flex min-w-0 items-center gap-2">
                          {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
                          <span className="text-sm font-medium">{day.label}</span>
                        </div>
                        {current ? (
                          <div className="grid grid-cols-3 gap-2 text-center text-[11px] tabular-nums sm:min-w-[290px]">
                            <span><span className="block text-muted-foreground">Clôture</span><strong className="text-foreground">{timeValue(current.close_hour, current.close_minute ?? 0)}</strong></span>
                            <span><span className="block text-muted-foreground">{drawLabel}</span><strong className="text-foreground">{timeValue(current.draw_hour, current.draw_minute)}</strong></span>
                            <span><span className="block text-muted-foreground">Ouverture</span><strong className="text-foreground">{timeValue(current.open_hour, current.open_minute ?? 0)}</strong></span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Non configuré</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
          Enregistrez séparément les brouillons du PMU et du Loto Balsa. Les horaires en vigueur ne changent qu’après la publication commune.
        </p>
      </div>
      {gameCard("pmu")}
      {gameCard("loto")}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Publication des horaires</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Publie en une seule opération les horaires préparés du PMU et du Loto Balsa sur toute la plateforme.
            </p>
          </div>
          <button type="button" disabled={!canPublish || publishing || saving !== null} onClick={() => void publish()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publier les horaires
          </button>
        </div>
        {!canPublish && <p className="mt-2 text-[11px] text-muted-foreground">Enregistrez au moins un changement ; les deux jeux doivent disposer de sept jours configurés.</p>}
      </div>
      {message && (
        <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
