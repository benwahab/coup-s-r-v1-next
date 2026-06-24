import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GameId } from "./mock-data";

export type TicketStatus = "pending" | "losing" | "winning" | "paid";

/** Une "jambe" du ticket : une grille de loto, un tiercé PMU, un pari foot. */
export interface TicketLeg {
  legId: string;
  gameId: GameId;
  gameName: string;
  picks: (string | number)[];
  picksLabel: string;
  stake: number;
  drawName?: string;
  drawDate: string;
  status: TicketStatus;
  prize?: number;
}

export interface Ticket {
  id: string;
  gameId: GameId;
  gameName: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  region?: string;
  picks: (string | number)[];           // numbers, horse numbers, or "m1:1" pairs
  picksLabel: string;                    // human readable
  stake: number;
  payment: string;
  createdAt: string;
  drawDate: string;
  status: TicketStatus;
  prize?: number;
  /** Présent si le reçu groupe plusieurs grilles/jeux. Sinon le ticket = 1 leg implicite. */
  legs?: TicketLeg[];
  drawName?: string;
}

interface Ctx {
  tickets: Ticket[];
  addTicket: (t: Omit<Ticket, "id" | "createdAt" | "status">) => Ticket;
  getTicket: (id: string) => Ticket | undefined;
  updateStatus: (id: string, status: TicketStatus, prize?: number) => void;
  updateLegStatus: (ticketId: string, legId: string, status: TicketStatus, prize?: number) => void;
}

const TicketsCtx = createContext<Ctx | null>(null);
const KEY = "lonani.tickets";

function newId() {
  const n = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return `LNN-${n}`;
}

export function TicketsProvider({ children }: { children: ReactNode }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { setTickets(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(tickets));
  }, [tickets]);

  const addTicket: Ctx["addTicket"] = (t) => {
    const legs = t.legs?.map((l, i) => ({ ...l, legId: l.legId || `${newId()}-${i}` }));
    const ticket: Ticket = { ...t, legs, id: newId(), createdAt: new Date().toISOString(), status: "pending" };
    setTickets((prev) => [ticket, ...prev]);
    return ticket;
  };
  const getTicket = (id: string) => tickets.find((t) => t.id === id);
  const updateStatus: Ctx["updateStatus"] = (id, status, prize) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status, prize } : t)));
  };
  const updateLegStatus: Ctx["updateLegStatus"] = (ticketId, legId, status, prize) => {
    setTickets((prev) => prev.map((t) => {
      if (t.id !== ticketId || !t.legs) return t;
      const legs = t.legs.map((l) => l.legId === legId ? { ...l, status, prize } : l);
      // Statut global : si au moins une gagnante non payée → winning ; tout payé → paid ; tout perdant → losing ; sinon pending
      const all = legs.map(l => l.status);
      let global: TicketStatus = "pending";
      if (all.every(s => s === "paid")) global = "paid";
      else if (all.some(s => s === "winning" || s === "paid")) global = "winning";
      else if (all.every(s => s === "losing")) global = "losing";
      const totalPrize = legs.reduce((s, l) => s + (l.prize ?? 0), 0);
      return { ...t, legs, status: global, prize: totalPrize || undefined };
    }));
  };

  return (
    <TicketsCtx.Provider value={{ tickets, addTicket, getTicket, updateStatus, updateLegStatus }}>
      {children}
    </TicketsCtx.Provider>
  );
}

export function useTickets() {
  const c = useContext(TicketsCtx);
  if (!c) throw new Error("useTickets must be used inside TicketsProvider");
  return c;
}