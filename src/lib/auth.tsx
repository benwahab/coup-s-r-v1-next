import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sendOtp, verifyOtp as verifyOtpFn } from "./otp.functions";
import { useAccount } from "./account";

const KEY = "lonani.auth";
const LOCK_MS = 60 * 60 * 1000; // 1h
type RateCheck = { ok: boolean; reason?: "phone" | "ip"; retryInMs?: number };
// Session Supabase — reste active jusqu'à une déconnexion explicite (refresh auto).

function stripPrefix(e164OrLocal: string): string {
  const s = (e164OrLocal ?? "").replace(/\D/g, "");
  if (s.startsWith("227") && s.length === 11) return s.slice(3);
  return s.slice(-8);
}

interface AuthState {
  failedAttempts: number; // current cycle (0..3)
  lockCount: number; // number of times the account got locked
  lockedUntil: number | null; // ms epoch; if Infinity-like (=-1) → permanent
  lastPhone?: string;
}

interface Session {
  phone: string;
  userId: string;
  passwordSetupRequired: boolean;
}

interface Ctx extends AuthState {
  authed: boolean;
  authChecked: boolean;
  session: Session | null;
  logout: () => void;
  requestOtp: (phone: string) => Promise<
    | { ok: true; demoCode: string | null }
    | {
        ok: false;
        reason?: "rate-limited" | "provider-unavailable";
        rate: RateCheck;
      }
  >;
  verifyOtp: (
    phone: string,
    code: string,
    accountPhone: string | null,
  ) => Promise<{
    ok: boolean;
    reason?: "wrong-phone" | "wrong-code" | "expired" | "already-used" | "locked" | "permanent" | "rate-limited";
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
  } catch {
    return defaultState;
  }
}
function save(s: AuthState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (error) {
    // Le cache anti-abus local ne doit jamais transformer une vérification OTP
    // déjà validée côté serveur en échec apparent.
    console.warn("[auth] unable to persist local lock state", error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { account, saveAccount } = useAccount();
  const [state, setState] = useState<AuthState>(defaultState);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    setState(load());
    // Session initiale + abonnement aux changements d'auth Supabase.
    let mounted = true;
    // Ne déclare pas l'authentification terminée avant la réponse de Supabase :
    // un délai fixe pourrait rediriger un utilisateur connecté si le réseau est lent.
    let initialUserRequest: ReturnType<typeof supabase.auth.getUser>;
    try {
      initialUserRequest = supabase.auth.getUser();
    } catch (err) {
      console.error("[auth] getUser initialization failed", err);
      setAuthChecked(true);
      return () => {
        mounted = false;
      };
    }
    initialUserRequest
      .then(({ data }) => {
        if (!mounted) return;
        const u = data.user;
        if (u && u.phone) {
          setSession({
            phone: stripPrefix(u.phone),
            userId: u.id,
            passwordSetupRequired: u.app_metadata?.password_setup_required === true,
          });
        }
      })
      .catch((err) => {
        console.error("[auth] getUser failed", err);
      })
      .finally(() => {
        if (mounted) setAuthChecked(true);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!sess?.user) {
        setSession(null);
        return;
      }
      const u = sess.user;
      setSession({
        phone: stripPrefix(u.phone ?? ""),
        userId: u.id,
        passwordSetupRequired: u.app_metadata?.password_setup_required === true,
      });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
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

  const logout = useCallback(() => {
    void supabase.auth.signOut({ scope: "local" });
    setSession(null);
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const res = await sendOtp({ data: { phone } });
    if (!res.ok) {
      return {
        ok: false as const,
        reason: res.reason,
        rate: { ok: false, reason: "phone" as const, retryInMs: 15 * 60 * 1000 },
      };
    }
    return { ok: true as const, demoCode: res.demoCode ?? null };
  }, []);

  const verifyOtp: Ctx["verifyOtp"] = useCallback(
    async (phone, code, accountPhone) => {
      // already permanently locked
      if (state.lockedUntil === -1) {
        return { ok: false, reason: "permanent" };
      }
      // timed lock active
      if (state.lockedUntil && Date.now() < state.lockedUntil) {
        return { ok: false, reason: "locked", lockedUntil: state.lockedUntil };
      }
      const phoneOk = !accountPhone || accountPhone === phone;
      if (!phoneOk) {
        const failed = state.failedAttempts + 1;
        const next: AuthState = { ...state, failedAttempts: failed, lastPhone: phone };
        setState(next);
        save(next);
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
          return { ok: false, reason: "wrong-code" };
        }
        // Nouvel appareil : le compte local (localStorage) peut être vide alors
        // que le profil existe côté serveur. On le recharge pour réafficher
        // nom/région correctement au lieu de laisser un compte local incomplet.
        if (res.profile) {
          try {
            saveAccount({
              firstName: res.profile.firstName ?? account?.firstName ?? "",
              lastName: res.profile.lastName ?? account?.lastName ?? "",
              region: res.profile.region ?? account?.region ?? "",
              phone,
              userId: res.userId,
            });
          } catch (error) {
            // Le profil serveur et la session restent valides même si le cache
            // local du compte est indisponible (ex. stockage du navigateur bloqué).
            console.warn("[auth] OTP succeeded but local account cache failed", error);
          }
        }
        const fresh = { ...defaultState, lockCount: state.lockCount };
        setState(fresh);
        save(fresh);
        return { ok: true };
      }
      // Réponse serveur en échec : mise à jour du compteur local pour le lock UX.
      const failed = state.failedAttempts + 1;
      if (failed >= 3) {
        const newLockCount = state.lockCount + 1;
        const lockedUntil = newLockCount >= 2 ? -1 : Date.now() + LOCK_MS;
        const next: AuthState = {
          failedAttempts: 0,
          lockCount: newLockCount,
          lockedUntil,
          lastPhone: phone,
        };
        setState(next);
        save(next);
        return { ok: false, reason: lockedUntil === -1 ? "permanent" : "locked", lockedUntil };
      }
      const next: AuthState = { ...state, failedAttempts: failed, lastPhone: phone };
      setState(next);
      save(next);
      if (res.reason === "expired") {
        return { ok: false, reason: "expired" };
      }
      if (res.reason === "locked") {
        return { ok: false, reason: "locked" };
      }
      return {
        ok: false,
        reason: "wrong-code",
        remaining: typeof res.remaining === "number" ? res.remaining : 3 - failed,
      };
    },
    [state, account, saveAccount],
  );

  const resetLock = useCallback(() => {
    const fresh = defaultState;
    setState(fresh);
    save(fresh);
  }, []);

  return (
    <AuthCtx.Provider
      value={{
        ...state,
        authed: !!session && !session.passwordSetupRequired,
        authChecked,
        session,
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
