import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { TicketLeg } from "./tickets";
import type { GameId } from "./mock-data";

/** Un brouillon = pari sauvegardé pour paiement ultérieur (jeu fermé au moment du choix). */
export interface Draft {
  id: string;
  gameId: GameId;
  gameName: string;
  drawName?: string;
  drawDate: string;
  legs: TicketLeg[];
  picksLabel: string;
  totalStake: number;
  phone?: string;
  region?: string;
  paymentId?: string;
  paymentName?: string;
  savedAt: string;
  /** Heure d'ouverture du jeu (pour calcul du déblocage paiement). */
  openHour: number;
}

const KEY = "lonani.drafts";

interface Ctx {
  drafts: Draft[];
  addDraft: (d: Omit<Draft, "id" | "savedAt">) => Draft;
  removeDraft: (id: string) => void;
}
const C = createContext<Ctx | null>(null);

export function DraftsProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setDrafts(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(drafts));
  }, [drafts]);

  const addDraft: Ctx["addDraft"] = (d) => {
    const id = `DR-${Math.floor(Math.random() * 9_000_000) + 1_000_000}`;
    const draft: Draft = { ...d, id, savedAt: new Date().toISOString() };
    setDrafts((p) => [draft, ...p]);
    return draft;
  };
  const removeDraft = (id: string) => setDrafts((p) => p.filter((x) => x.id !== id));

  return <C.Provider value={{ drafts, addDraft, removeDraft }}>{children}</C.Provider>;
}

export function useDrafts() {
  const c = useContext(C);
  if (!c) throw new Error("useDrafts must be used inside DraftsProvider");
  return c;
}