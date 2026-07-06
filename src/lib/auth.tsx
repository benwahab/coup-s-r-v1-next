import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { checkRate, logAuthEvent, pushAttempt, type RateCheck } from "./auth-logs";
import { supabase } from "@/integrations/supabase/client";
import { sendOtp, verifyOtp as verifyOtpFn } from "./otp.functions";
import { useAccount } from "./account";

const KEY = "lonani.auth";
const LOCK_MS = 60 * 60 * 1000; // 1h
// Session Supabase — reste active jusqu'à une déconnexion explicite (refresh auto).

function stripPrefix(e164OrLocal: string): string {
  const s = (e164OrLocal ?? "").replace(/\D/g, "");
  if (s.startsWith("227") && s.length === 11) return s.slice(3);
  return s.slice(-8);
}

interface AuthState {
  failedAttempts: number;   // current cycle (0..3)
  lockCount: number;        // number of times the account got locked
  lockedUntil: number | null; // ms epoch; if Infinity-like (=-1) → permanent
  lastPhone?: string;
}

interface Session { phone: string; startedAt: number; lastActivity: number; userId: string }

interface Ctx extends AuthState {
  authed: boolean;
  session: Session | null;
  sessionRemainingMs: () => number;
  touchSession: () => void;
  logout: (reason?: "user" | "expired") => void;
  requestOtp: (phone: string) => Promise<{ ok: true; code: string } | { ok: false; rate: RateCheck }>; // returns mock code
  verifyOtp: (phone: string, code: string, accountPhone: string | null) => Promise<{
    ok: boolean;
    reason?: "wrong-phone" | "wrong-code" | "locked" | "permanent" | "rate-limited";
    remaining?: number; // attempts left
    lockedUntil?: number | null;
    rate?: RateCheck;
  }>;
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
  const { account } = useAccount();
  const [state, setState] = useState<AuthState>(defaultState);
  const [session, setSession] = useState<Session | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    setState(load());
    // Session initiale + abonnement aux changements d'auth Supabase.
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const u = data.user;
      if (u && u.phone) {
        const startedAt = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : Date.now();
        setSession({ phone: stripPrefix(u.phone), startedAt, lastActivity: Date.now(), userId: u.id });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!sess?.user) { setSession(null); return; }
      const u = sess.user;
      setSession({
        phone: stripPrefix(u.phone ?? ""),
        startedAt: Date.now(),
        lastActivity: Date.now(),
        userId: u.id,
      });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
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

  // Session illimitée — conservé pour compat API, retourne toujours Infinity si connecté.
  const sessionRemainingMs = useCallback(() => (session ? Number.POSITIVE_INFINITY : 0), [session]);

  const touchSession = useCallback(() => {
    if (!session) return;
    const next = { ...session, lastActivity: Date.now() };
    setSession(next);
  }, [session]);

  const logout = useCallback((reason: "user" | "expired" = "user") => {
    if (session) logAuthEvent(reason === "expired" ? "session-expired" : "logout", session.phone);
    void supabase.auth.signOut();
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
    // Serveur : génère + stocke un hash SHA-256 (TTL 5 min).
    // Le code est renvoyé en clair uniquement parce que le mode démo est simulé.
    const res = await sendOtp({ data: { phone } });
    if (!res.ok) {
      logAuthEvent("rate-limited", phone, `server blocked (${res.reason})`);
      return { ok: false as const, rate: { ok: false, reason: "phone" as const, retryInMs: 15 * 60 * 1000 } };
    }
    return { ok: true as const, code: res.code };
  }, []);

  const verifyOtp: Ctx["verifyOtp"] = useCallback(async (phone, code, accountPhone) => {
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
    const phoneOk = !accountPhone || accountPhone === phone;
    if (!phoneOk) {
      const failed = state.failedAttempts + 1;
      logAuthEvent("verify-fail", phone, "wrong-phone");
      const next: AuthState = { ...state, failedAttempts: failed, lastPhone: phone };
      setState(next); save(next);
      return { ok: false, reason: "wrong-phone", remaining: 3 - failed };
    }
    const res = await verifyOtpFn({
      data: {
        phone,
        code,
        profile: account
          ? { firstName: account.firstName, lastName: account.lastName, region: account.region }
          : undefined,
      },
    });
    if (res.ok) {
      const { error } = await supabase.auth.setSession(res.session);
      if (error) {
        logAuthEvent("verify-fail", phone, `set_session: ${error.message}`);
        return { ok: false, reason: "wrong-code" };
      }
      const fresh = { ...defaultState, lockCount: state.lockCount };
      setState(fresh); save(fresh);
      logAuthEvent("verify-ok", phone);
      return { ok: true };
    }
    // Réponse serveur en échec : mise à jour du compteur local pour le lock UX.
    const failed = state.failedAttempts + 1;
    logAuthEvent("verify-fail", phone, res.reason ?? "wrong-code");
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
    if (res.reason === "expired") {
      return { ok: false, reason: "wrong-code", remaining: 3 - failed };
    }
    if (res.reason === "locked") {
      return { ok: false, reason: "locked" };
    }
    return {
      ok: false,
      reason: "wrong-code",
      remaining: typeof res.remaining === "number" ? res.remaining : 3 - failed,
    };
  }, [state, account]);

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