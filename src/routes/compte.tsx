import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  UserCircle2,
  Save,
  Trash2,
  X,
  AlertTriangle,
  RotateCcw,
  Clock,
  Smartphone,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { checkPhoneAccount } from "@/lib/account.functions";
import { regions } from "@/lib/game-config";
import { TERMS_VERSION, PRIVACY_VERSION, makeUserId } from "@/lib/legal";
import { PremiumPhoneCard } from "@/components/PremiumPhoneCard";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

const AccountSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, t("account.validation.firstNameShort"))
    .max(80, t("account.validation.firstNameLong")),
  lastName: z
    .string()
    .trim()
    .min(2, t("account.validation.lastNameShort"))
    .max(80, t("account.validation.lastNameLong")),
  region: z.string().min(1, t("account.validation.region")),
  phone: z.string().regex(/^\d{8}$/, t("account.validation.phone")),
  consented: z.literal(true, { errorMap: () => ({ message: t("account.validation.consent") }) }),
});
type FieldErrors = Partial<
  Record<"firstName" | "lastName" | "region" | "phone" | "consented", string>
>;

export const Route = createFileRoute("/compte")({
  head: () => ({
    meta: [{ title: "Mon compte — Coup Sûr" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: ComptePage,
});

function ComptePage() {
  const { t } = useI18n();
  const {
    account,
    saveAccount,
    clearAccount,
    isPhoneAvailable,
    requestDeletion,
    cancelDeletion,
    deletionRemainingMs,
  } = useAccount();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [consented, setConsented] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [mmInfoOpen, setMmInfoOpen] = useState(false);
  const [mmInfoSeen, setMmInfoSeen] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState<null | "terms" | "privacy">(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const ok = firstName.trim() && lastName.trim() && /^\d{8}$/.test(phone) && consented;

  const deletionMs = deletionRemainingMs();
  const deletionDaysLeft = Math.ceil(deletionMs / (24 * 60 * 60 * 1000));

  const persist = () => {
    const isNewAccount = !account;
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
        ip: "",
        userId: account?.userId ?? makeUserId(phone),
      },
    });
    setSaved(true);
    // Un nouveau compte doit se connecter via OTP sur /auth ; une simple
    // mise à jour de profil ramène à l'accueil comme avant.
    setTimeout(() => navigate({ to: isNewAccount ? "/auth" : "/" }), 700);
  };

  const submit = async (e: React.FormEvent) => {
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
      toast.error(parsed.error.issues[0]?.message ?? t("account.formInvalid"));
      return;
    }
    const avail = isPhoneAvailable(phone, account?.userId);
    if (!avail.ok) {
      if (avail.reason === "active") {
        const msg = t("account.phoneTaken");
        setPhoneError(msg);
        toast.error(msg);
      } else if (avail.reason === "pending_deletion") {
        const daysLeft = Math.ceil(
          ((avail.recoverableUntil ?? 0) - Date.now()) / (24 * 60 * 60 * 1000),
        );
        const msg = t("account.phonePendingDeletion", { days: daysLeft });
        setPhoneError(msg);
        toast.error(msg);
      }
      return;
    }
    // Registre local vide = nouvel appareil, pas forcément un nouveau compte :
    // on vérifie côté serveur avant de laisser créer, pour ne pas écraser un
    // compte déjà existant sur un autre téléphone.
    if (!account?.userId) {
      setChecking(true);
      let existsOnServer = false;
      try {
        const check = await checkPhoneAccount({ data: { phone } });
        existsOnServer = check.exists;
      } catch {
        /* pas de réponse serveur : le serveur retranchera de toute façon à l'étape OTP */
      }
      setChecking(false);
      if (existsOnServer) {
        const msg = t("account.phoneTaken");
        setPhoneError(msg);
        toast.error(msg);
        return;
      }
    }
    persist();
    toast.success(t("account.savedToast"));
  };

  return (
    <>
      <PremiumPhoneCard>
        <div className="pt-1 space-y-2.5">
          <div className="text-center pb-0.5">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
              <UserCircle2 className="h-5 w-5 text-white" />
            </div>
            <h1 className="mt-2 font-display text-xl font-extrabold tracking-tight text-white">
              {t("myAccount")}
            </h1>
            <p className="mt-0.5 text-[11px] text-white/60">{t("account.createSubtitle")}</p>
          </div>

          {account?.deletionRequestedAt && deletionMs > 0 && (
            <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4 text-primary">
              <div className="flex items-center gap-2 font-bold">
                <Clock className="h-4 w-4" /> {t("account.deletionScheduled")}
              </div>
              <p className="mt-1 text-sm">
                {t("account.deletionNotice", {
                  days: deletionDaysLeft,
                  plural: deletionDaysLeft > 1 ? "s" : "",
                })}
              </p>
              <button
                type="button"
                onClick={cancelDeletion}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/20 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/30"
              >
                <RotateCcw className="h-4 w-4" /> {t("account.cancelDeletion")}
              </button>
            </div>
          )}

          <form
            onSubmit={submit}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm space-y-2.5"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Field
                label={t("lastName")}
                value={lastName}
                onChange={(v) => {
                  setLastName(v);
                  if (fieldErrors.lastName) setFieldErrors((s) => ({ ...s, lastName: undefined }));
                }}
                placeholder="ex. Issa"
                error={fieldErrors.lastName}
              />
              <Field
                label={t("firstName")}
                value={firstName}
                onChange={(v) => {
                  setFirstName(v);
                  if (fieldErrors.firstName)
                    setFieldErrors((s) => ({ ...s, firstName: undefined }));
                }}
                placeholder="ex. Aïssa"
                error={fieldErrors.firstName}
              />
            </div>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                {t("region")}
              </span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 w-full rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm text-white focus:border-[#00C896] outline-none"
              >
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={`${t("phone")} (8 chiffres)`}
              value={phone}
              onChange={(v) => {
                setPhoneError(null);
                setFieldErrors((s) => ({ ...s, phone: undefined }));
                setPhone(v.replace(/\D/g, "").slice(0, 8));
              }}
              onFocus={() => {
                if (!mmInfoSeen) {
                  setMmInfoOpen(true);
                  setMmInfoSeen(true);
                }
              }}
              placeholder="99294949"
              type="tel"
              error={fieldErrors.phone}
            />
            {phoneError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-100">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{phoneError}</span>
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-white/5 p-2.5 cursor-pointer hover:bg-white/10 transition">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => {
                  setConsented(e.target.checked);
                  if (fieldErrors.consented)
                    setFieldErrors((s) => ({ ...s, consented: undefined }));
                }}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#00C896] cursor-pointer"
                aria-label={t("account.consentAriaLabel")}
              />
              <span className="text-[11px] leading-snug text-white/80">
                {t("account.consentPrefix")}{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLegalOpen("terms");
                  }}
                  className="font-semibold text-[#00C896] hover:underline"
                >
                  {t("account.termsLink")}
                </button>{" "}
                {t("account.consentAnd")}{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setLegalOpen("privacy");
                  }}
                  className="font-semibold text-[#00C896] hover:underline"
                >
                  {t("account.privacyLink")}
                </button>{" "}
                {t("account.consentSuffix")}
              </span>
            </label>
            {fieldErrors.consented && (
              <p className="text-xs font-semibold text-red-300 -mt-2">{fieldErrors.consented}</p>
            )}

            <button type="submit" disabled={!ok || checking} className="cs-cta">
              <Save className="h-4 w-4" /> {t("saveAccount")}
            </button>

            {saved && (
              <p className="text-center text-sm font-semibold text-emerald-300">
                {t("accountSaved")} ✓
              </p>
            )}

            {account && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("deleteAccount")}
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
            setFirstName("");
            setLastName("");
            setPhone("");
            setConfirmDeleteOpen(false);
          }}
        />
      )}

      {mmInfoOpen && <MobileMoneyInfoModal onClose={() => setMmInfoOpen(false)} />}

      <Drawer open={legalOpen !== null} onOpenChange={(o) => !o && setLegalOpen(null)}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>
              {legalOpen === "privacy" ? t("account.privacyLink") : t("account.termsLink")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-2 pb-4">
            {legalOpen && (
              <iframe
                src={legalOpen === "privacy" ? "/confidentialite" : "/conditions"}
                title={legalOpen === "privacy" ? t("account.privacyLink") : t("account.termsLink")}
                className="h-[70vh] w-full rounded-2xl border border-border bg-background"
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  onFocus?: () => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        aria-invalid={!!error}
        className={`mt-1 w-full rounded-2xl border bg-white/10 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:bg-white/15 outline-none ${error ? "border-red-400/70 focus:border-red-400" : "border-white/15 focus:border-[#00C896]"}`}
      />
      {error && <p className="mt-1 text-xs font-semibold text-red-300">{error}</p>}
    </label>
  );
}

function MobileMoneyInfoModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-primary/15 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/20 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-extrabold">{t("account.mmInfoTitle")}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("account.close")}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground/90">{t("account.mmInfoDesc")}</p>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"
          >
            {t("account.mmInfoAck")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  onCancel,
  onConfirm,
  onPurge,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  onPurge: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-br from-destructive/15 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/20 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold">
                {t("account.deleteMyAccount")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("account.deletionCooldown")}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label={t("account.close")}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
            <p className="font-bold">{t("account.deletionSoft")}</p>
            <p className="mt-1 text-xs opacity-90">{t("account.deletionSoftDesc")}</p>
          </div>
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-bold">{t("account.deletionHard")}</p>
            <p className="mt-1 text-xs opacity-90">{t("account.deletionHardDesc")}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onConfirm}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"
            >
              {t("account.scheduleDeletion")}
            </button>
            <button
              onClick={onPurge}
              className="w-full rounded-2xl border border-destructive/50 bg-destructive/15 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/25"
            >
              {t("account.deletePermanent")}
            </button>
            <button
              onClick={onCancel}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50"
            >
              {t("account.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
