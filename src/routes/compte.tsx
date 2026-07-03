import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserCircle2, Save, Trash2, X, AlertTriangle, RotateCcw, Clock } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { regions } from "@/lib/mock-data";
import { TERMS_VERSION, PRIVACY_VERSION, mockIp, makeUserId } from "@/lib/legal";
import { PremiumPhoneCard } from "@/components/PremiumPhoneCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const AccountSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom trop court (2 caractères min).").max(80, "Prénom trop long."),
  lastName: z.string().trim().min(2, "Nom trop court (2 caractères min).").max(80, "Nom trop long."),
  region: z.string().min(1, "Sélectionnez une région."),
  phone: z.string().regex(/^\d{8}$/, "Numéro à 8 chiffres requis."),
  consented: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les CGU." }) }),
});
type FieldErrors = Partial<Record<"firstName" | "lastName" | "region" | "phone" | "consented", string>>;

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
  const [consented, setConsented] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState<null | "terms" | "privacy">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const ok = firstName.trim() && lastName.trim() && /^\d{8}$/.test(phone) && consented;

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
    setTimeout(() => navigate({ to: "/" }), 700);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setFieldErrors({});
    const parsed = AccountSchema.safeParse({ firstName, lastName, region, phone, consented });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      toast.error(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    // Anti-double compte : le numéro doit être libre (ou déjà à ce compte)
    const avail = isPhoneAvailable(phone, account?.userId);
    if (!avail.ok) {
      if (avail.reason === "active") {
        const msg = "Ce numéro est déjà associé à un compte actif. Un seul compte est autorisé par numéro.";
        setPhoneError(msg); toast.error(msg);
      } else if (avail.reason === "pending_deletion") {
        const daysLeft = Math.ceil(((avail.recoverableUntil ?? 0) - Date.now()) / (24 * 60 * 60 * 1000));
        const msg = `Ce numéro appartient à un compte en cours de suppression. Réutilisable dans ${daysLeft} jour(s).`;
        setPhoneError(msg); toast.error(msg);
      }
      return;
    }
    // Consentement déjà donné via la case à cocher inline (enregistrement horodaté).
    persist();
    toast.success("Compte enregistré. Vous pouvez maintenant vous connecter.");
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
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-primary">
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
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/30"
            >
              <RotateCcw className="h-4 w-4" /> Annuler la suppression
            </button>
          </div>
        )}

        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm space-y-4">
          <Field label={t("lastName")} value={lastName} onChange={(v) => { setLastName(v); if (fieldErrors.lastName) setFieldErrors((s) => ({ ...s, lastName: undefined })); }} placeholder="ex. Issa" error={fieldErrors.lastName} />
          <Field label={t("firstName")} value={firstName} onChange={(v) => { setFirstName(v); if (fieldErrors.firstName) setFieldErrors((s) => ({ ...s, firstName: undefined })); }} placeholder="ex. Aïssa" error={fieldErrors.firstName} />
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
            onChange={(v) => { setPhoneError(null); setFieldErrors((s) => ({ ...s, phone: undefined })); setPhone(v.replace(/\D/g, "").slice(0, 8)); }}
            placeholder="99294949"
            type="tel"
            error={fieldErrors.phone}
          />
          {phoneError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{phoneError}</span>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => { setConsented(e.target.checked); if (fieldErrors.consented) setFieldErrors((s) => ({ ...s, consented: undefined })); }}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#00C896] cursor-pointer"
              aria-label="J'accepte les conditions d'utilisation et la politique de confidentialité"
            />
            <span className="text-[12px] leading-relaxed text-white/80">
              J'accepte les{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLegalOpen("terms"); }}
                className="font-semibold text-[#00C896] hover:underline"
              >Conditions d'utilisation</button>{" "}
              et la{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setLegalOpen("privacy"); }}
                className="font-semibold text-[#00C896] hover:underline"
              >Politique de confidentialité</button>{" "}
              de Coup Sûr. Un enregistrement horodaté sera conservé pour prouver ce consentement.
            </span>
          </label>
          {fieldErrors.consented && (
            <p className="text-xs font-semibold text-red-300 -mt-2">{fieldErrors.consented}</p>
          )}

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

      <Drawer open={legalOpen !== null} onOpenChange={(o) => !o && setLegalOpen(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {legalOpen === "privacy" ? "Politique de confidentialité" : "Conditions d'utilisation"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-2 pb-4">
            {legalOpen && (
              <iframe
                src={legalOpen === "privacy" ? "/confidentialite" : "/conditions"}
                title={legalOpen === "privacy" ? "Politique de confidentialité" : "Conditions d'utilisation"}
                className="h-[70vh] w-full rounded-2xl border border-border bg-background"
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`mt-1 w-full rounded-2xl border bg-white/10 px-4 py-3 text-base text-white placeholder-white/30 focus:bg-white/15 outline-none ${error ? "border-red-400/70 focus:border-red-400" : "border-white/15 focus:border-[#00C896]"}`}
      />
      {error && <p className="mt-1 text-xs font-semibold text-red-300">{error}</p>}
    </label>
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
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
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
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"
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