import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Account {
  firstName: string;
  lastName: string;
  region: string;
  phone: string;
}

interface Ctx {
  account: Account | null;
  saveAccount: (a: Account) => void;
  clearAccount: () => void;
}

const KEY = "lonani.account";
const AccountCtx = createContext<Ctx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setAccount(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  const saveAccount = (a: Account) => {
    setAccount(a);
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(a));
  };
  const clearAccount = () => {
    setAccount(null);
    if (typeof window !== "undefined") localStorage.removeItem(KEY);
  };
  return (
    <AccountCtx.Provider value={{ account, saveAccount, clearAccount }}>
      {children}
    </AccountCtx.Provider>
  );
}

export function useAccount() {
  const c = useContext(AccountCtx);
  if (!c) throw new Error("useAccount must be used inside AccountProvider");
  return c;
}