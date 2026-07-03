import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserCircle2, Save, Trash2, ShieldCheck, X, AlertTriangle, RotateCcw, Clock } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { regions } from "@/lib/mock-data";
import { TERMS_VERSION, PRIVACY_VERSION, mockIp, makeUserId } from "@/lib/legal";
import { PremiumPhoneCard } from "@/components/PremiumPhoneCard";

export const Route = createFileRoute("/compte")({
  head: () => ({ meta: [{ title: "Mon compte — Coup Sûr" }] }),
  component: ComptePage,
});

function ComptePage() {
  const { t } = useI18n();
  const { account, saveAccount, clearAccount, isPhoneAvailable, requestDeletion, cancelDeletion, deletionRemainingMs } = useAccount();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const ok = firstName.trim() && lastName.trim() && /^\d{8}$/.test(phone);

  const deletionMs = deletionRemainingMs();
  const deletionDaysLeft = Math.ceil(deletionMs / (24 * 60 * 60 * 1000));

  const persist = () => {
    saveAccount({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      region,
      phone,
      userId: account?.userId ?? makeUserId(phone),
      consent: {
        acceptedAt: Date.now(),
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        ip: mockIp(),
        userId: account?.userId ?? makeUserId(phone),
      },
    });
    setSaved(true);
    setConsentOpen(false);
    setTimeout(() => navigate({ to: "/" }), 700);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    if (!ok) return;
    // Anti-double compte : le numéro doit être libre (ou déjà à ce compte)
    const avail = isPhoneAvailable(phone, account?.userId);
    if (!avail.ok) {
      if (avail.reason === "active") {
        setPhoneError("Ce numéro est déjà associé à un compte actif. Un seul compte est autorisé par numéro.");
      } else if (avail.reason === "pending_deletion") {
        const daysLeft = Math.ceil(((avail.recoverableUntil ?? 0) - Date.now()) / (24 * 60 * 60 * 1000));
        setPhoneError(`Ce numéro appartient à un compte en cours de suppression. Réutilisable dans ${daysLeft} jour(s).`);
      }
      return;
    }
    // Ouvre la modale de consentement au lieu de créer directement
    setConsentOpen(true);
  };

  return (
    <>
      <PremiumPhoneCard>
        <div className="pt-4 space-y-4">
          <div className="text-center pb-1">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
              <UserCircle2 className="h-6 w-6 text-white" />
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-white">
              {t("myAccount")}
            </h1>
            <p className="mt-0.5 text-[12px] text-white/60">Créez votre compte joueur en quelques secondes.</p>
          </div>

        {account?.deletionRequestedAt && deletionMs > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-100">
            <div className="flex items-center gap-2 font-bold">
              <Clock className="h-4 w-4" /> Suppression programmée
            </div>
            <p className="mt-1 text-sm">
              Votre compte sera définitivement supprimé dans{" "}
              <span className="font-bold">{deletionDaysLeft} jour{deletionDaysLeft > 1 ? "s" : ""}</span>.
              Vous pouvez annuler à tout moment pendant ce délai.
            </p>
            <button
              type="button"
              onClick={cancelDeletion}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-100 hover:bg-amber-500/30"
            >
              <RotateCcw className="h-4 w-4" /> Annuler la suppression
            </button>
          </div>
        )}

        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm space-y-4">
          <Field label={t("lastName")} value={lastName} onChange={setLastName} placeholder="ex. Issa" />
          <Field label={t("firstName")} value={firstName} onChange={setFirstName} placeholder="ex. Aïssa" />
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">{t("region")}</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white focus:border-[#00C896] outline-none"
            >
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <Field
            label={`${t("phone")} (8 chiffres)`}
            value={phone}
            onChange={(v) => { setPhoneError(null); setPhone(v.replace(/\D/g, "").slice(0, 8)); }}
            placeholder="99294949"
            type="tel"
          />
          {phoneError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{phoneError}</span>
            </div>
          )}

          <p className="text-[11px] text-white/60">
            En créant votre compte, vous acceptez les{" "}
            <a href="/conditions" target="_blank" rel="noreferrer" className="font-semibold text-[#00C896] hover:underline">Conditions d'utilisation</a>{" "}
            et la{" "}
            <a href="/confidentialite" target="_blank" rel="noreferrer" className="font-semibold text-[#00C896] hover:underline">Politique de confidentialité</a>.
          </p>

          <button
            type="submit"
            disabled={!ok}
            className="cs-cta"
          >
            <Save className="h-4 w-4" /> {t("saveAccount")}
          </button>

          {saved && (
            <p className="text-center text-sm font-semibold text-emerald-300">{t("accountSaved")} ✓</p>
          )}

          {account && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" /> {t("deleteAccount")}
            </button>
          )}
        </form>
        </div>
      </PremiumPhoneCard>

      {consentOpen && (
        <ConsentModal
          onCancel={() => setConsentOpen(false)}
          onAccept={persist}
        />
      )}

      {confirmDeleteOpen && (
        <ConfirmDeleteModal
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => {
            requestDeletion();
            setConfirmDeleteOpen(false);
          }}
          onPurge={() => {
            clearAccount();
            setFirstName(""); setLastName(""); setPhone("");
            setConfirmDeleteOpen(false);
          }}
        />
      )}
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white placeholder-white/30 focus:border-[#00C896] focus:bg-white/15 outline-none"
      />
    </label>
  );
}

function ConsentModal({ onCancel, onAccept }: { onCancel: () => void; onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/15 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/20 text-primary shadow-inner">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold">Confirmation requise</h3>
              <p className="text-xs text-muted-foreground">Avant la création de votre compte</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm leading-relaxed text-foreground/90">
            En poursuivant votre inscription, vous acceptez les{" "}
            <a href="/conditions" target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline decoration-2 underline-offset-2">Conditions d'utilisation</a>{" "}
            de Coup Sûr et reconnaissez avoir pris connaissance de notre{" "}
            <a href="/confidentialite" target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline decoration-2 underline-offset-2">Politique de confidentialité</a>.
          </p>
          <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            Un enregistrement (date, heure, versions des documents, adresse IP) sera conservé pour prouver votre consentement.
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 rounded-2xl border-2 border-border bg-background px-4 py-3 text-sm font-bold text-foreground hover:border-primary/50"
            >
              Annuler
            </button>
            <button
              onClick={onAccept}
              className="flex-1 rounded-2xl bg-gold-gradient px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[var(--gold-foreground)] shadow-gold hover:brightness-110"
            >
              J'accepte et je continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ onCancel, onConfirm, onPurge }: { onCancel: () => void; onConfirm: () => void; onPurge: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-destructive/15 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/20 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold">Supprimer mon compte</h3>
              <p className="text-xs text-muted-foreground">Un délai de rétractation s'applique</p>
            </div>
          </div>
          <button onClick={onCancel} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="font-bold">Suppression avec délai de 30 jours (recommandé)</p>
            <p className="mt-1 text-xs opacity-90">
              Votre compte sera désactivé immédiatement. Pendant 30 jours, vous pouvez le
              récupérer en annulant la suppression. Passé ce délai, le numéro sera libéré et
              pourra être associé à un nouveau compte.
            </p>
          </div>
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-bold">Suppression immédiate & définitive</p>
            <p className="mt-1 text-xs opacity-90">
              Toutes les données locales seront effacées maintenant. Cette action est irréversible.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onConfirm}
              className="w-full rounded-2xl bg-amber-500 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-amber-950 hover:brightness-110"
            >
              Programmer la suppression (30 jours)
            </button>
            <button
              onClick={onPurge}
              className="w-full rounded-2xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/25"
            >
              Supprimer définitivement maintenant
            </button>
            <button
              onClick={onCancel}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}