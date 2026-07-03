import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, ShieldAlert, Loader2, ArrowRight, KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/account";

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
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = (e.clientX / window.innerWidth - 0.5) * 2;
        const ny = (e.clientY / window.innerHeight - 0.5) * 2;
        setParallax({ x: nx, y: ny });
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

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
    <div className="cs-auth-scope relative isolate min-h-[calc(100vh-64px)] overflow-hidden">
      <PremiumBackdrop parallax={parallax} />

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 py-6 sm:py-10">
        <header className="mb-5 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
            <span className="font-display text-2xl font-black text-white">C<span className="text-[#00C896]">S</span></span>
          </div>
          <h1 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Bienvenue sur <span className="text-[#00C896]">Coup&nbsp;Sûr</span>
          </h1>
          <p className="mt-1.5 text-sm text-white/70">Connexion sécurisée par SMS · rapide, chiffrée, sans mot de passe.</p>
        </header>

        <div
          className="cs-phone relative w-full max-w-[380px]"
          style={{ transform: `perspective(1200px) rotateX(${parallax.y * -1.5}deg) rotateY(${parallax.x * 1.5}deg)` }}
        >
          <div className="cs-phone-shell">
            <div className="cs-phone-screen">
              <div className="cs-notch" aria-hidden />
              <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-white/70">
                <span>9:41</span>
                <span className="tracking-widest">COUP SÛR</span>
                <span>••• 100%</span>
              </div>

              <div className="px-5 pt-4 pb-6 space-y-4">
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
              </div>
            </div>
          </div>
          <div className="cs-phone-reflection" aria-hidden />
        </div>

        <p className="mt-6 max-w-[380px] text-center text-[11px] text-white/60 leading-relaxed">
          En vous connectant, vous acceptez nos{" "}
          <a href="/conditions" className="font-semibold text-[#00C896] hover:underline">Conditions d'utilisation</a>{" "}
          et notre{" "}
          <a href="/confidentialite" className="font-semibold text-[#00C896] hover:underline">Politique de confidentialité</a>.
        </p>
      </div>

      <style>{CS_AUTH_CSS}</style>
    </div>
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

function PremiumBackdrop({ parallax }: { parallax: { x: number; y: number } }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#009B77_0%,_#007A67_35%,_#006B5B_65%,_#004a3f_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_45%,_rgba(0,0,0,0.55)_100%)]" />
      <svg className="absolute inset-0 h-full w-full opacity-[0.07] mix-blend-overlay">
        <filter id="cs-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0.2  0 0 0 0 0.6  0 0 0 0 0.5  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cs-grain)" />
      </svg>
      <div className="cs-spheres" style={{ transform: `translate3d(${parallax.x * 8}px, ${parallax.y * 8}px, 0)` }}>
        <span className="cs-sphere s1" />
        <span className="cs-sphere s2" />
        <span className="cs-sphere s3" />
        <span className="cs-sphere s4" />
        <span className="cs-sphere s5" />
        <span className="cs-sphere s6 orange" />
        <span className="cs-sphere s7" />
        <span className="cs-sphere s8 orange" />
      </div>
    </div>
  );
}

const CS_AUTH_CSS = `
.cs-auth-scope { background-color: #004a3f; }
.cs-spheres { position: absolute; inset: -10%; transition: transform 300ms ease-out; will-change: transform; }
.cs-sphere {
  position: absolute; display: block; border-radius: 9999px;
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%),
    radial-gradient(circle at 70% 75%, rgba(0,0,0,0.35), rgba(0,0,0,0) 55%),
    radial-gradient(circle at 50% 50%, #00C896, #007A67 55%, #005a4b 100%);
  box-shadow: 0 30px 60px -20px rgba(0,0,0,0.55), inset 0 -8px 24px rgba(0,0,0,0.35);
  filter: blur(0.4px);
  animation: cs-float 18s ease-in-out infinite;
  will-change: transform;
  opacity: 0.85;
}
.cs-sphere.orange {
  background:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), rgba(255,255,255,0) 40%),
    radial-gradient(circle at 70% 75%, rgba(0,0,0,0.35), rgba(0,0,0,0) 55%),
    radial-gradient(circle at 50% 50%, #FFB870, #FF8A00 55%, #7a3a00 100%);
  opacity: 0.28;
  filter: blur(1px);
}
.cs-sphere.s1 { width: 320px; height: 320px; top: -80px; left: -80px; animation-duration: 22s; }
.cs-sphere.s2 { width: 180px; height: 180px; top: 15%; right: -60px; animation-duration: 26s; animation-delay: -4s; }
.cs-sphere.s3 { width: 100px; height: 100px; top: 55%; left: 8%; animation-duration: 20s; animation-delay: -8s; }
.cs-sphere.s4 { width: 220px; height: 220px; bottom: -80px; right: 12%; animation-duration: 28s; animation-delay: -2s; }
.cs-sphere.s5 { width: 70px; height: 70px; top: 22%; left: 45%; animation-duration: 16s; animation-delay: -6s; opacity: 0.7; }
.cs-sphere.s6 { width: 140px; height: 140px; bottom: 10%; left: -40px; animation-duration: 30s; }
.cs-sphere.s7 { width: 60px; height: 60px; top: 70%; right: 30%; animation-duration: 14s; animation-delay: -10s; opacity: 0.6; }
.cs-sphere.s8 { width: 90px; height: 90px; top: 8%; right: 30%; animation-duration: 24s; }
@keyframes cs-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  25%      { transform: translate3d(10px, -14px, 0) scale(1.03); }
  50%      { transform: translate3d(-8px, 12px, 0) scale(0.98); }
  75%      { transform: translate3d(-14px, -6px, 0) scale(1.02); }
}
.cs-phone { transition: transform 200ms ease-out; will-change: transform; }
.cs-phone-shell {
  position: relative;
  border-radius: 44px;
  padding: 6px;
  background: linear-gradient(155deg, rgba(255,255,255,0.35), rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.18) 100%);
  box-shadow:
    0 40px 80px -30px rgba(0, 0, 0, 0.65),
    0 12px 30px -12px rgba(0, 0, 0, 0.55),
    inset 0 0 0 1px rgba(255,255,255,0.12);
}
.cs-phone-screen {
  position: relative;
  border-radius: 38px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(0, 200, 150, 0.20), transparent 60%),
    linear-gradient(180deg, rgba(0, 40, 34, 0.85), rgba(0, 20, 17, 0.92));
  backdrop-filter: blur(18px);
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -20px 40px rgba(0,0,0,0.35);
}
.cs-phone-screen::before {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.10) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%);
  pointer-events: none;
}
.cs-notch {
  position: absolute; top: 6px; left: 50%; transform: translateX(-50%);
  width: 96px; height: 22px; border-radius: 0 0 14px 14px;
  background: linear-gradient(180deg, #000, #0a0a0a);
  box-shadow: inset 0 -2px 4px rgba(255,255,255,0.05);
  z-index: 2;
}
.cs-notch::after {
  content: ""; position: absolute; right: 14px; top: 8px;
  width: 8px; height: 8px; border-radius: 9999px;
  background: radial-gradient(circle at 30% 30%, #005a4b, #002019);
  box-shadow: 0 0 0 1px rgba(0,200,150,0.35);
}
.cs-phone-reflection {
  position: absolute; left: 8%; right: 8%; bottom: -30px; height: 40px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,0.55), transparent 70%);
  filter: blur(8px); opacity: 0.7;
}
.cs-field { display: block; }
.cs-field-label {
  display: block;
  font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,255,255,0.55);
  margin-bottom: 8px;
}
.cs-field-wrap {
  display: flex; align-items: center; gap: 10px;
  border-radius: 14px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  transition: border-color 200ms ease, background-color 200ms ease, box-shadow 200ms ease;
}
.cs-field-wrap:focus-within {
  border-color: #00C896;
  background: rgba(0, 200, 150, 0.08);
  box-shadow: 0 0 0 4px rgba(0, 200, 150, 0.18);
}
.cs-otp {
  height: 56px; width: 100%;
  border-radius: 14px;
  background: rgba(255,255,255,0.06);
  border: 1.5px solid rgba(255,255,255,0.15);
  color: #fff;
  text-align: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 26px;
  font-variant-numeric: tabular-nums;
  outline: none;
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease, transform 100ms ease;
}
.cs-otp:focus {
  border-color: #00C896;
  background: rgba(0, 200, 150, 0.10);
  box-shadow: 0 0 0 4px rgba(0, 200, 150, 0.20);
}
.cs-cta {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 14px 20px;
  border-radius: 9999px;
  color: #fff;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 14px;
  background: linear-gradient(180deg, #FFA23A 0%, #FF8A00 55%, #E67A00 100%);
  box-shadow:
    0 12px 28px -10px rgba(255, 138, 0, 0.55),
    0 4px 10px -3px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -2px 0 rgba(0,0,0,0.15);
  transition: transform 120ms ease, filter 150ms ease, box-shadow 200ms ease;
  will-change: transform;
}
.cs-cta:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.cs-cta:active:not(:disabled) { transform: translateY(1px) scale(0.99); }
.cs-cta:disabled { opacity: 0.55; cursor: not-allowed; }
.cs-cta-locked {
  background: linear-gradient(180deg, #ef4444, #b91c1c);
  box-shadow: 0 10px 24px -10px rgba(239,68,68,0.5), inset 0 1px 0 rgba(255,255,255,0.25);
}
@media (prefers-reduced-motion: reduce) {
  .cs-sphere, .cs-spheres, .cs-phone { animation: none !important; transition: none !important; transform: none !important; }
}
`;