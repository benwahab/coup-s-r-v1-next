import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, ShieldAlert, Loader2, ArrowRight, KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";
import { PremiumPhoneCard } from "@/components/PremiumPhoneCard";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Coup Sûr" },
      { name: "description", content: "Connectez-vous à Coup Sûr avec votre numéro de téléphone et un code OTP envoyé par SMS." },
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
  const [resendIn, setResendIn] = useState(0);
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
    if (!/^\d{8}$/.test(phone)) { setError("Saisissez un numéro à 8 chiffres."); return; }
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
      setDemoCode(res.code);
      setStep("otp");
      setInfo("Code envoyé par SMS au " + phone);
      setResendIn(60);
    } finally { setSending(false); }
  };

  const submitOtp = async () => {
    setError(null); setInfo(null);
    if (otp.length !== 6) { setError("Le code OTP fait 6 chiffres."); return; }
    const res = await verifyOtp(phone, otp, account?.phone ?? null);
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
    <PremiumPhoneCard>
      <div className="pt-4 space-y-4">
        <div className="text-center pb-2">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
            <span className="font-display text-2xl font-black text-white">C<span className="text-[#00C896]">S</span></span>
          </div>
          <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-white">
            COUP <span className="text-[#00C896]">SÛR</span>
          </h1>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00C896]/90">Pariez. Analysez. Gagnez.</p>
          <p className="mt-3 font-display text-xl font-extrabold text-white">Bienvenue</p>
          <p className="mt-0.5 text-[12px] text-white/60">Connectez-vous à votre compte pour continuer.</p>
        </div>
                {locked && (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-red-100 backdrop-blur-sm">
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
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Étape 1 · Identification</div>
                      <h2 className="font-display text-xl font-extrabold text-white">Votre numéro</h2>
                      <p className="mt-0.5 text-[12px] text-white/60">Un code SMS vous sera envoyé instantanément.</p>
                    </div>
                    <label className="cs-field group block">
                      <span className="cs-field-label">Numéro de téléphone</span>
                      <div className="cs-field-wrap">
                        <Phone className="h-5 w-5 text-white/60 group-focus-within:text-[#00C896] transition-colors" />
                        <span className="text-sm font-semibold text-white/70">+227</span>
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
                          className="flex-1 bg-transparent text-lg font-bold tracking-wider text-white placeholder-white/30 outline-none disabled:opacity-50"
                        />
                      </div>
                    </label>
                    {error && <Alert variant="error">{error}</Alert>}
                    <button
                      onClick={sendCode}
                      disabled={locked || sending || phone.length !== 8}
                      className={["cs-cta", locked ? "cs-cta-locked" : ""].join(" ")}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      {locked ? "Connexion bloquée" : "Recevoir le code SMS"}
                      {!locked && !sending && <ArrowRight className="h-4 w-4" />}
                    </button>
                    <p className="text-[11px] text-white/60 text-center">
                      Pas encore de compte ? <a href="/compte" className="font-bold text-[#00C896] underline-offset-2 hover:underline">Créer un compte</a>
                    </p>
                    <p className="text-[11px] text-white/50 text-center">
                      Tentatives restantes : <span className="font-bold text-white/80">{Math.max(0, 3 - failedAttempts)} / 3</span>
                    </p>
                  </>
                )}

                {step === "otp" && (
                  <>
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Étape 2 · Vérification</div>
                      <h2 className="font-display text-xl font-extrabold text-white">Entrez votre code</h2>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70 backdrop-blur">
                      Code envoyé au <span className="font-bold text-white">+227 {phone}</span>.{" "}
                      <button onClick={() => { setStep("phone"); setOtp(""); }} className="font-bold text-[#00C896] hover:underline">Modifier</button>
                    </div>

                    {autoRead === "listening" && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lecture automatique du SMS en cours…
                      </div>
                    )}
                    {autoRead === "ok" && (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Code lu automatiquement.
                      </div>
                    )}
                    {autoRead === "unavailable" && (
                      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/70">
                        <AlertTriangle className="h-3.5 w-3.5" /> Lecture automatique indisponible. Saisissez le code manuellement.
                      </div>
                    )}

                    <div className="block">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-white/80">Code SMS</span>
                        <span className="text-[11px] text-white/50">6 chiffres</span>
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
                            className="cs-otp"
                          />
                        ))}
                      </div>
                    </div>

                    {demoCode && (
                      <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 text-center text-[11px] text-white/60">
                        Mode démo · code SMS simulé : <span className="font-bold tabular-nums text-white">{demoCode}</span>
                      </div>
                    )}

                    {error && <Alert variant="error">{error}</Alert>}
                    {info && !error && <Alert variant="success">{info}</Alert>}

                    <button
                      onClick={submitOtp}
                      disabled={locked || otp.length !== 6}
                      className="cs-cta"
                    >
                      Se connecter <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={sendCode}
                      disabled={locked || sending || resendIn > 0}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white/90 backdrop-blur transition hover:bg-white/10 disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 ${sending ? "animate-spin" : ""}`} />
                      {resendIn > 0 ? `Renvoyer le code dans ${resendIn}s` : "Renvoyer le code SMS"}
                    </button>
                  </>
                )}
        <p className="pt-2 text-center text-[11px] text-white/60 leading-relaxed">
          En vous connectant, vous acceptez nos{" "}
          <a href="/conditions" className="font-semibold text-[#00C896] hover:underline">Conditions d'utilisation</a>{" "}
          et notre{" "}
          <a href="/confidentialite" className="font-semibold text-[#00C896] hover:underline">Politique de confidentialité</a>.
        </p>
      </div>
    </PremiumPhoneCard>
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