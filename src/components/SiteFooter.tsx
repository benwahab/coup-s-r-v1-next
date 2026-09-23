import { Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import {
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Shield,
  Users,
  Info,
  Headphones,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
} from "lucide-react";

type Section = { id: string; label: string; icon: typeof Mail; content: React.ReactNode };

const socials = [
  { label: "Facebook", icon: Facebook, href: "https://facebook.com" },
  { label: "Instagram", icon: Instagram, href: "https://instagram.com" },
  { label: "YouTube", icon: Youtube, href: "https://youtube.com" },
  { label: "WhatsApp", icon: MessageCircle, href: "https://wa.me/22790007000" },
];

export function SiteFooter() {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const sections = useMemo<Section[]>(() => [
    { id: "contact", label: t("shell.footer.contact"), icon: Mail, content: (
      <ul className="space-y-2 text-sm text-white/80">
        <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-gold" /> +227 20 73 00 00</li>
        <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-gold" /> contact@coupsur.ne</li>
        <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-gold" /> Avenue de la Liberté, Niamey, Niger</li>
      </ul>
    ) },
    { id: "about", label: t("shell.footer.about"), icon: Info, content: (
      <p className="text-sm text-white/75 leading-relaxed">{t("shell.footer.aboutText")}</p>
    ) },
    { id: "partners", label: t("shell.footer.partners"), icon: Users, content: (
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-white/80">
        {["Airtel Money"].map((p) => (
          <li key={p} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-semibold">{p}</li>
        ))}
      </ul>
    ) },
    { id: "privacy", label: t("shell.footer.privacy"), icon: Shield, content: (
      <div className="space-y-2 text-sm text-white/75 leading-relaxed">
        <p>{t("shell.footer.privacyText1")}</p>
        <p>{t("shell.footer.privacyText2")}</p>
      </div>
    ) },
    { id: "support", label: t("shell.footer.support"), icon: Headphones, content: (
      <div className="space-y-2 text-sm text-white/80">
        <p>{t("shell.footer.supportHours")}</p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold" /> {t("shell.footer.freeCall")}</li>
          <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-gold" /> {t("shell.footer.whatsapp")}</li>
          <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold" /> support@coupsur.ne</li>
        </ul>
      </div>
    ) },
  ], [t]);

  return (
    <footer className="mt-8 border-t border-white/10 bg-hero text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* -18 badge */}
        <div className="mb-7 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-red-500/50 bg-red-500/10 px-4 py-1.5 backdrop-blur">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-red-500 font-display text-xs font-black text-white">-18</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-red-300">{t("shell.footer.minorsWarning")}</span>
          </div>
        </div>

        {/* Cartes d'informations */}
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {sections.map((s) => {
            const active = open === s.id;
            return (
              <li
                key={s.id}
                className={`overflow-hidden rounded-2xl border bg-white/[0.03] backdrop-blur transition-colors ${active ? "border-gold/40 bg-white/[0.06]" : "border-white/10 hover:border-white/20"}`}
              >
                <button
                  onClick={() => setOpen(active ? null : s.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  aria-expanded={active}
                >
                  <span className="flex items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors ${active ? "bg-gold/20 text-gold" : "bg-white/[0.06] text-white/70"}`}>
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span className="font-display text-sm font-bold">{s.label}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-300 ${active ? "rotate-180 text-gold" : ""}`} />
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: active ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-white/10 px-4 pb-4 pt-3">{s.content}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Réseaux sociaux */}
        <div className="mt-7 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:-translate-y-0.5 hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <div className="text-[11px] text-white/45">
            {t("shell.footer.copyright", { year: new Date().getFullYear() })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5 text-[11px]">
          {[
            { to: "/" as const, label: t("home") },
            { to: "/resultats" as const, label: t("results") },
            { to: "/mes-tickets" as const, label: t("myTickets") },
            { to: "/auth" as const, label: t("shell.login") },
            { to: "/conditions" as const, label: t("shell.footer.terms") },
            { to: "/confidentialite" as const, label: t("shell.footer.privacyPolicy") },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="rounded-full px-2.5 py-1 text-white/55 transition hover:bg-white/5 hover:text-gold">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}