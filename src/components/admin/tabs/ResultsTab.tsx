import { useEffect, useState } from "react";
import {
  adminCreateDrawResult,
  adminListPendingDrawResults,
  adminApproveDrawResult,
  adminRejectDrawResult,
  adminListDrawResultsNeedingSettlement,
  adminRetryDrawSettlement,
  getResultPublicationState,
} from "@/lib/settlement.functions";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type DrawResultPayload = { numbers: number[] } | { horses: number[] };

export function ResultsTab() {
  const { t } = useI18n();
  const [gameId, setGameId] = useState<"loto" | "pmu">("loto");
  const [drawDate, setDrawDate] = useState("");
  const [canPublish, setCanPublish] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleMessage, setScheduleMessage] = useState("Vérification des horaires du jeu…");
  const [resultValues, setResultValues] = useState<string[]>(["", "", "", "", ""]);
  const [raceId, setRaceId] = useState("");
  const [races, setRaces] = useState<{ id: string; raceNumber: number; venue: string; startAt: string }[]>([]);
  const [racesLoading, setRacesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pendingResults, setPendingResults] = useState<
    { id: string; game_id: string; draw_date: string; draw_name: string | null; result: unknown }[]
  >([]);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [settlementRetries, setSettlementRetries] = useState<
    { id: string; game_id: string; draw_date: string; draw_name: string | null; pendingTickets: number }[]
  >([]);

  const refreshSettlementRetries = async () => {
    try {
      const response = await adminListDrawResultsNeedingSettlement();
      setSettlementRetries(response.results);
    } catch {
      setSettlementRetries([]);
    }
  };

  const refreshPendingResults = async () => {
    try {
      const response = await adminListPendingDrawResults();
      setIsSuperAdmin(true);
      setPendingResults(response.results as typeof pendingResults);
      await refreshSettlementRetries();
    } catch {
      setIsSuperAdmin(false);
      setPendingResults([]);
      setSettlementRetries([]);
    }
  };

  useEffect(() => {
    void refreshPendingResults();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshPublicationState = async () => {
      setScheduleLoading(true);
      try {
        const state = await getResultPublicationState({ data: { gameId } });
        if (cancelled) return;
        setDrawDate(state.drawDate);
        setCanPublish(state.canPublish);
        setScheduleMessage(
          state.canPublish
            ? "Jeu clôturé : la publication des résultats est ouverte."
            : !state.gameEnabled
              ? "Jeu désactivé : aucune publication possible."
              : "Jeu ouvert : la publication des résultats est bloquée jusqu'à la clôture."
        );
      } catch {
        if (cancelled) return;
        setCanPublish(false);
        setScheduleMessage("Impossible de vérifier les horaires. Publication bloquée par sécurité.");
      } finally {
        if (!cancelled) setScheduleLoading(false);
      }
    };
    void refreshPublicationState();
    const interval = window.setInterval(() => void refreshPublicationState(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [gameId]);

  useEffect(() => {
    if (gameId !== "pmu") {
      setRaces([]);
      setRaceId("");
      return;
    }
    let cancelled = false;
    setRacesLoading(true);
    void supabase
      .from("pmu_races")
      .select("id,race_number,venue,start_at,status")
      .eq("race_date", drawDate)
      .eq("status", "finished")
      .order("start_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setRaces([]);
          setRaceId("");
        } else {
          const next = (data ?? []).map((r) => ({
            id: r.id,
            raceNumber: r.race_number,
            venue: r.venue,
            startAt: r.start_at,
          }));
          setRaces(next);
          // Le PMU Coup Sûr fonctionne avec une seule course par tirage :
          // la course terminée du jour est associée automatiquement au résultat.
          setRaceId(next.length === 1 ? next[0].id : "");
        }
        setRacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, drawDate]);

  const updateResultValue = (index: number, value: string) => {
    if (gameId === "loto" && value.trim() !== "") {
      const duplicate = resultValues.some((item, i) => i !== index && item.trim() === value.trim());
      if (duplicate) {
        setMessage("Ce numéro est déjà saisi. Chaque numéro du Loto doit être différent.");
        return;
      }
    }
    setMessage(null);
    setResultValues((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const enteredValues = resultValues.map((value) => value.trim()).filter(Boolean);
      if (gameId === "pmu" && (resultValues.length !== 5 || resultValues.some((value) => !value.trim()))) {
        throw new Error("Les cinq places PMU doivent être renseignées.");
      }
      if (gameId === "loto" && enteredValues.length === 0) {
        throw new Error(t("admin.static.invalidLoto"));
      }

      const parsedValues = (gameId === "pmu" ? resultValues : enteredValues).map((value) => Number(value.trim()));
      if (parsedValues.some((n) => !Number.isInteger(n) || n <= 0)) {
        throw new Error(gameId === "loto" ? t("admin.static.invalidLoto") : t("admin.static.invalidPmu"));
      }

      let result: DrawResultPayload;
      if (gameId === "loto") {
        if (
          parsedValues.length > 5 ||
          parsedValues.some((n) => n > 90) ||
          new Set(parsedValues).size !== parsedValues.length
        ) {
          throw new Error(t("admin.static.invalidLoto"));
        }
        result = { numbers: parsedValues };
      } else {
        if (parsedValues.length !== 5 || new Set(parsedValues).size !== 5) {
          throw new Error("Le résultat PMU doit contenir exactement cinq chevaux différents.");
        }
        result = { horses: parsedValues };
      }

      if (gameId === "pmu" && !raceId) {
        throw new Error(races.length > 1
          ? "Plusieurs courses PMU terminées existent pour cette date. Le tirage doit être associé à une seule course."
          : "Aucune course PMU terminée trouvée pour cette date.");
      }
      const created = await adminCreateDrawResult({
        data: gameId === "pmu" ? { gameId, drawDate, raceId, result } : { gameId, drawDate, result },
      });

      setMessage(
        created.publication
          ? created.publication.failed > 0 || created.publication.skipped > 0
            ? `Résultat publié directement. ${created.publication.settled} coupon(s) réglé(s), ${created.publication.skipped} ignoré(s), ${created.publication.failed} erreur(s). Consultez « Règlements à reprendre » pour relancer les coupons encore en attente.`
            : `Résultat publié directement. Coupons réglés : ${created.publication.settled}.`
          : "Résultat soumis avec succès. En attente de l'approbation du Super Administrateur.",
      );
      setResultValues(["", "", "", "", ""]);
      await refreshPendingResults();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("shell.errorTitle"));
    } finally {
      setBusy(false);
    }
  };

  const boxClassName =
    "h-14 w-14 rounded-xl border-2 border-border bg-background text-center text-xl font-extrabold tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-xl font-extrabold">Résultats du jour</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les résultats officiels sont communiqués par la LONANI. Saisissez ici les informations reçues, puis publiez-les pour les joueurs. Le règlement des coupons se déclenche automatiquement après publication.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <select
          value={gameId}
          onChange={(e) => {
            const nextGame = e.target.value as "loto" | "pmu";
            setGameId(nextGame);
            setResultValues(["", "", "", "", ""]);
            setMessage(null);
          }}
          className="rounded-xl border bg-background px-3 py-2"
        >
          <option value="loto">Loto Balsa</option>
          <option value="pmu">PMU</option>
        </select>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Date du résultat (automatique)</span>
          <input
            type="date"
            value={drawDate}
            readOnly
            disabled
            className="w-full rounded-xl border bg-muted px-3 py-2 opacity-80"
          />
        </label>
      </div>

      <div className={`mt-3 rounded-xl border p-3 text-sm ${canPublish ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/5"}`} role="status">
        {scheduleLoading ? "Vérification du calendrier…" : scheduleMessage}
      </div>

      <div className="mt-5">
        <p className="mb-3 text-sm font-semibold">
          {gameId === "loto" ? "Numéros gagnants (une case par numéro)" : "Ordre d'arrivée des chevaux (une case par numéro)"}
        </p>
        <div className="flex flex-wrap gap-3">
          {resultValues.map((value, index) => (
            <label key={index} className="flex flex-col items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {gameId === "loto" ? `Numéro ${index + 1}` : `Place ${index + 1}`}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={gameId === "loto" ? 90 : undefined}
                value={value}
                onChange={(e) => updateResultValue(index, e.target.value)}
                aria-label={gameId === "loto" ? `Numéro gagnant ${index + 1}` : `Cheval classé ${index + 1}`}
                className={boxClassName}
                disabled={busy}
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {gameId === "loto"
            ? "Renseignez les numéros communiqués officiellement. Les cases vides sont ignorées."
            : "Renseignez les cinq chevaux dans leur ordre officiel d'arrivée. Les cinq places sont fixes et obligatoires."}
        </p>
      </div>

      {message && <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>}

      <button
        disabled={busy || scheduleLoading || !canPublish || (gameId === "pmu" && !raceId)}
        onClick={publish}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Publication…" : "Publier le résultat"}
      </button>

      {isSuperAdmin && settlementRetries.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-base font-bold">Règlements à reprendre</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces résultats sont déjà publiés. Les coupons encore en attente peuvent être réglés à nouveau sans republier le résultat ; les coupons déjà réglés ne seront pas modifiés.
          </p>
          <div className="mt-3 space-y-3">
            {settlementRetries.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-3">
                <div className="text-sm font-semibold">
                  {item.game_id === "pmu" ? "PMU" : "Loto Balsa"} · {item.draw_date}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.pendingTickets} coupon(s) encore en attente
                </p>
                <button
                  type="button"
                  disabled={reviewBusy !== null}
                  onClick={async () => {
                    setReviewBusy(item.id);
                    try {
                      const out = await adminRetryDrawSettlement({ data: { resultId: item.id } });
                      setMessage(
                        `Reprise terminée : ${out.settled} réglé(s), ${out.skipped} ignoré(s), ${out.failed} erreur(s).`,
                      );
                      await refreshPendingResults();
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : t("shell.errorTitle"));
                    } finally {
                      setReviewBusy(null);
                    }
                  }}
                  className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {reviewBusy === item.id ? "Reprise…" : "Reprendre le règlement"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSuperAdmin && pendingResults.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-base font-bold">Résultats en attente d'approbation</h3>
          <div className="mt-3 space-y-3">
            {pendingResults.map((pending) => (
              <div key={pending.id} className="rounded-xl border border-border p-3">
                <div className="text-sm font-semibold">
                  {pending.game_id === "pmu" ? "PMU" : "Loto Balsa"} · {pending.draw_date}
                </div>
                <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  {JSON.stringify(pending.result, null, 2)}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={reviewBusy !== null}
                    onClick={async () => {
                      setReviewBusy(pending.id);
                      try {
                        const out = await adminApproveDrawResult({ data: { resultId: pending.id } });
                        setMessage(
                          out.failed > 0 || out.skipped > 0
                            ? `Résultat publié. ${out.settled} coupon(s) réglé(s), ${out.skipped} ignoré(s), ${out.failed} erreur(s). Consultez « Règlements à reprendre » pour relancer les coupons encore en attente.`
                            : `Résultat approuvé et publié. Coupons réglés : ${out.settled}.`,
                        );
                        await refreshPendingResults();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : t("shell.errorTitle"));
                      } finally {
                        setReviewBusy(null);
                      }
                    }}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {reviewBusy === pending.id ? "Traitement…" : "Approuver"}
                  </button>
                  <button
                    type="button"
                    disabled={reviewBusy !== null}
                    onClick={async () => {
                      setReviewBusy(pending.id);
                      try {
                        await adminRejectDrawResult({ data: { resultId: pending.id } });
                        setMessage("Résultat rejeté. L'administrateur pourra le corriger et le soumettre à nouveau.");
                        await refreshPendingResults();
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : t("shell.errorTitle"));
                      } finally {
                        setReviewBusy(null);
                      }
                    }}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
