import { useEffect, useState } from "react";
import { adminCreateDrawResult, adminPublishDrawResult } from "@/lib/settlement.functions";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type DrawResultPayload = { numbers: number[] } | { horses: number[] };

export function ResultsTab() {
  const { t } = useI18n();
  const [gameId, setGameId] = useState<"loto" | "pmu">("loto");
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState("");
  const [raceId, setRaceId] = useState("");
  const [races, setRaces] = useState<{ id: string; raceNumber: number; venue: string; startAt: string }[]>([]);
  const [racesLoading, setRacesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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


  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let result: DrawResultPayload = { numbers: [] };
      if (gameId === "loto") {
        const numbers = values
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(Number);
        if (
          numbers.length < 1 ||
          numbers.length > 5 ||
          numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 90) ||
          new Set(numbers).size !== numbers.length
        ) {
          throw new Error(t("admin.static.invalidLoto"));
        }
        result = { numbers };
      } else if (gameId === "pmu") {
        const horses = values
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(Number);
        if (!horses.length || horses.some((n) => !Number.isInteger(n) || n <= 0)) {
          throw new Error(t("admin.static.invalidPmu"));
        }
        result = { horses };
      }
      if (gameId === "pmu" && !raceId) throw new Error("Aucune course PMU terminée sélectionnée.");
      const created = await adminCreateDrawResult({
        data: gameId === "pmu" ? { gameId, drawDate, raceId, result } : { gameId, drawDate, result },
      });

      const resultIds: string[] = [created.result.id];
      let settled = 0;
      let winners = 0;
      let losers = 0;
      let skipped = 0;

      for (const resultId of resultIds) {
        const out = await adminPublishDrawResult({ data: { resultId } });
        settled += out.settled;
        winners += out.winners;
        losers += out.losers;
        skipped += out.skipped;
      }

      setMessage(
        t("admin.static.published", { results: resultIds.length, settled, winners, losers, skipped }),
      );
      setValues("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("shell.errorTitle"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-xl font-extrabold">{t("admin.static.resultPublishTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Les résultats PMU et Loto sont publiés manuellement par un administrateur. Le règlement des
        coupons est déclenché après publication. Une future intégration API pourra automatiser cette
        étape, sans changer le contrôle serveur.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value as "loto" | "pmu")}
          className="rounded-xl border bg-background px-3 py-2"
        >
          <option value="loto">Loto Balsa</option>
          <option value="pmu">PMU</option>
        </select>
        <select
          value={raceId}
          onChange={(e) => setRaceId(e.target.value)}
          disabled={racesLoading || races.length === 0}
          className="rounded-xl border bg-background px-3 py-2 disabled:opacity-50"
        >
          <option value="">
            {racesLoading ? "Chargement des courses…" : races.length ? "Choisir une course" : "Aucune course terminée"}
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

      <textarea
        value={values}
        onChange={(e) => setValues(e.target.value)}
        rows={8}
        placeholder={
          (gameId as string) === "foot"
            ? 'match-id:1\nmatch-id:X\nou JSON: {"matchId":"match-id","result":"1","homeGoals":2,"awayGoals":1,"halfTimeHomeGoals":1,"halfTimeAwayGoals":0,"yellowCards":4,"corners":8,"scorers":["home_star"]}'
            : gameId === "loto"
              ? "7, 12, 19, 28, 34"
              : "3, 7, 5, 1, 9"
        }
        className="mt-4 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
      />

      {message && <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>}

      <button
        disabled={busy || (gameId === "pmu" && !raceId)}
        onClick={publish}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Publication…" : "Publier et régler automatiquement"}
      </button>
    </section>
  );
}
