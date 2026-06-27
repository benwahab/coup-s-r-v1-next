import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { checkRate, logAuthEvent, pushAttempt, type RateCheck } from "./auth-logs";

const KEY = "lonani.auth";
const SESSION_KEY = "lonani.session";
const LOCK_MS = 60 * 60 * 1000; // 1h
const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 min d'inactivité

interface AuthState {
  failedAttempts: number;   // current cycle (0..3)
  lockCount: number;        // number of times the account got locked
  lockedUntil: number | null; // ms epoch; if Infinity-like (=-1) → permanent
  lastPhone?: string;
}

interface Session { phone: string; startedAt: number; lastActivity: number }

interface Ctx extends AuthState {
  authed: boolean;
  session: Session | null;
  sessionRemainingMs: () => number;
  touchSession: () => void;
  logout: (reason?: "user" | "expired") => void;
  requestOtp: (phone: string) => Promise<{ ok: true; code: string } | { ok: false; rate: RateCheck }>; // returns mock code
  verifyOtp: (phone: string, code: string, accountPhone: string | null) => {
    ok: boolean;
    reason?: "wrong-phone" | "wrong-code" | "locked" | "permanent" | "rate-limited";
    remaining?: number; // attempts left
    lockedUntil?: number | null;
    rate?: RateCheck;
  };
  resetLock: () => void;
  remainingLockMs: () => number;
  isPermanent: () => boolean;
}

const defaultState: AuthState = { failedAttempts: 0, lockCount: 0, lockedUntil: null };

const AuthCtx = createContext<Ctx | null>(null);

function load(): AuthState {
  if (typeof window === "undefined") return defaultState;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch { return defaultState; }
}
function save(s: AuthState) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}
function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (Date.now() - s.lastActivity > SESSION_IDLE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch { return null; }
}
function saveSession(s: Session | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);
  const [session, setSession] = useState<Session | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    setState(load());
    setSession(loadSession());
  }, []);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-expire session après idle 30 min
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      if (Date.now() - session.lastActivity > SESSION_IDLE_MS) {
        logAuthEvent("session-expired", session.phone);
        saveSession(null);
        setSession(null);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [session]);

  // "Activité" globale qui rafraîchit la session glissante
  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      const next = { ...session, lastActivity: Date.now() };
      saveSession(next);
      setSession(next);
    };
    // throttle 30s
    let last = 0;
    const onAct = () => {
      const now = Date.now();
      if (now - last > 30_000) { last = now; refresh(); }
    };
    window.addEventListener("click", onAct);
    window.addEventListener("keydown", onAct);
    return () => {
      window.removeEventListener("click", onAct);
      window.removeEventListener("keydown", onAct);
    };
  }, [session]);

  const isPermanent = useCallback(() => state.lockedUntil === -1, [state.lockedUntil]);
  const remainingLockMs = useCallback(() => {
    if (!state.lockedUntil) return 0;
    if (state.lockedUntil === -1) return -1;
    return Math.max(0, state.lockedUntil - Date.now());
  }, [state.lockedUntil]);

  const sessionRemainingMs = useCallback(() => {
    if (!session) return 0;
    return Math.max(0, SESSION_IDLE_MS - (Date.now() - session.lastActivity));
  }, [session]);

  const touchSession = useCallback(() => {
    if (!session) return;
    const next = { ...session, lastActivity: Date.now() };
    saveSession(next);
    setSession(next);
  }, [session]);

  const logout = useCallback((reason: "user" | "expired" = "user") => {
    if (session) logAuthEvent(reason === "expired" ? "session-expired" : "logout", session.phone);
    saveSession(null);
    setSession(null);
  }, [session]);

  const requestOtp = useCallback(async (phone: string) => {
    const rate = checkRate(phone);
    if (!rate.ok) {
      logAuthEvent("rate-limited", phone, `request blocked (${rate.reason})`);
      return { ok: false as const, rate };
    }
    pushAttempt(phone);
    logAuthEvent("otp-request", phone);
    // MOCK: code dérivé du numéro (déterministe pour démo)
    const code = String(((parseInt(phone.replace(/\D/g, "").slice(-6) || "0", 10) * 7) % 900000 + 100000));
    if (typeof window !== "undefined") {
      sessionStorage.setItem("lonani.otp", code);
      // eslint-disable-next-line no-console
      console.info("[LoNaNi DEMO] Code OTP envoyé au", phone, ":", code);
    }
    return { ok: true as const, code };
  }, []);

  const verifyOtp: Ctx["verifyOtp"] = useCallback((phone, code, accountPhone) => {
    const rate = checkRate(phone);
    if (!rate.ok) {
      logAuthEvent("rate-limited", phone, `verify blocked (${rate.reason})`);
      return { ok: false, reason: "rate-limited", rate };
    }
    // already permanently locked
    if (state.lockedUntil === -1) { logAuthEvent("locked", phone, "permanent"); return { ok: false, reason: "permanent" }; }
    // timed lock active
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      logAuthEvent("locked", phone, "1h");
      return { ok: false, reason: "locked", lockedUntil: state.lockedUntil };
    }
    pushAttempt(phone);
    const expected = typeof window !== "undefined" ? sessionStorage.getItem("lonani.otp") : null;
    const phoneOk = !accountPhone || accountPhone === phone;
    const codeOk = expected && code === expected;
    if (phoneOk && codeOk) {
      const fresh = { ...defaultState, lockCount: state.lockCount };
      setState(fresh); save(fresh);
      const s: Session = { phone, startedAt: Date.now(), lastActivity: Date.now() };
      saveSession(s); setSession(s);
      logAuthEvent("verify-ok", phone);
      return { ok: true };
    }
    const failed = state.failedAttempts + 1;
    logAuthEvent("verify-fail", phone, phoneOk ? "wrong-code" : "wrong-phone");
    if (failed >= 3) {
      const newLockCount = state.lockCount + 1;
      const lockedUntil = newLockCount >= 2 ? -1 : Date.now() + LOCK_MS;
      const next: AuthState = { failedAttempts: 0, lockCount: newLockCount, lockedUntil, lastPhone: phone };
      setState(next); save(next);
      logAuthEvent("locked", phone, lockedUntil === -1 ? "permanent" : "1h");
      return { ok: false, reason: lockedUntil === -1 ? "permanent" : "locked", lockedUntil };
    }
    const next: AuthState = { ...state, failedAttempts: failed, lastPhone: phone };
    setState(next); save(next);
    return {
      ok: false,
      reason: phoneOk ? "wrong-code" : "wrong-phone",
      remaining: 3 - failed,
    };
  }, [state]);

  const resetLock = useCallback(() => {
    const fresh = defaultState;
    setState(fresh); save(fresh);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        ...state,
        authed: !!session,
        session,
        sessionRemainingMs,
        touchSession,
        logout,
        requestOtp,
        verifyOtp,
        resetLock,
        remainingLockMs,
        isPermanent,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}