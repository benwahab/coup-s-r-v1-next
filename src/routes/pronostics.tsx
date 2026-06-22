import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/AppShell";
import { coldNumbers, expertTips, footMatches, hotNumbers, horses, lotoSuggestions } from "@/lib/mock-data";

export const Route = createFileRoute("/pronostics")({
  head: () => ({
    meta: [
      { title: "Pronostics — LoNaNi" },
      { name: "description", content: "Pronostics PMU, Loto Balsa et Pari Foot par les experts de la Loterie Nationale du Niger." },
      { property: "og:title", content: "Pronostics — LoNaNi" },
      { property: "og:description", content: "Conseils, tendances et suggestions pour mieux jouer." },
    ],
  }),
  component: Pronos,
});

function Pronos() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("predictions")} icon={<Sparkles className="h-5 w-5" />} subtitle="Tendances, conseils & suggestions" />

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 lg:grid-cols-3">
        {/* PMU */}
        <Card title="PMU" linkTo="/pmu" linkLabel="Parier PMU">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("favorites")}</div>
          <ul className="mt-2 space-y-2">
            {horses.slice(0, 4).map((h) => (
              <li key={h.number} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2">
                <span className="number-ball number-ball-sm">{h.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{h.name}</span>
                <span className="text-xs text-muted-foreground">{h.jockey}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Loto */}
        <Card title="Loto Balsa" linkTo="/loto-balsa" linkLabel="Jouer Loto">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("hotNumbers")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {hotNumbers.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}
          </div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("coldNumbers")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {coldNumbers.map((n) => <span key={n} className="number-ball-empty">{n}</span>)}
          </div>
          <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("suggestions")}</div>
          <ul className="mt-2 space-y-2">
            {lotoSuggestions.map((s, i) => (
              <li key={i} className="flex flex-wrap gap-1.5 rounded-xl bg-secondary/50 px-3 py-2">
                {s.map((n) => <span key={n} className="number-ball number-ball-sm">{n}</span>)}
              </li>
            ))}
          </ul>
        </Card>

        {/* Foot */}
        <Card title="Pari Foot" linkTo="/pari-foot" linkLabel="Parier Foot">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("analyses")}</div>
          <ul className="mt-2 space-y-2">
            {footMatches.slice(0, 4).map((m) => {
              const best = (Object.entries(m.odds) as ["1" | "X" | "2", number][]).sort((a, b) => a[1] - b[1])[0];
              return (
                <li key={m.id} className="rounded-xl bg-secondary/50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{m.home} – {m.away}</span>
                    <span className="font-display text-base font-bold text-primary">{best[0]}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Pronostic favori @ {best[1].toFixed(2)}</div>
                </li>
              );
            })}
          </ul>
        </Card>

        <section className="lg:col-span-3">
          <h2 className="mb-3 font-display text-lg font-bold">{t("expertTips")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {expertTips.map((e, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card-gradient p-4 shadow-soft">
                <div className="text-xs font-bold uppercase tracking-widest text-primary">{e.game === "pmu" ? "PMU" : e.game === "loto" ? "Loto Balsa" : "Pari Foot"}</div>
                <div className="mt-1 font-display text-base font-bold">{e.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{e.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Card({ title, children, linkTo, linkLabel }: { title: string; children: React.ReactNode; linkTo: "/pmu" | "/loto-balsa" | "/pari-foot"; linkLabel: string }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">{title}</h3>
        <Link to={linkTo} className="inline-flex items-center gap-1 text-xs font-bold text-primary">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}