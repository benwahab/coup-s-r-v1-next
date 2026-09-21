import { useState } from "react";
import { adminCreateDrawResult, adminPublishDrawResult } from "@/lib/settlement.functions";

export function ResultsTab() {
  const [gameId, setGameId] = useState<"loto" | "pmu">("loto");
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let result: any;
      if (gameId === "loto") {
        const numbers = values.split(/[,\s]+/).filter(Boolean).map(Number);
        if (
          numbers.length < 1 ||
          numbers.length > 5 ||
          numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 90) ||
          new Set(numbers).size !== numbers.length
        ) {
          throw new Error("Numéros Loto invalides.");
        }
        result = { numbers };
      } else if (gameId === "pmu") {
        const horses = values.split(/[,\s]+/).filter(Boolean).map(Number);
        if (!horses.length || horses.some((n) => !Number.isInteger(n) || n <= 0)) {
          throw new Error("Classement PMU invalide.");
        }
        result = { horses };
      }
      const created: any = await adminCreateDrawResult({
        data: { gameId, drawDate, result } as any,
      });

      const resultIds: string[] = created.resultIds ?? [created.result.id];
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
        `Publié : ${resultIds.length} résultat(s), ${settled} coupon(s) traité(s), ${winners} gagnant(s), ${losers} perdant(s), ${skipped} en attente.`,
      );
      setValues("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-xl font-extrabold">Résultats & règlement automatique</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Chaque résultat Foot publié déclenche immédiatement le recalcul des coupons
        encore en attente. Un seul pronostic perdu suffit à rendre tout le coupon perdant.
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
          gameId === "foot"
            ? 'match-id:1\nmatch-id:X\nou JSON: {"matchId":"match-id","result":"1","homeGoals":2,"awayGoals":1,"halfTimeHomeGoals":1,"halfTimeAwayGoals":0,"yellowCards":4,"corners":8,"scorers":["home_star"]}'
            : gameId === "loto"
              ? "7, 12, 19, 28, 34"
              : "3, 7, 5, 1, 9"
        }
        className="mt-4 w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm"
      />

      {message && <div className="mt-4 rounded-xl border p-3 text-sm">{message}</div>}

      <button
        disabled={busy}
        onClick={publish}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Publication…" : "Publier et régler automatiquement"}
      </button>
    </section>
  );
}
