import { BellRing, Check, Download, MessageCircle, Send, Settings, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { adminUpdateGameSchedule, getGameSchedules } from "@/lib/game-schedule.functions";
import { cn, formatFcfa } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Ticket } from "@/lib/tickets";
import type { SmsEntry } from "@/lib/sms";

interface Props {
  autoSms: boolean; setAutoSms: (fn: (v: boolean) => boolean) => void;
  csvFrom: string; setCsvFrom: (v: string) => void;
  csvTo: string; setCsvTo: (v: string) => void;
  csvScope: "all" | "winners" | "cashout"; setCsvScope: (v: "all" | "winners" | "cashout") => void;
  exportCsv: (scope?: "all" | "winners" | "cashout") => void;
  cashoutRequests: string[];
  tickets: Ticket[];
  approveCashout: (id: string) => void;
  sentLog: SmsEntry[];
}

export function OpsTab(p: Props) {
  const { t } = useI18n();
  type Schedule = { open_hour: number; close_hour: number; draw_hour: number; draw_minute: number };
  const [schedules, setSchedules] = useState<Record<"pmu" | "loto", Schedule>>({
    pmu: { open_hour: 16, close_hour: 15, draw_hour: 15, draw_minute: 30 },
    loto: { open_hour: 16, close_hour: 15, draw_hour: 15, draw_minute: 30 },
  });
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  useEffect(() => {
    void getGameSchedules().then((rows) => {
      setSchedules((prev) => {
        const next = { ...prev };
        for (const row of rows) if (row.game_id === "pmu" || row.game_id === "loto") next[row.game_id] = {
          open_hour: row.open_hour, close_hour: row.close_hour, draw_hour: row.draw_hour, draw_minute: row.draw_minute,
        };
        return next;
      });
    }).catch(() => setScheduleMsg("Impossible de charger les horaires configurés."));
  }, []);
  const saveSchedule = async (gameId: "pmu" | "loto") => {
    const s = schedules[gameId];
    try {
      await adminUpdateGameSchedule({ data: { gameId, ...s } });
      setScheduleMsg(`${gameId === "pmu" ? "PMU" : "Loto Balsa"} : horaires enregistrés.`);
    } catch (e) {
      setScheduleMsg((e as Error).message || "Échec de l'enregistrement.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">Horaires des jeux</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Les horaires PMU et Loto sont définis manuellement par l'administration. Fuseau : Africa/Niamey.</p>
        {(["pmu", "loto"] as const).map((gameId) => {
          const s = schedules[gameId];
          if (!s) return null;
          const field = (key: "open_hour"|"close_hour"|"draw_hour"|"draw_minute", label: string) => (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
              <input type="number" min={0} max={key === "draw_minute" ? 59 : 23} value={s[key]}
                onChange={(e) => setSchedules((prev) => ({...prev, [gameId]: {...prev[gameId], [key]: Number(e.target.value)}}))}
                className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
            </label>
          );
          return <div key={gameId} className="mt-4 rounded-2xl border border-border p-4">
            <div className="mb-3 font-bold">{gameId === "pmu" ? "PMU" : "Loto Balsa"}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {field("open_hour","Ouverture")}
              {field("close_hour","Clôture")}
              {field("draw_hour","Tirage")}
              {field("draw_minute","Minute du tirage")}
            </div>
            <button type="button" onClick={() => void saveSchedule(gameId)} className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">Enregistrer</button>
          </div>;
        })}
        {scheduleMsg && <p className="mt-3 text-xs font-semibold text-primary">{scheduleMsg}</p>}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold">{t("admin.ops.title")}</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary"><BellRing className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{t("autoSmsTitle")}</span>
                <button type="button" onClick={() => p.setAutoSms((v) => !v)} className={cn("relative h-6 w-11 rounded-full transition", p.autoSms ? "bg-primary" : "bg-muted")} aria-pressed={p.autoSms}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", p.autoSms ? "left-5" : "left-0.5")} />
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t("autoSmsDesc")}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <input type="date" value={p.csvFrom} onChange={(e) => p.setCsvFrom(e.target.value)} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]" />
          <input type="date" value={p.csvTo} onChange={(e) => p.setCsvTo(e.target.value)} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]" />
          <select value={p.csvScope} onChange={(e) => p.setCsvScope(e.target.value as "all" | "winners" | "cashout")} className="rounded-full border border-border bg-background px-2 py-1 text-[11px]">
            <option value="all">{t("admin.ops.scopeAll")}</option>
            <option value="winners">{t("admin.ops.scopeWinners")}</option>
            <option value="cashout">{t("admin.ops.scopeCashedOut")}</option>
          </select>
          <button onClick={() => p.exportCsv()} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40">
            <Download className="h-3.5 w-3.5" /> {t("exportCsv")}
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-gold" />
              <h2 className="font-display text-lg font-bold">{t("cashoutRequests")}</h2>
            </div>
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">{p.cashoutRequests.length}</span>
          </div>
          {p.cashoutRequests.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {p.cashoutRequests.map((id) => {
                const tk = p.tickets.find((x) => x.id === id);
                if (!tk) return null;
                return (
                  <li key={id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold">{tk.id}</div>
                      <div className="truncate text-sm">{tk.phone} • {tk.gameName}</div>
                      <div className="text-xs text-success font-bold">{formatFcfa(tk.prize ?? 0)} FCFA</div>
                    </div>
                    <button onClick={() => p.approveCashout(id)} className="inline-flex items-center gap-1.5 rounded-full bg-gold-gradient px-3 py-1.5 text-xs font-bold text-[var(--gold-foreground)] shadow-gold">
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
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold">{t("sendSms")} — {t("admin.ops.autoLog")}</h2>
            </div>
          </div>
          {p.sentLog.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t("admin.ops.noSmsSent")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {p.sentLog.slice(0, 8).map((s) => (
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
  );
}