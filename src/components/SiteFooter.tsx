import { Link } from "@tanstack/react-router";
import { useState } from "react";
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

const sections: Section[] = [
  {
    id: "contact",
    label: "Nous contacter",
    icon: Mail,
    content: (
      <ul className="space-y-2 text-sm text-white/80">
        <li className="flex items-start gap-2"><Phone className="h-4 w-4 mt-0.5 text-gold" /> +227 20 73 00 00</li>
        <li className="flex items-start gap-2"><Mail className="h-4 w-4 mt-0.5 text-gold" /> contact@lonani.ne</li>
        <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-gold" /> Avenue de la Liberté, Niamey, Niger</li>
      </ul>
    ),
  },
  {
    id: "about",
    label: "À propos de nous",
    icon: Info,
    content: (
      <p className="text-sm text-white/75 leading-relaxed">
        LoNaNi (Loterie Nationale du Niger) propose les jeux PMU, Loto Balsa et Pari Foot
        en ligne avec paiement Mobile Money sécurisé, reçu QR Code infalsifiable
        et notification de gain par SMS. Notre mission : offrir un jeu fiable, transparent
        et accessible à tous les Nigériens.
      </p>
    ),
  },
  {
    id: "partners",
    label: "Nos partenaires",
    icon: Users,
    content: (
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-white/80">
        {["Airtel Money", "Moov Money", "Zamani Cash", "Nita", "Amanata", "MyNita"].map((p) => (
          <li key={p} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-semibold">{p}</li>
        ))}
      </ul>
    ),
  },
  {
    id: "privacy",
    label: "Confidentialité & sécurité",
    icon: Shield,
    content: (
      <div className="space-y-2 text-sm text-white/75 leading-relaxed">
        <p>
          Vos données personnelles (nom, téléphone, transactions) sont protégées et utilisées
          uniquement pour la gestion de votre compte de jeu, le versement des gains et le
          respect des obligations légales du Niger.
        </p>
        <p>
          Chaque reçu intègre un QR Code signé (HMAC-SHA256) garantissant son authenticité.
          Paiements traités via les opérateurs Mobile Money agréés. Aucun mot de passe Mobile
          Money n'est stocké.
        </p>
      </div>
    ),
  },
  {
    id: "support",
    label: "Service clientèle",
    icon: Headphones,
    content: (
      <div className="space-y-2 text-sm text-white/80">
        <p>Du lundi au samedi · 8h – 20h (UTC+1)</p>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-gold" /> 7000 (appel gratuit Niger)</li>
          <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-gold" /> WhatsApp : +227 90 00 70 00</li>
          <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-gold" /> support@lonani.ne</li>
        </ul>
      </div>
    ),
  },
];

const socials = [
  { label: "Facebook", icon: Facebook, href: "https://facebook.com" },
  { label: "Instagram", icon: Instagram, href: "https://instagram.com" },
  { label: "YouTube", icon: Youtube, href: "https://youtube.com" },
  { label: "WhatsApp", icon: MessageCircle, href: "https://wa.me/22790007000" },
];

export function SiteFooter() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <footer className="mt-8 border-t border-white/10 bg-hero text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* -18 badge mis en évidence */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-red-500 bg-red-500/15 px-4 py-2 font-display text-base font-extrabold text-red-300 shadow-[0_0_24px_oklch(0.6_0.2_25_/_0.4)]">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-red-500 font-display text-base font-black text-white">-18</span>
            <span className="uppercase tracking-widest text-xs sm:text-sm">Interdit aux mineurs · Jouez responsable</span>
          </div>
        </div>

        {/* Accordéon */}
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
          {sections.map((s) => {
            const active = open === s.id;
            return (
              <li key={s.id}>
                <button
                  onClick={() => setOpen(active ? null : s.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04]"
                  aria-expanded={active}
                >
                  <span className="flex items-center gap-3">
                    <s.icon className="h-4 w-4 text-gold" />
                    <span className="font-semibold text-sm">{s.label}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${active ? "rotate-180" : ""}`} />
                </button>
                {active && <div className="px-4 pb-5 pt-1 animate-fade-in">{s.content}</div>}
              </li>
            );
          })}
        </ul>

        {/* Réseaux sociaux */}
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80 transition hover:border-gold/50 hover:bg-gold/10 hover:text-gold"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <div className="text-[11px] text-white/50 text-center">
            © {new Date().getFullYear()} LoNaNi · Loterie Nationale du Niger · Tous droits réservés
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          <Link to="/" className="hover:text-gold">Accueil</Link>
          <span>·</span>
          <Link to="/resultats" className="hover:text-gold">Résultats</Link>
          <span>·</span>
          <Link to="/mes-tickets" className="hover:text-gold">Mes tickets</Link>
          <span>·</span>
          <Link to="/auth" className="hover:text-gold">Connexion</Link>
        </div>
      </div>
    </footer>
  );
}