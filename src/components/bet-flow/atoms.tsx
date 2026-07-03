import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-soft">
      {title && <h2 className="mb-4 font-display text-xl font-bold">{title}</h2>}
      {children}
    </div>
  );
}

export function Footer({ onBack, onNext, disabled }: { onBack: () => void; onNext: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button onClick={onBack} type="button" className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("back")}
      </button>
      <button
        onClick={onNext}
        type="button"
        disabled={disabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-base font-bold text-primary-foreground shadow-soft transition hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("continue")} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder, required, wide }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; wide?: boolean }) {
  return (
    <label className={cn("block", wide && "sm:col-span-2")}>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}{required && " *"}</span>
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