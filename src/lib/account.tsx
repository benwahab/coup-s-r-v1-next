import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type ConsentRecord, makeUserId } from "./legal";
import { sendAccountNotice } from "./sms";

const RECOVERY_DAYS = 30;
const RECOVERY_MS = RECOVERY_DAYS * 24 * 60 * 60 * 1000;

export interface Account {
  firstName: string;
  lastName: string;
  region: string;
  phone: string;
  email?: string;
  userId?: string;
  createdAt?: number;
  consent?: ConsentRecord;
  deletionRequestedAt?: number | null;
}

interface RegistryEntry {
  userId: string;
  status: "active" | "pending_deletion";
  deletionRequestedAt?: number;
}
type Registry = Record<string, RegistryEntry>;

interface Ctx {
  account: Account | null;
  saveAccount: (a: Account) => void;
  clearAccount: () => void;
  isPhoneAvailable: (phone: string, ownUserId?: string) => { ok: boolean; reason?: "active" | "pending_deletion"; recoverableUntil?: number };
  requestDeletion: () => void;
  cancelDeletion: () => void;
  deletionRemainingMs: () => number;
}

const KEY = "lonani.account";
const REG_KEY = "lonani.accounts.registry";
const AccountCtx = createContext<Ctx | null>(null);

function loadRegistry(): Registry {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(REG_KEY);
    if (!raw) return {};
    const reg = JSON.parse(raw) as Registry;
    const now = Date.now();
    let dirty = false;
    for (const p of Object.keys(reg)) {
      const e = reg[p];
      if (e.status === "pending_deletion" && e.deletionRequestedAt && now - e.deletionRequestedAt > RECOVERY_MS) {
        delete reg[p];
        dirty = true;
      }
    }
    if (dirty) localStorage.setItem(REG_KEY, JSON.stringify(reg));
    return reg;
  } catch { return {}; }
}

// Détecte les demandes de suppression arrivées à expiration (>30j) sans les purger.
// Utilisé pour envoyer la notification "compte supprimé" avant la purge.
function findExpiredDeletions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REG_KEY);
    if (!raw) return [];
    const reg = JSON.parse(raw) as Registry;
    const now = Date.now();
    return Object.keys(reg).filter((p) => {
      const e = reg[p];
      return e.status === "pending_deletion" && !!e.deletionRequestedAt && now - e.deletionRequestedAt > RECOVERY_MS;
    });
  } catch { return []; }
}
function saveRegistry(reg: Registry) {
  if (typeof window !== "undefined") localStorage.setItem(REG_KEY, JSON.stringify(reg));
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setAccount(JSON.parse(raw)); } catch { /* ignore */ }
    }
    // Purge le registre au boot
    loadRegistry();
  }, []);

  const isPhoneAvailable: Ctx["isPhoneAvailable"] = (phone, ownUserId) => {
    const reg = loadRegistry();
    const e = reg[phone];
    if (!e) return { ok: true };
    if (ownUserId && e.userId === ownUserId) return { ok: true };
    if (e.status === "active") return { ok: false, reason: "active" };
    if (e.status === "pending_deletion") {
      const until = (e.deletionRequestedAt ?? 0) + RECOVERY_MS;
      return { ok: false, reason: "pending_deletion", recoverableUntil: until };
    }
    return { ok: true };
  };

  const saveAccount = (a: Account) => {
    const reg = loadRegistry();
    const userId = a.userId ?? account?.userId ?? makeUserId(a.phone);
    // Si on change de numéro : libère l'ancien (marque comme supprimé -> réactivable 30j)
    if (account && account.phone !== a.phone) {
      delete reg[account.phone];
    }
    reg[a.phone] = { userId, status: "active" };
    saveRegistry(reg);
    const full: Account = {
      ...a,
      userId,
      createdAt: a.createdAt ?? account?.createdAt ?? Date.now(),
      deletionRequestedAt: null,
    };
    setAccount(full);
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(full));
  };

  const clearAccount = () => {
    // Purge dure (sans délai)
    if (account) {
      const reg = loadRegistry();
      delete reg[account.phone];
      saveRegistry(reg);
    }
    setAccount(null);
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
  };

  const requestDeletion = () => {
    if (!account) return;
    const now = Date.now();
    const reg = loadRegistry();
    reg[account.phone] = {
      userId: account.userId ?? makeUserId(account.phone),
      status: "pending_deletion",
      deletionRequestedAt: now,
    };
    saveRegistry(reg);
    const next = { ...account, deletionRequestedAt: now };
    setAccount(next);
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  };

  const cancelDeletion = () => {
    if (!account) return;
    const reg = loadRegistry();
    reg[account.phone] = {
      userId: account.userId ?? makeUserId(account.phone),
      status: "active",
    };
    saveRegistry(reg);
    const next = { ...account, deletionRequestedAt: null };
    setAccount(next);
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  };

  const deletionRemainingMs = () => {
    if (!account?.deletionRequestedAt) return 0;
    return Math.max(0, account.deletionRequestedAt + RECOVERY_MS - Date.now());
  };

  return (
    <AccountCtx.Provider value={{ account, saveAccount, clearAccount, isPhoneAvailable, requestDeletion, cancelDeletion, deletionRemainingMs }}>
      {children}
    </AccountCtx.Provider>
  );
}

export function useAccount() {
  const c = useContext(AccountCtx);
  if (!c) throw new Error("useAccount must be used inside AccountProvider");
  return c;
}