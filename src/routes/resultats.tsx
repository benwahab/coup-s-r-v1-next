import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { coldNumbers, footMatches, hotNumbers, recentResults } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/resultats")({
  head: () => ({
    meta: [
      { title: "Résultats — LoNaNi" },
      { name: "description", content: "Résultats officiels du PMU, Loto Balsa et Pari Foot de la Loterie Nationale du Niger." },
      { property: "og:title", content: "Résultats officiels — LoNaNi" },
      { property: "og:description", content: "Numéros gagnants, arrivées PMU et résultats foot." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { t } = useI18n();
  const loto = recentResults.filter((r) => r.gameId === "loto");
  const pmu = recentResults.filter((r) => r.gameId === "pmu");
  const foot = recentResults.filter((r) => r.gameId === "foot");

  return (
    <>
      <PageHeader title={t("results")} icon={<Trophy className="h-5 w-5" />} subtitle={t("weekResults")} />
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 lg:grid-cols-2">
        <Section title="Loto Balsa">
          <ul className="space-y-3">
            {loto.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatDate(r.date)}</span>
                  <span className="font-mono">{r.id}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.numbers!.map((n) => <span key={n} className="number-ball">{n}</span>)}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="PMU — Arrivées">
          <ul className="space-y-3">
            {pmu.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="mb-2 text-xs text-muted-foreground tabular-nums">{formatDate(r.date)}</div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.horses!.map((h, i) => (
                    <span key={h} className="inline-flex items-center gap-1.5">
                      <span className="text-xs font-bold text-muted-foreground">{i + 1}.</span>
                      <span className="number-ball number-ball-sm">{h}</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Pari Foot">
          <ul className="space-y-3">
            {foot.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="mb-2 text-xs text-muted-foreground tabular-nums">{formatDate(r.date)}</div>
                <ul className="space-y-1.5 text-sm">
                  {r.matches!.map((m) => {
                    const match = footMatches.find((x) => x.id === m.matchId);
                    return (
                      <li key={m.matchId} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                        <span className="min-w-0 truncate">{match ? `${match.home} – ${match.away}` : m.matchId}</span>
                        <span className="font-display font-bold text-primary">{m.result}</span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Statistiques">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("hotNumbers")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {hotNumbers.map((n) => <span key={n} className="number-ball">{n}</span>)}
            </div>
            <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("coldNumbers")}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {coldNumbers.map((n) => <span key={n} className="number-ball-empty">{n}</span>)}
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}