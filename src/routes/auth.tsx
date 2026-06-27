import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, Lock, ShieldAlert, Loader2, ArrowRight, KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — LoNaNi" },
      { name: "description", content: "Connectez-vous à LoNaNi avec votre numéro de téléphone et un code OTP envoyé par SMS." },
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
  const { account } = useAccount();
  const { requestOtp, verifyOtp, remainingLockMs, isPermanent, failedAttempts } = useAuth();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [otp, setOtp] = useState("");
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [autoRead, setAutoRead] = useState<"idle" | "listening" | "ok" | "unavailable">("idle");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0); // secondes restantes avant de pouvoir renvoyer
  const abortRef = useRef<AbortController | null>(null);

  const lockMs = remainingLockMs();
  const permanent = isPermanent();
  const locked = permanent || lockMs > 0;

  // Web OTP API auto-read
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
        if (code) {
          setOtp(code);
          setAutoRead("ok");
        }
      })
      .catch(() => { /* user denied / timeout */ });
    return () => ac.abort();
  }, [step]);

  // Décompte renvoi
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const sendCode = async () => {
    setError(null);
    if (!/^\d{8}$/.test(phone)) {
      setError("Saisissez un numéro à 8 chiffres.");
      return;
    }
    setSending(true);
    try {
      const res = await requestOtp(phone);
      if (!res.ok) {
        const mins = Math.ceil((res.rate.retryInMs ?? 60_000) / 60_000);
        setError(
          res.rate.reason === "phone"
            ? `Trop de tentatives depuis ce numéro. Réessayez dans ~${mins} min.`
            : `Trop de tentatives depuis cet appareil. Réessayez dans ~${mins} min.`
        );
        return;
      }
      setDemoCode(res.code); // démo uniquement
      setStep("otp");
      setInfo("Code envoyé par SMS au " + phone);
      setResendIn(60);
    } finally { setSending(false); }
  };

  const submitOtp = () => {
    setError(null); setInfo(null);
    if (otp.length !== 6) { setError("Le code OTP fait 6 chiffres."); return; }
    const res = verifyOtp(phone, otp, account?.phone ?? null);
    if (res.ok) {
      setInfo("Connexion réussie. Redirection...");
      setTimeout(() => navigate({ to: "/" }), 600);
      return;
    }
    if (res.reason === "rate-limited") {
      const mins = Math.ceil(((res.rate?.retryInMs) ?? 60_000) / 60_000);
      setError(`Trop de tentatives. Réessayez dans ~${mins} min.`);
    } else if (res.reason === "permanent") {
      setError("Compte bloqué. Veuillez contacter le service clientèle.");
    } else if (res.reason === "locked") {
      setError("Trop de tentatives. Compte bloqué pendant 1 heure.");
    } else if (res.reason === "wrong-phone") {
      setError(`Ce numéro ne correspond pas au compte enregistré. Il vous reste ${res.remaining} tentative(s).`);
    } else {
      setError(`Code OTP incorrect. Il vous reste ${res.remaining} tentative(s).`);
    }
    setOtp("");
  };

  // Met à jour les 6 cases à partir d'une valeur OTP (paste, autofill...)
  const setDigit = (idx: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      const arr = otp.split("");
      arr[idx] = "";
      setOtp(arr.join("").slice(0, 6));
      return;
    }
    // Si on colle plusieurs chiffres, on remplit à partir de idx
    const arr = otp.padEnd(6, " ").split("");
    for (let i = 0; i < clean.length && idx + i < 6; i++) arr[idx + i] = clean[i];
    const next = arr.join("").replace(/\s/g, "").slice(0, 6);
    setOtp(next);
    const focusIdx = Math.min(5, idx + clean.length);
    inputsRef.current[focusIdx]?.focus();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
        <div className="bg-hero p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold-gradient text-[var(--gold-foreground)] font-display text-xl font-extrabold shadow-gold">L</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">LoNaNi</div>
              <div className="font-display text-xl font-bold">Connexion sécurisée</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/70">
            Connectez-vous avec votre numéro. Un code OTP vous sera envoyé par SMS.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {locked && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">
              <div className="flex items-center gap-2 font-bold">
                <ShieldAlert className="h-5 w-5" />
                {permanent ? "Compte bloqué définitivement" : "Compte bloqué temporairement"}
              </div>
              {permanent ? (
                <p className="mt-2 text-sm">
                  Contactez le service clientèle au <span className="font-bold">7000</span> pour débloquer votre compte.
                </p>
              ) : (
                <p className="mt-2 text-sm tabular-nums">
                  Réessayez dans <span className="font-display font-extrabold text-lg">{fmtMs(lockMs)}</span>
                </p>
              )}
            </div>
          )}

          {step === "phone" && (
            <>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Numéro de téléphone</span>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-semibold text-muted-foreground">+227</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="90 00 00 00"
                    disabled={locked}
                    className="flex-1 bg-transparent text-lg font-bold tracking-wider outline-none disabled:opacity-50"
                  />
                </div>
              </label>
              {error && <Alert variant="error">{error}</Alert>}
              <button
                onClick={sendCode}
                disabled={locked || sending || phone.length !== 8}
                className={[
                  "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-bold transition",
                  locked
                    ? "bg-red-500 text-white"
                    : "bg-gold-gradient text-[var(--gold-foreground)] shadow-gold hover:brightness-110",
                  "disabled:opacity-60",
                ].join(" ")}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {locked ? "Connexion bloquée" : "Recevoir le code SMS"}
                {!locked && !sending && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                Pas encore de compte ? <a href="/compte" className="font-bold text-primary underline-offset-2 hover:underline">Créer un compte</a>
              </p>
              <p className="text-[11px] text-muted-foreground text-center">
                Tentatives restantes : <span className="font-bold">{Math.max(0, 3 - failedAttempts)} / 3</span>
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
                Code envoyé au <span className="font-bold text-foreground">+227 {phone}</span>.{" "}
                <button onClick={() => { setStep("phone"); setOtp(""); }} className="font-bold text-primary hover:underline">Modifier</button>
              </div>

              {autoRead === "listening" && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lecture automatique du SMS en cours…
                </div>
              )}
              {autoRead === "ok" && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Code lu automatiquement.
                </div>
              )}
              {autoRead === "unavailable" && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" /> Lecture automatique indisponible. Saisissez le code manuellement.
                </div>
              )}

              <div className="block">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-widest text-foreground">Code SMS</span>
                  <span className="text-[11px] text-muted-foreground">6 chiffres reçus par SMS</span>
                </div>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputsRef.current[i] = el; }}
                      type="tel"
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      maxLength={1}
                      aria-label={`Chiffre ${i + 1} sur 6`}
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
                      className="h-16 w-full rounded-2xl border-2 border-border bg-background text-center font-display text-3xl font-extrabold tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
                    />
                  ))}
                </div>
              </div>

              {demoCode && (
                <div className="rounded-xl border border-dashed border-border bg-secondary/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
                  Mode démo · code SMS simulé : <span className="font-bold tabular-nums text-foreground">{demoCode}</span>
                </div>
              )}

              {error && <Alert variant="error">{error}</Alert>}
              {info && !error && <Alert variant="success">{info}</Alert>}

              <button
                onClick={submitOtp}
                disabled={locked || otp.length !== 6}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-gold-gradient px-5 py-4 text-base font-extrabold uppercase tracking-wide text-[var(--gold-foreground)] shadow-gold transition hover:brightness-110 disabled:opacity-60"
              >
                Se connecter <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={sendCode}
                disabled={locked || sending || resendIn > 0}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-border bg-background px-5 py-3 text-sm font-bold text-foreground transition hover:border-primary/50 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} />
                {resendIn > 0
                  ? `Renvoyer le code dans ${resendIn}s`
                  : "Renvoyer le code SMS"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Alert({ children, variant }: { children: React.ReactNode; variant: "error" | "success" }) {
  const cls = variant === "error"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return <div className={`flex items-start gap-2 rounded-xl border ${cls} p-3 text-sm`}>
    {variant === "error" ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
    <span>{children}</span>
  </div>;
}