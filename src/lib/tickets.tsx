import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GameId } from "./mock-data";

export type TicketStatus = "pending" | "losing" | "winning" | "paid";

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
}

interface Ctx {
  tickets: Ticket[];
  addTicket: (t: Omit<Ticket, "id" | "createdAt" | "status">) => Ticket;
  getTicket: (id: string) => Ticket | undefined;
  updateStatus: (id: string, status: TicketStatus, prize?: number) => void;
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
    const ticket: Ticket = { ...t, id: newId(), createdAt: new Date().toISOString(), status: "pending" };
    setTickets((prev) => [ticket, ...prev]);
    return ticket;
  };
  const getTicket = (id: string) => tickets.find((t) => t.id === id);
  const updateStatus: Ctx["updateStatus"] = (id, status, prize) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status, prize } : t)));
  };

  return (
    <TicketsCtx.Provider value={{ tickets, addTicket, getTicket, updateStatus }}>
      {children}
    </TicketsCtx.Provider>
  );
}

export function useTickets() {
  const c = useContext(TicketsCtx);
  if (!c) throw new Error("useTickets must be used inside TicketsProvider");
  return c;
}