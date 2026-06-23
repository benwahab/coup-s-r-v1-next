import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserCircle2, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { regions } from "@/lib/mock-data";

export const Route = createFileRoute("/compte")({
  head: () => ({ meta: [{ title: "Mon compte — LoNaNi" }] }),
  component: ComptePage,
});

function ComptePage() {
  const { t } = useI18n();
  const { account, saveAccount, clearAccount } = useAccount();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState(account?.firstName ?? "");
  const [lastName, setLastName] = useState(account?.lastName ?? "");
  const [region, setRegion] = useState<string>(account?.region ?? regions[0]);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [saved, setSaved] = useState(false);

  const ok = firstName.trim() && lastName.trim() && /^\d{8}$/.test(phone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    saveAccount({ firstName: firstName.trim(), lastName: lastName.trim(), region, phone });
    setSaved(true);
    setTimeout(() => navigate({ to: "/" }), 700);
  };

  return (
    <>
      <PageHeader title={t("myAccount")} icon={<UserCircle2 className="h-5 w-5" />} subtitle="Créez votre compte joueur en quelques secondes." />
      <div className="mx-auto max-w-xl px-4 py-4">
        <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-5 shadow-soft space-y-4">
          <Field label={t("lastName")} value={lastName} onChange={setLastName} placeholder="ex. Issa" />
          <Field label={t("firstName")} value={firstName} onChange={setFirstName} placeholder="ex. Aïssa" />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("region")}</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none"
            >
              {regions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <Field
            label={`${t("phone")} (8 chiffres)`}
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 8))}
            placeholder="99294949"
            type="tel"
          />

          <button
            type="submit"
            disabled={!ok}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-gradient px-5 py-3.5 font-bold text-[var(--gold-foreground)] shadow-gold disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {t("saveAccount")}
          </button>

          {saved && (
            <p className="text-center text-sm font-semibold text-success">{t("accountSaved")} ✓</p>
          )}

          {account && (
            <button
              type="button"
              onClick={() => { clearAccount(); setFirstName(""); setLastName(""); setPhone(""); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-2.5 text-sm font-semibold text-destructive"
            >
              <Trash2 className="h-4 w-4" /> {t("deleteAccount")}
            </button>
          )}
        </form>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-input bg-background px-4 py-3 text-base focus:border-primary outline-none"
      />
    </label>
  );
}