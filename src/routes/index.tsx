import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { games, recentResults } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LoNaNi — Loterie Nationale du Niger en ligne" },
      { name: "description", content: "Jouez au PMU, Loto Balsa et Pari Foot depuis votre téléphone. Paiement mobile, reçu QR Code, notification de gain par SMS." },
      { property: "og:title", content: "LoNaNi — Loterie Nationale du Niger" },
      { property: "og:description", content: "PMU, Loto Balsa, Pari Foot. Jouez en 3 clics depuis Niamey ou partout au Niger." },
    ],
  }),
  component: Index,
});

const gameLinks = { pmu: "/pmu", loto: "/loto-balsa", foot: "/pari-foot" } as const;

function Index() {
  const { t } = useI18n();
  const lastLoto = recentResults.find((r) => r.gameId === "loto");

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-white">
        <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(800px 400px at 20% -10%, white, transparent 60%)" }} />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            🇳🇪 {t("tagline")}
          </span>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl font-bold leading-tight">
            {t("play")} <span className="text-gold">en 3 clics</span>,<br />
            depuis votre téléphone.
          </h1>
          <p className="mt-4 max-w-xl text-base sm:text-lg text-white/80">
            PMU, Loto Balsa et Pari Foot. Payez avec Airtel Money, Moov Money, Zamani Cash ou Nita. Reçu QR Code. Notification de gain par SMS.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#jeux" className="inline-flex items-center gap-2 rounded-full bg-gold-gradient px-5 py-3 font-bold text-[var(--gold-foreground)] shadow-gold transition hover:brightness-105">
              {t("playNow")} <ArrowRight className="h-4 w-4" />
            </a>
            <Link to="/resultats" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 font-semibold text-white backdrop-blur transition hover:bg-white/20">
              {t("results")}
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              { icon: Zap, label: "3 clics" },
              { icon: Smartphone, label: "Mobile Money" },
              { icon: ShieldCheck, label: "QR sécurisé" },
            ].map((b) => (
              <div key={b.label} className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur">
                <b.icon className="h-5 w-5 text-gold" />
                <div className="mt-1 text-xs font-semibold">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Games */}
      <section id="jeux" className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="font-display text-2xl sm:text-3xl font-bold">{t("chooseGame")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sélectionnez un jeu pour commencer à parier.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <Link
              key={g.id}
              to={gameLinks[g.id]}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card-gradient p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className={`absolute -right-8 -top-8 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br ${g.color} text-5xl shadow-elevated`}>
                <span className="-translate-y-1">{g.emoji}</span>
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("play")}</div>
              <div className="mt-1 font-display text-2xl font-bold">{g.name}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {g.id === "pmu" ? t("pmuDesc") : g.id === "loto" ? t("lotoDesc") : t("footDesc")}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">{t("closes")} : {g.closes}</span>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:translate-x-0.5 transition">
                  {t("playNow")} <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Last draw highlight */}
      {lastLoto?.numbers && (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Loto Balsa</div>
                <div className="font-display text-xl font-bold">Derniers numéros gagnants</div>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(lastLoto.date).toLocaleDateString()}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {lastLoto.numbers.map((n) => (
                <span key={n} className="number-ball">{n}</span>
              ))}
            </div>
            <Link to="/resultats" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Voir tous les résultats <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <p className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground">{t("secured")}</p>
    </div>
  );
}
