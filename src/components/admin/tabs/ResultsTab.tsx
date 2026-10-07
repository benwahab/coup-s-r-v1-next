import { useState } from "react";
import { adminCreateDrawResult, adminPublishDrawResult } from "@/lib/settlement.functions";
import { useI18n } from "@/lib/i18n";

type DrawResultPayload = { numbers: number[] } | { horses: number[] };

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
      const created = await adminCreateDrawResult({
        data: { gameId, drawDate, result },
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
        disabled={busy}
        onClick={publish}
        className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-bold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Publication…" : "Publier et régler automatiquement"}
      </button>
    </section>
  );
}
