import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "lonani.auth";
const LOCK_MS = 60 * 60 * 1000; // 1h

interface AuthState {
  failedAttempts: number;   // current cycle (0..3)
  lockCount: number;        // number of times the account got locked
  lockedUntil: number | null; // ms epoch; if Infinity-like (=-1) → permanent
  lastPhone?: string;
}

interface Ctx extends AuthState {
  authed: boolean;
  setAuthed: (v: boolean) => void;
  requestOtp: (phone: string) => Promise<string>; // returns mock code
  verifyOtp: (phone: string, code: string, accountPhone: string | null) => {
    ok: boolean;
    reason?: "wrong-phone" | "wrong-code" | "locked" | "permanent";
    remaining?: number; // attempts left
    lockedUntil?: number | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(defaultState);
  const [authed, setAuthed] = useState(false);
  const [, force] = useState(0);

  useEffect(() => { setState(load()); }, []);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isPermanent = useCallback(() => state.lockedUntil === -1, [state.lockedUntil]);
  const remainingLockMs = useCallback(() => {
    if (!state.lockedUntil) return 0;
    if (state.lockedUntil === -1) return -1;
    return Math.max(0, state.lockedUntil - Date.now());
  }, [state.lockedUntil]);

  const requestOtp = useCallback(async (phone: string) => {
    // MOCK: code dérivé du numéro (déterministe pour démo)
    const code = String(((parseInt(phone.replace(/\D/g, "").slice(-6) || "0", 10) * 7) % 900000 + 100000));
    if (typeof window !== "undefined") {
      sessionStorage.setItem("lonani.otp", code);
      // eslint-disable-next-line no-console
      console.info("[LoNaNi DEMO] Code OTP envoyé au", phone, ":", code);
    }
    return code;
  }, []);

  const verifyOtp: Ctx["verifyOtp"] = useCallback((phone, code, accountPhone) => {
    // already permanently locked
    if (state.lockedUntil === -1) return { ok: false, reason: "permanent" };
    // timed lock active
    if (state.lockedUntil && Date.now() < state.lockedUntil) {
      return { ok: false, reason: "locked", lockedUntil: state.lockedUntil };
    }
    const expected = typeof window !== "undefined" ? sessionStorage.getItem("lonani.otp") : null;
    const phoneOk = !accountPhone || accountPhone === phone;
    const codeOk = expected && code === expected;
    if (phoneOk && codeOk) {
      const fresh = { ...defaultState, lockCount: state.lockCount };
      setState(fresh); save(fresh);
      setAuthed(true);
      return { ok: true };
    }
    const failed = state.failedAttempts + 1;
    if (failed >= 3) {
      const newLockCount = state.lockCount + 1;
      const lockedUntil = newLockCount >= 2 ? -1 : Date.now() + LOCK_MS;
      const next: AuthState = { failedAttempts: 0, lockCount: newLockCount, lockedUntil, lastPhone: phone };
      setState(next); save(next);
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
        authed,
        setAuthed,
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