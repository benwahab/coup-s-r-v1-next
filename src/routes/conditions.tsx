import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft } from "lucide-react";
import { TERMS_VERSION, TERMS_DATE } from "@/lib/legal";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — LoNaNi" },
      { name: "description", content: "Conditions générales d'utilisation de la plateforme LoNaNi (Coup Sûr) : règles de jeu, obligations, responsabilités." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Conditions d'utilisation</h1>
            <p className="text-xs text-muted-foreground">Version {TERMS_VERSION} · en vigueur le {TERMS_DATE}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">1. Objet</h2>
            <p>Les présentes Conditions régissent l'accès et l'utilisation de la plateforme
              LoNaNi (marque Coup Sûr) permettant de jouer en ligne aux jeux de la
              Loterie Nationale du Niger (PMU, Loto Balsa, Pari Foot).</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">2. Éligibilité</h2>
            <p>L'utilisation est strictement réservée aux personnes majeures (18 ans révolus)
              résidant au Niger. Un seul compte est autorisé par numéro de téléphone.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">3. Compte joueur</h2>
            <p>L'ouverture d'un compte requiert un numéro de téléphone valide, la vérification
              par code OTP, ainsi que l'acceptation des présentes Conditions et de la Politique
              de confidentialité. Vous pouvez demander la suppression de votre compte à tout
              moment. Un délai de rétractation de 30 jours vous permet de le récupérer.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">4. Paiement & gains</h2>
            <p>Les mises sont réglées via Mobile Money (Airtel Money, Moov Flooz, Zamani Cash,
              Amanata, MyNita). Les gains sont crédités selon les règles propres à chaque jeu
              et notifiés par SMS.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">5. Jeu responsable</h2>
            <p>Le jeu comporte des risques. Fixez-vous des limites. Le service clientèle est
              joignable au 7000 pour toute assistance.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">6. Modifications</h2>
            <p>LoNaNi se réserve le droit de faire évoluer les présentes Conditions. Toute
              modification substantielle sera notifiée aux utilisateurs.</p>
          </section>
        </div>
      </div>
    </div>
  );
}