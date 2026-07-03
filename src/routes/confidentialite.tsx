import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { PRIVACY_VERSION, PRIVACY_DATE } from "@/lib/legal";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — LoNaNi" },
      { name: "description", content: "Politique de confidentialité LoNaNi (Coup Sûr) : données collectées, finalités, durée de conservation, droits des utilisateurs." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold">Politique de confidentialité</h1>
            <p className="text-xs text-muted-foreground">Version {PRIVACY_VERSION} · en vigueur le {PRIVACY_DATE}</p>
          </div>
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">1. Données collectées</h2>
            <p>Nom, prénom, région, numéro de téléphone, historique de mises et de gains,
              adresse IP au moment de l'inscription et de la connexion.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">2. Finalités</h2>
            <p>Gestion du compte joueur, exécution des transactions, versement des gains,
              lutte contre la fraude et respect des obligations légales.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">3. Base légale</h2>
            <p>Exécution du contrat, obligation légale, intérêt légitime (sécurité et
              anti-fraude), consentement pour les communications non essentielles.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">4. Conservation</h2>
            <p>Les données de compte sont conservées pendant la durée d'utilisation puis
              archivées selon les obligations légales. Après suppression de compte, un délai
              de rétractation de 30 jours s'applique avant effacement définitif.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">5. Vos droits</h2>
            <p>Accès, rectification, suppression, opposition et portabilité de vos données.
              Contact : privacy@lonani.ne.</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">6. Sécurité</h2>
            <p>Chiffrement des reçus (HMAC-SHA256), rate limiting, journalisation des accès,
              hébergement sécurisé. Aucun mot de passe Mobile Money n'est conservé.</p>
          </section>
        </div>
      </div>
    </div>
  );
}