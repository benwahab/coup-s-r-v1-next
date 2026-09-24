import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft } from "lucide-react";
import { TERMS_VERSION, TERMS_DATE } from "@/lib/legal";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Coup Sûr" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation de la plateforme Coup Sûr : règles de jeu, obligations, responsabilités.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </Link>
      <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold">{t("terms.pageTitle")}</h1>
            <p className="text-xs text-muted-foreground">
              {t("terms.versionInfo", { version: TERMS_VERSION, date: TERMS_DATE })}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s1Title")}</h2>
            <p>{t("terms.s1Body")}</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s2Title")}</h2>
            <p>{t("terms.s2Body")}</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s3Title")}</h2>
            <p>{t("terms.s3Body")}</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s4Title")}</h2>
            <p>{t("terms.s4Body")}</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s5Title")}</h2>
            <p>{t("terms.s5Body")}</p>
          </section>
          <section>
            <h2 className="font-display text-lg font-bold text-foreground">{t("terms.s6Title")}</h2>
            <p>{t("terms.s6Body")}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
