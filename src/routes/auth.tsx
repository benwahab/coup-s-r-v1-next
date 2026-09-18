import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, ShieldAlert, Loader2, ArrowRight, KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";
import { checkPhoneAccount } from "@/lib/account.functions";
import { loginWithPassword, setUserPassword } from "@/lib/password.functions";
import { useI18n } from "@/lib/i18n";
import { PremiumPhoneCard } from "@/components/PremiumPhoneCard";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=160&quality=90&url";

// Validation client — miroir de la validation serveur dans otp.functions.ts.
const PhoneSchema = z.string().regex(/^\d{8}$/, "Saisissez un numéro à 8 chiffres.");
const OtpSchema = z.string().regex(/^\d{6}$/, "Le code OTP fait 6 chiffres.");
const PasswordSchema = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128, "Mot de passe trop long.");

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Coup Sûr" },
      { name: "description", content: "Connectez-vous à Coup Sûr avec votre numéro de téléphone et votre mot de passe." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: AuthPage,
});

function fmtMs(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { account, isPhoneAvailable } = useAccount();
  const { requestOtp, verifyOtp, remainingLockMs, isPermanent, failedAttempts } = useAuth();

  const [step, setStep] = useState<"phone" | "otp" | "password-setup">("phone");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [otp, setOtp] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [autoRead, setAutoRead] = useState<"idle" | "listening" | "ok" | "unavailable">("idle");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [noAccountOpen, setNoAccountOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const lockMs = remainingLockMs();
  const permanent = isPermanent();
  const locked = permanent || lockMs > 0;

  useEffect(() => {
    if (step !== "otp") return;
    if (typeof window === "undefined") return;
    const hasApi = "OTPCredential" in window;
    if (!hasApi) { setAutoRead("unavailable"); return; }
    setAutoRead("listening");
    const ac = new AbortController();
    abortRef.current = ac;
    // @ts-expect-error - OTPCredential is not in TS lib
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: ac.signal })
      .then((cred) => {
        const code = (cred as unknown as { code?: string } | null)?.code;
        if (code) { setOtp(code); setAutoRead("ok"); }
      })
      .catch(() => { /* user denied / timeout */ });
    return () => ac.abort();
  }, [step]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const sendCode = async () => {
    setError(null);
    const parsed = PhoneSchema.safeParse(phone);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }

    // Aucun compte pour ce numéro sur CET appareil : avant de conclure qu'il
    // n'existe pas du tout, on vérifie côté serveur (l'utilisateur peut avoir
    // créé son compte sur un autre téléphone — le registre local ne le sait pas).
    if (isPhoneAvailable(phone).ok) {
      setSending(true);
      let existsOnServer = false;
      try {
        const check = await checkPhoneAccount({ data: { phone } });
        existsOnServer = check.exists;
      } catch { /* pas de réponse serveur : on retombe sur "aucun compte" */ }
      setSending(false);
      if (!existsOnServer) {
        setNoAccountOpen(true);
        return;
      }
    }

    setSending(true);
    try {
      const res = await requestOtp(phone);
      if (!res.ok) {
        const mins = Math.ceil((res.rate.retryInMs ?? 60_000) / 60_000);
        const msg = res.rate.reason === "phone"
          ? t("account.rateLimitPhone", { mins })
          : t("account.rateLimitDevice", { mins });
        setError(msg);
        toast.error(msg);
        return;
      }
      setDemoCode(res.code);
      setStep("otp");
      setInfo(t("account.codeSentTo") + " " + phone);
      setResendIn(60);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("account.sendFailed");
      setError(t("account.sendFailed"));
      toast.error(msg);
    } finally { setSending(false); }
  };

  const submitOtp = async () => {
    setError(null); setInfo(null);
    const parsed = OtpSchema.safeParse(otp);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setVerifying(true);
    try {
      const res = await verifyOtp(phone, otp, account?.phone ?? null);
      if (res.ok) {
        setPassword("");
        setPasswordConfirm("");
        setStep("password-setup");
        setInfo("OTP vérifié. Choisissez maintenant votre mot de passe.");
        return;
      }
      if (res.reason === "rate-limited") {
        const mins = Math.ceil(((res.rate?.retryInMs) ?? 60_000) / 60_000);
        setError(t("account.rateLimitOtp", { mins }));
      } else if (res.reason === "permanent") {
        setError(t("account.blockedContact"));
      } else if (res.reason === "locked") {
        setError(t("account.blockedHour"));
      } else if (res.reason === "wrong-phone") {
        setError(t("account.wrongPhone", { remaining: res.remaining ?? 0 }));
      } else {
        setError(t("account.wrongOtp", { remaining: res.remaining ?? 0 }));
      }
      setOtp("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("account.verifyFailed");
      setError(t("account.verifyFailed"));
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const submitPasswordLogin = async () => {
    setError(null);
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setPasswordBusy(true);
    try {
      const res = await loginWithPassword({ data: { phone, password } });
      if (!res.ok) {
        if (res.reason === "rate-limited") {
          const msg = "Trop de tentatives de connexion. Réessayez dans 15 minutes.";
          setError(msg);
          toast.error(msg);
        } else {
          setError("Numéro ou mot de passe incorrect.");
        }
        return;
      }
      const { error: sessionError } = await (await import("@/integrations/supabase/client")).supabase.auth.setSession(res.session);
      if (sessionError) throw sessionError;
      toast.success(t("account.welcomeToast"));
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const submitPasswordSetup = async () => {
    setError(null);
    const parsed = PasswordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== passwordConfirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPasswordBusy(true);
    try {
      await setUserPassword({ data: { password } });
      toast.success("Mot de passe créé avec succès.");
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer le mot de passe.");
    } finally {
      setPasswordBusy(false);
    }
  };

  const setDigit = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const arr = otp.split(""); arr[idx] = "";
      setOtp(arr.join("").slice(0, 6));
      return;
    }
    const arr = otp.padEnd(6, " ").split("");
    for (let i = 0; i < clean.length && idx + i < 6; i++) arr[idx + i] = clean[i];
    const next = arr.join("").replace(/\s/g, "").slice(0, 6);
    setOtp(next);
    const focusIdx = Math.min(5, idx + clean.length);
    inputsRef.current[focusIdx]?.focus();
  };

  return (
    <>
    <PremiumPhoneCard>
      <div className="pt-1 space-y-2.5">
        <div className="text-center pb-1">
          <div className="mx-auto h-11 w-11">
            <img src={logoCoupSur} alt="Coup Sûr" className="h-full w-full object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]" />
          </div>
          <h1 className="mt-1.5 font-display text-lg font-extrabold tracking-tight text-white">
            COUP <span className="text-[#00C896]">SÛR</span>
          </h1>
          <p className="mt-1.5 font-display text-base font-extrabold text-white">{t("account.welcome")}</p>
          <p className="mt-0.5 text-[11px] text-white/60">{t("account.loginSubtitle")}</p>
        </div>
                {locked && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-red-100 backdrop-blur-sm">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <ShieldAlert className="h-4 w-4" />
                      {permanent ? t("account.blockedPermanent") : t("account.blockedTemp")}
                    </div>
                    {permanent ? (
                      <p className="mt-1.5 text-xs">
                        {t("account.contactSupport")}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs tabular-nums">
                        {t("account.retryIn", { time: fmtMs(lockMs) })}
                      </p>
                    )}
                  </div>
                )}

                {step === "phone" && (
                  <>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Connexion</div>
                      <p className="mt-0.5 text-[11px] text-white/60">Connectez-vous avec votre numéro et votre mot de passe.</p>
                    </div>
                    <label className="cs-field group block">
                      <span className="cs-field-label">{t("account.phoneLabel")}</span>
                      <div className="cs-field-wrap">
                        <Phone className="h-5 w-5 text-white/60 group-focus-within:text-[#00C896] transition-colors" />
                        <span className="text-sm font-semibold text-white/70">+227</span>
                        <input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel"
                          maxLength={8}
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                          placeholder="90 00 00 00"
                          disabled={locked}
                          className="flex-1 bg-transparent text-lg font-bold tracking-wider text-white placeholder-white/30 outline-none disabled:opacity-50"
                        />
                      </div>
                    </label>
                    <label className="cs-field group block">
                      <span className="cs-field-label">Mot de passe</span>
                      <div className="cs-field-wrap">
                        <KeyRound className="h-5 w-5 text-white/60 group-focus-within:text-[#00C896] transition-colors" />
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Votre mot de passe"
                          disabled={locked}
                          className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-white/30 outline-none disabled:opacity-50"
                        />
                      </div>
                    </label>
                    {error && <Alert variant="error">{error}</Alert>}
                    <button
                      onClick={submitPasswordLogin}
                      disabled={locked || passwordBusy || phone.length !== 8 || password.length < 8}
                      className={["cs-cta", locked ? "cs-cta-locked" : ""].join(" ")}
                    >
                      {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {passwordBusy ? "Connexion..." : "Se connecter"}
                    </button>
                    <button
                      type="button"
                      onClick={sendCode}
                      disabled={locked || sending || phone.length !== 8}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/90 backdrop-blur transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <KeyRound className="h-4 w-4" />
                      Première connexion / mot de passe oublié
                    </button>
                    <p className="text-[11px] text-white/60 text-center">
                      {t("account.noAccount")} <a href="/compte" className="font-bold text-[#00C896] underline-offset-2 hover:underline">{t("createAccount")}</a>
                    </p>
                  </>
                )}

                {step === "otp" && (
                  <>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">{t("account.step2")}</div>
                      <h2 className="font-display text-lg font-extrabold text-white">{t("account.enterCode")}</h2>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs text-white/70 backdrop-blur">
                      {t("account.codeSentTo")} <span className="font-bold text-white">+227 {phone}</span>.{" "}
                      <button onClick={() => { setStep("phone"); setOtp(""); }} className="font-bold text-[#00C896] hover:underline">{t("account.modify")}</button>
                    </div>

                    {autoRead === "listening" && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("account.autoReadListening")}
                      </div>
                    )}
                    {autoRead === "ok" && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t("account.autoReadOk")}
                      </div>
                    )}
                    {autoRead === "unavailable" && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                        <AlertTriangle className="h-3.5 w-3.5" /> {t("account.autoReadUnavailable")}
                      </div>
                    )}

                    <div className="block">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/80">{t("account.smsCode")}</span>
                        <span className="text-[11px] text-white/50">{t("account.sixDigits")}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-6 gap-1.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <input
                            key={i}
                            ref={(el) => { inputsRef.current[i] = el; }}
                            type="tel"
                            inputMode="numeric"
                            autoComplete={i === 0 ? "one-time-code" : "off"}
                            maxLength={1}
                            aria-label={t("account.digitAriaLabel", { n: i + 1 })}
                            value={otp[i] ?? ""}
                            disabled={locked}
                            onChange={(e) => setDigit(i, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Backspace" && !otp[i] && i > 0) {
                                inputsRef.current[i - 1]?.focus();
                              }
                            }}
                            onPaste={(e) => {
                              const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                              if (txt) { e.preventDefault(); setDigit(0, txt); }
                            }}
                            className="cs-otp"
                          />
                        ))}
                      </div>
                    </div>

                    {demoCode && (
                      <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 text-center text-[11px] text-white/60">
                        {t("account.demoMode")} <span className="font-bold tabular-nums text-white">{demoCode}</span>
                      </div>
                    )}

                    {error && <Alert variant="error">{error}</Alert>}
                    {info && !error && <Alert variant="success">{info}</Alert>}

                    <button
                      onClick={submitOtp}
                      disabled={locked || otp.length !== 6 || verifying}
                      className="cs-cta"
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      {verifying ? t("account.verifying") : t("account.signIn")}
                    </button>
                    <button
                      onClick={sendCode}
                      disabled={locked || sending || resendIn > 0}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/90 backdrop-blur transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} />
                      {resendIn > 0 ? t("account.resendIn", { seconds: resendIn }) : t("account.resendSms")}
                    </button>
                  </>
                )}
                {step === "password-setup" && (
                  <>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Sécurité du compte</div>
                      <h2 className="font-display text-lg font-extrabold text-white">Choisissez votre mot de passe</h2>
                      <p className="mt-1 text-xs text-white/60">Votre OTP a été vérifié. Ce mot de passe sera utilisé pour vos prochaines connexions.</p>
                    </div>
                    <label className="cs-field group block">
                      <span className="cs-field-label">Nouveau mot de passe</span>
                      <div className="cs-field-wrap">
                        <KeyRound className="h-5 w-5 text-white/60 group-focus-within:text-[#00C896] transition-colors" />
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="8 caractères minimum"
                          className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-white/30 outline-none"
                        />
                      </div>
                    </label>
                    <label className="cs-field group block">
                      <span className="cs-field-label">Confirmer le mot de passe</span>
                      <div className="cs-field-wrap">
                        <CheckCircle2 className="h-5 w-5 text-white/60 group-focus-within:text-[#00C896] transition-colors" />
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={128}
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Retapez votre mot de passe"
                          className="flex-1 bg-transparent text-sm font-semibold text-white placeholder-white/30 outline-none"
                        />
                      </div>
                    </label>
                    {error && <Alert variant="error">{error}</Alert>}
                    {info && !error && <Alert variant="success">{info}</Alert>}
                    <button
                      onClick={submitPasswordSetup}
                      disabled={passwordBusy || password.length < 8 || password !== passwordConfirm}
                      className="cs-cta"
                    >
                      {passwordBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {passwordBusy ? "Enregistrement..." : "Créer mon mot de passe"}
                    </button>
                    <button
                      onClick={() => { setStep("phone"); setOtp(""); setPassword(""); setPasswordConfirm(""); setError(null); }}
                      className="flex min-h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white/90"
                    >
                      Retour à la connexion
                    </button>
                  </>
                )}

        <p className="pt-2 text-center text-[11px] text-white/60 leading-relaxed">
          {t("account.termsIntro")}{" "}
          <a href="/conditions" className="font-semibold text-[#00C896] hover:underline">{t("account.termsLink")}</a>{" "}
          {t("account.termsAnd")}{" "}
          <a href="/confidentialite" className="font-semibold text-[#00C896] hover:underline">{t("account.privacyLink")}</a>.
        </p>
      </div>
    </PremiumPhoneCard>

    {noAccountOpen && (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-0 sm:p-4" role="dialog" aria-modal="true">
        <div className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-border bg-card shadow-elevated overflow-hidden">
          <div className="flex items-start gap-3 border-b border-border/60 bg-gradient-to-br from-primary/15 to-transparent p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/20 text-primary">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold">{t("account.noAccountTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("account.noAccountDesc")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 p-5">
            <a
              href="/compte"
              className="w-full rounded-2xl bg-primary px-4 py-3 text-center text-sm font-extrabold uppercase tracking-wide text-primary-foreground hover:brightness-110"
            >
              {t("createAccount")}
            </a>
            <button
              onClick={() => setNoAccountOpen(false)}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50"
            >
              {t("account.cancel")}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Alert({ children, variant }: { children: React.ReactNode; variant: "error" | "success" }) {
  const cls = variant === "error"
    ? "border-red-500/40 bg-red-500/10 text-red-100"
    : "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
  return <div className={`flex items-start gap-2 rounded-xl border ${cls} p-3 text-sm`}>
    {variant === "error" ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
    <span>{children}</span>
  </div>;
}
