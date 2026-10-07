import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logoCoupSur from "@/assets/logo-coup-sur.png?format=webp&w=160&quality=90&url";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { checkPhoneAccount } from "@/lib/account.functions";
import { loginWithPassword, setUserPassword } from "@/lib/password.functions";
import { getServerConfigStatus } from "@/lib/server-config.functions";

const PENDING_KEY = "coupsur.auth.pending";

const PhoneSchema = z.string().regex(/^\d{8}$/);
const OtpSchema = z.string().regex(/^\d{6}$/);
const PasswordSchema = z
  .string()
  .min(8)
  .max(128);

type Mode = "login" | "signup" | "recovery";
type Step = "form" | "otp" | "new-password";
type FieldErrors = Partial<
  Record<
    "phone" | "password" | "confirmation" | "terms" | "otp" | "firstName" | "lastName" | "region",
    string
  >
>;
const NIGER_REGIONS = [
  "Agadez",
  "Diffa",
  "Dosso",
  "Maradi",
  "Niamey",
  "Tahoua",
  "Tillabéri",
  "Zinder",
];

function getStoredAuthLang(): "fr" | "en" {
  if (typeof window === "undefined") return "fr";
  return localStorage.getItem("lonani.lang") === "en" ? "en" : "fr";
}

export const Route = createFileRoute("/auth")({
  head: () => {
    const en = getStoredAuthLang() === "en";
    const title = en ? "Sign in or create an account — Coup Sûr" : "Connexion et création de compte — Coup Sûr";
    const description = en
      ? "Sign in or create your Coup Sûr account with your Nigerien phone number."
      : "Connectez-vous ou créez votre compte Coup Sûr avec votre numéro nigérien.";
    const ogDescription = en
      ? "Securely access your Coup Sûr account."
      : "Accédez en toute sécurité à votre compte Coup Sûr.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: ogDescription },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate({ from: "/auth" });
  const { requestOtp, verifyOtp, remainingLockMs, isPermanent } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { saveAccount } = useAccount();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [region, setRegion] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const lockMs = remainingLockMs();
  const otpLocked = step === "otp" && (isPermanent() || lockMs > 0);
  const [config, setConfig] = useState<
    { state: "checking" } | { state: "ready" } | { state: "error"; message: string }
  >({ state: "checking" });

  const checkConfig = async () => {
    setConfig({ state: "checking" });
    const clientOk =
      !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!clientOk) {
      setConfig({
        state: "error",
        message: t("auth.serverMissing"),
      });
      return;
    }
    try {
      const res = await getServerConfigStatus();
      setConfig(
        res.ready
          ? { state: "ready" }
          : {
              state: "error",
              message: t("auth.serverNotReady", { missing: res.missing.join(", ") }),
            },
      );
    } catch {
      setConfig({
        state: "error",
        message: t("auth.serverUnreachable"),
      });
    }
  };

  // Restaure l'étape du code après un rechargement de la page (mauvaise
  // connexion, mise à jour de l'aperçu). Ni mot de passe ni code n'est stocké.
  useEffect(() => {
    void checkConfig();
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as {
        mode: Mode;
        phone: string;
        demoCode: string | null;
        sentAt: number;
      };
      if (Date.now() - p.sentAt > 5 * 60_000) {
        sessionStorage.removeItem(PENDING_KEY);
        return;
      }
      setMode(p.mode);
      setPhone(p.phone);
      setDemoCode(p.demoCode);
      setStep("otp");
      setResendIn(Math.max(0, 60 - Math.floor((Date.now() - p.sentAt) / 1000)));
      setStatus(p.demoCode ? t("auth.demoActive") : null);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  const clearPending = () => {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [mode, step]);

  const switchMode = (nextMode: Mode) => {
    clearPending();
    setMode(nextMode);
    setStep("form");
    setPassword("");
    setConfirmation("");
    setTermsAccepted(false);
    setOtp("");
    setErrors({});
    setStatus(null);
    setDemoCode(null);
    setResendIn(0);
  };

  const validatePhone = () => {
    const parsed = PhoneSchema.safeParse(phone);
    if (parsed.success) return null;
    return t("auth.phoneInvalid");
  };

  const validatePassword = (value: string) => {
    const parsed = PasswordSchema.safeParse(value);
    if (parsed.success) return null;
    return parsed.error.issues[0]?.code === "too_big" ? t("auth.passwordMax") : t("auth.passwordMin");
  };

  const sendCode = async (intent: "signup" | "recovery", isResend = false) => {
    const phoneError = validatePhone();
    if (phoneError) {
      setErrors({ phone: phoneError });
      return;
    }

    setBusy(true);
    setErrors({});
    setStatus(null);
    try {
      if (!isResend) {
        const accountState = await checkPhoneAccount({ data: { phone } });
        if (intent === "signup" && accountState.exists) {
          setErrors({ phone: t("auth.phoneExists") });
          return;
        }
        if (intent === "recovery" && !accountState.exists) {
          setErrors({ phone: t("auth.phoneMissing") });
          return;
        }
      }

      const result = await requestOtp(phone);
      if (!result.ok) {
        if (result.reason === "provider-unavailable") {
          setErrors({ otp: t("auth.providerUnavailable") });
          return;
        }
        const minutes = Math.ceil((result.rate.retryInMs ?? 15 * 60_000) / 60_000);
        setErrors({
          otp: t("auth.tooManyRequests", { minutes }),
        });
        return;
      }

      setDemoCode(result.demoCode);
      try {
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ mode: intent, phone, demoCode: result.demoCode, sentAt: Date.now() }),
        );
      } catch {
        /* stockage indisponible */
      }
      setOtp("");
      setStep("otp");
      setResendIn(60);
      setStatus(
        result.demoCode
          ? t("auth.demoActive")
          : t("auth.codeSent", { phone: formatPhone(phone) }),
      );
    } catch {
      setErrors({ otp: t("auth.network") });
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async () => {
    const nextErrors: FieldErrors = {};
    const phoneError = validatePhone();
    const passwordError = validatePassword(password);
    if (phoneError) nextErrors.phone = phoneError;
    if (passwordError) nextErrors.password = passwordError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setStatus(null);
    try {
      const result = await loginWithPassword({ data: { phone, password } });
      if (!result.ok) {
        setErrors({
          password:
            result.reason === "rate-limited"
              ? t("auth.loginRateLimited")
              : t("auth.invalidCredentials"),
        });
        return;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.setSession(result.session);
      if (error) throw error;
      toast.success(t("auth.loginSuccess"));
      await navigate({ to: "/" });
    } catch {
      setErrors({ password: t("auth.loginFailed") });
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async () => {
    const nextErrors: FieldErrors = {};
    const phoneError = validatePhone();
    const passwordError = validatePassword(password);
    if (phoneError) nextErrors.phone = phoneError;
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmation)
      nextErrors.confirmation = t("auth.passwordMismatch");
    if (firstName.trim().length < 2) nextErrors.firstName = t("auth.firstNameRequired");
    if (lastName.trim().length < 2) nextErrors.lastName = t("auth.lastNameRequired");
    if (!region) nextErrors.region = t("auth.regionRequired");
    if (!termsAccepted)
      nextErrors.terms = t("auth.termsRequired");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    // Nom, prénom et région (non sensibles) sont transmis au serveur à la vérification du code.
    saveAccount({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      region,
      phone,
    });
    await sendCode("signup");
  };

  const submitRecoveryPhone = async () => {
    await sendCode("recovery");
  };

  const submitOtp = async () => {
    const parsed = OtpSchema.safeParse(otp);
    if (!parsed.success) {
      setErrors({ otp: t("auth.otpInvalid") });
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      const result = await verifyOtp(phone, otp, null);
      if (!result.ok) {
        const messages = {
          permanent: t("auth.blockedPermanent"),
          locked: t("auth.locked"),
          "rate-limited": t("auth.rateLimitedVerify"),
          "wrong-phone": t("auth.wrongPhone"),
          "wrong-code": t("auth.wrongCode", { remaining: result.remaining ?? 0 }),
        };
        setErrors({ otp: messages[result.reason ?? "wrong-code"] });
        setOtp("");
        otpRefs.current[0]?.focus();
        return;
      }

      clearPending();
      // Après un rechargement, le mot de passe (jamais stocké) doit être ressaisi.
      if (mode === "signup" && password) {
        await finishPasswordSetup(password, t("auth.accountReady"));
        return;
      }
      setPassword("");
      setConfirmation("");
      setStep("new-password");
      setStatus(t("auth.numberVerified"));
    } catch {
      setErrors({ otp: t("auth.verifyFailed") });
    } finally {
      setBusy(false);
    }
  };

  const finishPasswordSetup = async (newPassword: string, successMessage: string) => {
    try {
      const set = await setUserPassword({ data: { password: newPassword } });
      if (!set.ok) {
        // Numéro déjà vérifié : on demande seulement un autre mot de passe.
        clearPending();
        setPassword("");
        setConfirmation("");
        setStep("new-password");
        setStatus(null);
        setErrors({
          password:
            t("auth.compromisedPassword"),
        });
        return;
      }
      // Ouvre une session neuve avec le mot de passe définitif (la session
      // temporaire issue de l'OTP ne donne plus accès aux actions protégées).
      const login = await loginWithPassword({ data: { phone, password: newPassword } });
      if (!login.ok) throw new Error("login_after_setup_failed");
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.auth.setSession(login.session);
      if (error) throw error;
      clearPending();
      toast.success(successMessage);
      await navigate({ to: "/" });
    } catch {
      setErrors(
        step === "otp"
          ? { otp: t("auth.finishFailed") }
          : { password: t("auth.savePasswordFailed") },
      );
    }
  };

  const submitNewPassword = async () => {
    const nextErrors: FieldErrors = {};
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (password !== confirmation)
      nextErrors.confirmation = t("auth.passwordMismatch");
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    await finishPasswordSetup(password, t("auth.passwordChanged"));
    setBusy(false);
  };

  const updateOtp = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    const slots = otp.padEnd(6, " ").split("");
    if (!digits) {
      slots[index] = " ";
      setOtp(slots.join("").trimEnd());
      return;
    }
    for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
      slots[index + offset] = digits[offset];
    }
    setOtp(slots.join("").replace(/\s/g, "").slice(0, 6));
    otpRefs.current[Math.min(5, index + digits.length)]?.focus();
  };

  const goBack = () => {
    clearPending();
    if (step === "form") {
      switchMode("login");
      return;
    }
    setStep("form");
    setOtp("");
    setErrors({});
    setStatus(null);
    setDemoCode(null);
  };

  const title =
    step === "otp"
      ? mode === "signup"
        ? t("auth.verifyNumber")
        : t("auth.securityVerification")
      : step === "new-password"
        ? t("auth.newPassword")
        : mode === "signup"
          ? t("auth.createTitle")
          : mode === "recovery"
            ? t("auth.forgotPassword")
            : t("auth.loginTitle");

  const subtitle =
    step === "otp"
      ? mode === "signup" ? t("auth.otpSubtitleSignup", { phone: formatPhone(phone) }) : t("auth.otpSubtitleOther", { phone: formatPhone(phone) })
      : step === "new-password"
        ? t("auth.newPasswordSubtitle")
        : mode === "signup"
          ? t("auth.signupSubtitle")
          : mode === "recovery"
            ? t("auth.recoverySubtitle")
            : t("auth.loginSubtitle");

  return (
    <main className="relative min-h-[calc(100dvh-64px)] overflow-hidden px-4 py-6 sm:py-10">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url("/coup-sur-auth-background.webp")' }} aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-black/30" aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" aria-hidden />
      <section className="relative z-10 mx-auto w-full max-w-md" aria-labelledby="auth-title">
        <div className="mb-6 flex justify-center">
          <Link to="/" aria-label={t("auth.backHome")}>
            <img src={logoCoupSur} alt="Coup Sûr" className="h-16 w-16 object-contain" />
          </Link>
        </div>

        <div className="rounded-2xl border border-white/15 bg-white/[0.035] p-5 shadow-elevated backdrop-blur-xl ring-1 ring-white/[0.035] transition-[background-color,border-color,box-shadow] duration-300 focus-within:border-white/20 focus-within:bg-white/[0.055] focus-within:shadow-elevated sm:p-7">
          {(mode !== "login" || step !== "form") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft /> {t("auth.back")}
            </Button>
          )}

          <header className="mb-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent">
              {mode === "login" ? <LockKeyhole /> : mode === "signup" ? <UserPlus /> : <KeyRound />}
            </div>
            <h1 id="auth-title" className="font-display text-2xl font-bold text-foreground">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
          </header>

          {config.state === "checking" && (
            <div role="status" className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("auth.checkingServer")}
            </div>
          )}
          {config.state === "error" && (
            <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{config.message}</span>
              </div>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void checkConfig()}>
                <RefreshCw /> {t("auth.retry")}
              </Button>
            </div>
          )}
          <fieldset disabled={config.state !== "ready"} className="contents">


          {step === "form" && mode === "login" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitLogin();
              }}
              noValidate
            >
              <PhoneField phone={phone} onChange={setPhone} error={errors.phone} autoFocus />
              <PasswordField
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                error={errors.password}
                autoComplete="current-password"
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-accent"
                  onClick={() => switchMode("recovery")}
                >
                  {t("auth.forgotLink")}
                </Button>
              </div>
              <PrimaryButton busy={busy} idleLabel={t("auth.signIn")} busyLabel={t("auth.loggingIn")} />
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.noAccount")}{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-accent"
                  onClick={() => switchMode("signup")}
                >
                  {t("auth.createAccountLink")}
                </Button>
              </p>
            </form>
          )}

          {step === "form" && mode === "signup" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitSignup();
              }}
              noValidate
            >
              <div className="grid grid-cols-2 gap-3">
                <TextField label={t("auth.firstName")} value={firstName} onChange={setFirstName} error={errors.firstName} autoComplete="given-name" autoFocus />
                <TextField label={t("auth.lastName")} value={lastName} onChange={setLastName} error={errors.lastName} autoComplete="family-name" />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-foreground">{t("region")}</span>
                <select
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  aria-invalid={Boolean(errors.region)}
                  className="h-12 w-full rounded-md border border-input/80 bg-background/35 px-3 text-base text-foreground outline-none transition-all duration-200 hover:border-accent/45 hover:bg-background/45 focus:border-accent focus:bg-background/50"
                >
                  <option value="">{t("auth.regionRequired")}</option>
                  {NIGER_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {errors.region && <FieldError>{errors.region}</FieldError>}
              </label>
              <PhoneField phone={phone} onChange={setPhone} error={errors.phone} />
              <PasswordField
                label={t("auth.password")}
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                error={errors.password}
                autoComplete="new-password"
                showIndicator
              />
              <PasswordField
                label={t("auth.passwordConfirmation")}
                value={confirmation}
                onChange={setConfirmation}
                visible={showConfirmation}
                onToggle={() => setShowConfirmation((value) => !value)}
                error={errors.confirmation}
                autoComplete="new-password"
                valid={confirmation.length > 0 && confirmation === password}
              />
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)] transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                />
                <span>
                  {t("auth.acceptPrefix")}{" "}
                  <Link
                    to="/conditions"
                    className="font-semibold text-accent underline-offset-4 hover:underline"
                  >
                    {t("auth.terms")}
                  </Link>{" "}
                  {t("auth.acceptAnd")}{" "}
                  <Link
                    to="/confidentialite"
                    className="font-semibold text-accent underline-offset-4 hover:underline"
                  >
                    {t("auth.privacy")}
                  </Link>
                  .
                </span>
              </label>
              {errors.terms && <FieldError>{errors.terms}</FieldError>}
              <PrimaryButton busy={busy} idleLabel={t("auth.createAccount")} busyLabel={t("auth.creating")} />
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.hasAccount")}{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-accent"
                  onClick={() => switchMode("login")}
                >
                  {t("auth.signIn")}
                </Button>
              </p>
            </form>
          )}

          {step === "form" && mode === "recovery" && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitRecoveryPhone();
              }}
              noValidate
            >
              <PhoneField phone={phone} onChange={setPhone} error={errors.phone} autoFocus />
              {errors.otp && <Notice variant="error">{errors.otp}</Notice>}
              <PrimaryButton busy={busy} idleLabel={t("auth.continue")} busyLabel={t("auth.verifying")} />
            </form>
          )}

          {step === "otp" && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitOtp();
              }}
              noValidate
            >
              {demoCode && (
                <Notice variant="demo">
                  <strong>{t("auth.demoActive")}</strong>
                  <span className="mt-1 block">
                    {t("auth.yourCode")}{" "}
                    <span className="font-display text-lg font-bold tracking-[0.18em]">
                      {demoCode}
                    </span>
                    .
                  </span>
                </Notice>
              )}
              {!demoCode && status && <Notice variant="success">{status}</Notice>}
              <div>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(element) => {
                        otpRefs.current[index] = element;
                      }}
                      type="tel"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      aria-label={t("auth.digit", { n: index + 1 })}
                      aria-invalid={Boolean(errors.otp)}
                      value={otp[index] ?? ""}
                      disabled={busy || otpLocked}
                      onChange={(event) => updateOtp(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Backspace" && !otp[index] && index > 0)
                          otpRefs.current[index - 1]?.focus();
                      }}
                      onPaste={(event) => {
                        const pasted = event.clipboardData
                          .getData("text")
                          .replace(/\D/g, "")
                          .slice(0, 6);
                        if (!pasted) return;
                        event.preventDefault();
                        updateOtp(0, pasted);
                      }}
                      className="h-12 min-w-0 rounded-md border border-input/80 bg-background/30 text-center font-display text-xl font-bold text-foreground outline-none transition-all duration-200 hover:border-accent/45 hover:bg-background/40 focus:border-accent focus:bg-background/45 focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    />
                  ))}
                </div>
                {errors.otp && <FieldError>{errors.otp}</FieldError>}
              </div>
              {otpLocked && (
                <Notice variant="error">
                  {t("auth.locked")}
                </Notice>
              )}
              <PrimaryButton
                busy={busy}
                idleLabel={t("auth.verify")}
                busyLabel={t("auth.verifying")}
                disabled={otpLocked || otp.length !== 6}
              />
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full bg-transparent"
                disabled={busy || otpLocked || resendIn > 0}
                onClick={() => void sendCode(mode === "signup" ? "signup" : "recovery", true)}
              >
                <RefreshCw className={busy ? "animate-spin" : ""} />
                {resendIn > 0 ? t("auth.resendIn", { seconds: resendIn }) : t("auth.resend")}
              </Button>
            </form>
          )}

          {step === "new-password" && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitNewPassword();
              }}
              noValidate
            >
              {status && <Notice variant="success">{status}</Notice>}
              <PasswordField
                label={t("auth.newPassword")}
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
                error={errors.password}
                autoComplete="new-password"
                showIndicator
                autoFocus
              />
              <PasswordField
                label={t("auth.confirmPassword")}
                value={confirmation}
                onChange={setConfirmation}
                visible={showConfirmation}
                onToggle={() => setShowConfirmation((value) => !value)}
                error={errors.confirmation}
                autoComplete="new-password"
                valid={confirmation.length > 0 && confirmation === password}
              />
              <PrimaryButton
                busy={busy}
                idleLabel={t("auth.savePassword")}
                busyLabel={t("auth.savingPassword")}
              />
            </form>
          )}
          </fieldset>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          {t("auth.protectedBySupabase")}
        </p>
      </section>
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  autoComplete,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-foreground">{label}</span>
      <input
        type="text"
        value={value}
        maxLength={80}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="h-12 w-full rounded-md border border-input/80 bg-background/35 px-3 text-base text-foreground outline-none transition-all duration-200 hover:border-accent/45 hover:bg-background/45 focus:border-accent focus:bg-background/50"
      />
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function PhoneField({
  phone,
  onChange,
  error,
  autoFocus = false,
}: {
  phone: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{t("phone")}</span>
      <span
        className={`flex h-12 items-center rounded-md border bg-background/35 transition-all duration-200 hover:border-accent/45 hover:bg-background/45 focus-within:bg-background/50 focus-within:ring-2 focus-within:ring-accent/20 ${error ? "border-destructive" : "border-input/80 focus-within:border-accent"}`}
      >
        <span className="flex h-full items-center gap-2 border-r border-input px-3 font-semibold text-foreground">
          <Phone className="h-4 w-4 text-accent" /> +227
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={8}
          autoFocus={autoFocus}
          value={phone}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))}
          placeholder="90 00 00 00"
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent px-3 text-base font-semibold text-foreground outline-none placeholder:text-muted-foreground/60"
        />
      </span>
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  error,
  autoComplete,
  showIndicator = false,
  valid = false,
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  error?: string;
  autoComplete: "current-password" | "new-password";
  showIndicator?: boolean;
  valid?: boolean;
  autoFocus?: boolean;
}) {
  const validLength = PasswordSchema.safeParse(value).success;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-foreground">{label}</span>
      <span
        className={`flex h-12 items-center rounded-md border bg-background/35 transition-all duration-200 hover:border-accent/45 hover:bg-background/45 focus-within:bg-background/50 focus-within:ring-2 focus-within:ring-accent/20 ${error ? "border-destructive" : "border-input/80 focus-within:border-accent"}`}
      >
        <KeyRound className="ml-3 h-4 w-4 shrink-0 text-accent" />
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("auth.passwordMinHint")}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="mr-1 h-10 w-10 text-muted-foreground"
          aria-label={visible ? t("auth.hidePassword") : t("auth.showPassword")}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </span>
      {showIndicator && value.length > 0 && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-xs ${validLength ? "text-success" : "text-muted-foreground"}`}
        >
          {validLength ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {validLength ? t("auth.passwordValid") : t("auth.passwordMinHint")}
        </p>
      )}
      {valid && !error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> {t("auth.passwordsMatch")}
        </p>
      )}
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function PrimaryButton({
  busy,
  idleLabel,
  busyLabel,
  disabled = false,
}: {
  busy: boolean;
  idleLabel: string;
  busyLabel: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" size="lg" disabled={busy || disabled} className="h-12 w-full font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0">
      {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
      {busy ? busyLabel : idleLabel}
    </Button>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  );
}

function Notice({
  children,
  variant,
}: {
  children: ReactNode;
  variant: "error" | "success" | "demo";
}) {
  const styles =
    variant === "error"
      ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
      : variant === "demo"
        ? "border-warning/50 bg-warning/10 text-foreground"
        : "border-success/40 bg-success/10 text-foreground";
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`rounded-md border p-3 text-sm leading-5 ${styles}`}
    >
      {children}
    </div>
  );
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "").slice(0, 8);
  return `+227 ${clean.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}
