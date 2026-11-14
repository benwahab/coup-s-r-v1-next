import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Home, Trophy, Sparkles, Ticket as TicketIcon, ShieldCheck, Globe2,
  UserCircle2, LogIn, LogOut,
} from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { useAuth } from "@/lib/auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=96&quality=90&url";

export function AppShell({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { account } = useAccount();
  const { authed, authChecked, remainingLockMs, isPermanent, logout, session } = useAuth();
  const { isAdmin, verificationFailed } = useIsAdmin();
  const lockMs = remainingLockMs();
  const locked = isPermanent() || lockMs > 0;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onAuth = pathname.startsWith("/auth");
  const onCompte = pathname.startsWith("/compte");
  const onAdmin = pathname.startsWith("/admin");
  const showGlobalBackdrop = !onAuth && !onCompte;
  const navigate = useNavigate();
  // L'accueil fait partie du parcours authentifié : après un chargement, un
  // utilisateur sans session valide doit passer par /auth au lieu de rester
  // sur l'accueil avec les boutons « Connexion » et « Créer un compte ».
  const protectedRoute =
    pathname === "/" ||
    onAdmin ||
    pathname.startsWith("/mes-tickets") ||
    pathname.startsWith("/ticket/");
  const blocked = authChecked && !authed && protectedRoute;
  const pending = !authChecked && protectedRoute;

  useEffect(() => {
    if (blocked) navigate({ to: "/auth", replace: true });
  }, [blocked, navigate]);

  if (pending || blocked) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
          <img src={logoCoupSur} alt="Coup Sûr" className="h-20 w-20 object-contain" />
          <div>
            <div className="font-display text-xl font-bold text-foreground">Coup Sûr</div>
            <div className="mt-1 text-sm text-muted-foreground">{t("shell.loadingConnection")}</div>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
    { to: "/", label: t("home"), icon: Home, exact: true },
    { to: "/resultats", label: t("results"), icon: Trophy },
    { to: "/pronostics", label: t("predictions"), icon: Sparkles },
    { to: "/mes-tickets", label: t("myTickets"), icon: TicketIcon },
  ];

  return (
    <div className="relative min-h-dvh flex flex-col bg-background">
      {showGlobalBackdrop && (
        <div className="cs-app-bg" aria-hidden>
          <span className="cs-app-orb o1" />
          <span className="cs-app-orb o2" />
          <span className="cs-app-orb o3" />
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hero shadow-gold overflow-hidden">
              <img src={logoCoupSur} alt="" className="h-8 w-8 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold leading-none truncate">{t("appName")}</div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground truncate">{t("tagline")}</div>
            </div>
          </Link>
          <div className="flex items-center gap-1.5">
            <span title={t("shell.forbiddenMinors")} className="hidden xs:inline-flex h-7 items-center justify-center rounded-full border border-red-500/60 bg-red-500/10 px-2 font-display text-[10px] font-black uppercase tracking-wider text-red-400 sm:inline-flex">-18</span>
            {!authed && !onAuth && (
              <Link to="/auth" className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition shadow-soft",
                locked ? "bg-red-500 text-white hover:bg-red-600" : "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold hover:brightness-110",
              )}>
                <LogIn className="h-3.5 w-3.5" />
                <span>{locked ? t("shell.locked") : t("shell.login")}</span>
              </Link>
            )}
            {authed && (
              <button type="button" onClick={() => { logout(); void navigate({ to: "/auth", replace: true }); }}
                aria-label={t("shell.logout")}
                title={session ? t("shell.connectedAs", { phone: session.phone }) : ""}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/20">
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden xs:inline sm:inline">{t("shell.logout")}</span>
              </button>
            )}
            {!authed && !onCompte && (
              <Link to="/compte" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition">
                <UserCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{account ? account.firstName : t("createAccount")}</span>
              </Link>
            )}
            {isAdmin && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition">
                <ShieldCheck className="h-3.5 w-3.5" /> {t("admin")}
              </Link>
            )}
            {authed && verificationFailed && (
              <span role="status" className="max-w-28 text-right text-[10px] leading-tight text-amber-500">
                Vérification Admin impossible
              </span>
            )}
            <LangSwitch lang={lang} setLang={setLang} />
          </div>
        </div>
      </header>
      <main className={cn("flex-1", showGlobalBackdrop && "pb-24")}>{children}</main>
      {onAuth && <SiteFooter />}
      {showGlobalBackdrop && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur shadow-elevated">
          <ul className="mx-auto grid max-w-6xl grid-cols-4">
            {navItems.map((it) => {
              const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
              return (
                <li key={it.to}>
                  <Link to={it.to as "/"} className={cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}>
                    <it.icon className={cn("h-5 w-5", active && "text-primary")} />{it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}

function LangSwitch({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
      <Globe2 className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
      {(["fr", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className={cn(
          "ml-1 rounded-full px-2.5 py-1 uppercase transition",
          lang === l ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground",
        )}>{l}</button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-2">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold-gradient text-[var(--gold-foreground)] shadow-gold">{icon}</div>}
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
