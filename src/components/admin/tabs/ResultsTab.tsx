import { useEffect, useState } from "react";
import {
  adminCreateDrawResult,
  adminListPendingDrawResults,
  adminApproveDrawResult,
  adminRejectDrawResult,
} from "@/lib/settlement.functions";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type DrawResultPayload = { numbers: number[] } | { horses: number[] };

export function ResultsTab() {
  const { t } = useI18n();
  const [gameId, setGameId] = useState<"loto" | "pmu">("loto");
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
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

  const refreshPendingResults = async () => {
    try {
      const response = await adminListPendingDrawResults();
      setIsSuperAdmin(true);
      setPendingResults(response.results as typeof pendingResults);
    } catch {
      setIsSuperAdmin(false);
      setPendingResults([]);
    }
  };

  useEffect(() => {
    void refreshPendingResults();
  }, []);

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
          setRaceId((current) => (next.some((r) => r.id === current) ? current : next[0]?.id ?? ""));
        }
        setRacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, drawDate]);

  const updateResultValue = (index: number, value: string) => {
    setResultValues((current) => current.map((item, i) => (i === index ? value : item)));
  };

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const enteredValues = resultValues.map((value) => value.trim()).filter(Boolean);
      if (enteredValues.length === 0) {
        throw new Error(gameId === "loto" ? t("admin.static.invalidLoto") : t("admin.static.invalidPmu"));
      }

      const parsedValues = enteredValues.map(Number);
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
        if (parsedValues.length > 20 || new Set(parsedValues).size !== parsedValues.length) {
          throw new Error(t("admin.static.invalidPmu"));
        }
        result = { horses: parsedValues };
      }

      if (gameId === "pmu" && !raceId) throw new Error("Aucune course PMU terminée sélectionnée.");
      const created = await adminCreateDrawResult({
        data: gameId === "pmu" ? { gameId, drawDate, raceId, result } : { gameId, drawDate, result },
      });

      setMessage(
        created.publication
          ? `Résultat publié directement. Coupons réglés : ${created.publication.settled}.`
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
        <select
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          disabled={gameId !== "pmu" || racesLoading || races.length === 0}
          className="rounded-xl border bg-background px-3 py-2 disabled:opacity-50"
        >
          <option value="">
            {gameId !== "pmu"
              ? "Sélectionnez une course uniquement pour le PMU"
              : racesLoading
                ? "Chargement des courses…"
                : races.length
                  ? "Choisir une course"
                  : "Aucune course terminée"}
          </option>
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              R{race.raceNumber} · {race.venue} · {new Date(race.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={drawDate}
          onChange={(e) => setDrawDate(e.target.value)}
          className="rounded-xl border bg-background px-3 py-2"
        />
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
        {gameId === "pmu" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setResultValues((current) => current.length < 20 ? [...current, ""] : current)}
              disabled={busy || resultValues.length >= 20}
              className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              + Ajouter une place
            </button>
            {resultValues.length > 1 && (
              <button
                type="button"
                onClick={() => setResultValues((current) => current.slice(0, -1))}
                disabled={busy}
                className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Retirer la dernière case
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {gameId === "loto"
            ? "Renseignez les numéros communiqués officiellement. Les cases vides sont ignorées."
            : "Saisissez les numéros des chevaux dans leur ordre officiel d'arrivée. Ajoutez des cases si nécessaire."}
        </p>
      </div>

      {message && <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>}

      <button
        disabled={busy || (gameId === "pmu" && !raceId)}
        onClick={publish}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Publication…" : "Publier le résultat"}
      </button>

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
                        setMessage(`Résultat approuvé et publié. Coupons réglés : ${out.settled}.`);
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
