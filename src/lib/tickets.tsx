import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { GameId } from "./mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import {
  adminUpdateTicketStatus,
  adminUpdateTicketLegStatus,
} from "./admin.functions";
import type { Database } from "@/integrations/supabase/types";

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
  loading: boolean;
  error: string | null;
  refresh: () => void;
  addTicket: (t: Omit<Ticket, "id" | "createdAt" | "status">) => Promise<Ticket>;
  getTicket: (id: string) => Ticket | undefined;
  updateStatus: (id: string, status: TicketStatus, prize?: number) => Promise<void>;
  updateLegStatus: (ticketId: string, legId: string, status: TicketStatus, prize?: number) => Promise<void>;
}

const TicketsCtx = createContext<Ctx | null>(null);

function newId() {
  const n = Math.floor(Math.random() * 9_000_000) + 1_000_000;
  return `LNN-${n}`;
}

type TicketRow = Database["public"]["Tables"]["tickets"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function toE164(local: string | undefined): string | null {
  if (!local) return null;
  const s = local.replace(/\D/g, "");
  if (s.length === 8) return `+227${s}`;
  if (s.startsWith("227")) return `+${s}`;
  return s.startsWith("+") ? s : `+${s}`;
}
function stripPrefix(e164: string | null | undefined): string {
  const s = (e164 ?? "").replace(/\D/g, "");
  if (s.startsWith("227") && s.length === 11) return s.slice(3);
  return s.slice(-8);
}

function rowToTicket(r: TicketRow, profile: ProfileRow | null): Ticket {
  const legs = (Array.isArray(r.legs) ? r.legs : []) as unknown as TicketLeg[];
  return {
    id: r.code,
    gameId: r.game_id as GameId,
    gameName: r.game_name,
    firstName: profile?.first_name ?? undefined,
    lastName: profile?.last_name ?? undefined,
    phone: stripPrefix(r.phone),
    email: undefined,
    region: r.region ?? profile?.region ?? undefined,
    picks: (Array.isArray(r.picks) ? r.picks : []) as (string | number)[],
    picksLabel: r.picks_label,
    stake: r.stake,
    payment: r.payment_method ?? "",
    createdAt: r.created_at,
    drawDate: r.draw_date ?? r.created_at,
    drawName: r.draw_name ?? undefined,
    status: r.status,
    prize: r.prize ?? undefined,
    legs: legs.length > 0 ? legs : undefined,
  };
}

export function TicketsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);

  useEffect(() => {
    if (!session) { setTickets([]); setProfile(null); setLoading(false); setError(null); return; }
    const userId = session.userId;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [tRes, pRes] = await Promise.all([
          supabase
            .from("tickets")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        ]);
        if (cancelled) return;
        if (tRes.error) throw new Error(tRes.error.message);
        const prof = pRes.data ?? null;
        setProfile(prof);
        setTickets((tRes.data ?? []).map((r) => rowToTicket(r, prof)));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session, refreshTick]);

  const addTicket: Ctx["addTicket"] = async (t) => {
    if (!session) throw new Error("not_authenticated");
    const code = newId();
    const legs = t.legs?.map((l, i) => ({ ...l, legId: l.legId || `${code}-${i}` }));
    const { data, error } = await supabase
      .from("tickets")
      .insert({
        user_id: session.userId,
        code,
        game_id: t.gameId,
        game_name: t.gameName,
        picks: t.picks as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["picks"],
        picks_label: t.picksLabel,
        stake: t.stake,
        payment_method: t.payment,
        draw_date: t.drawDate ? t.drawDate.slice(0, 10) : null,
        draw_name: t.drawName ?? null,
        status: "pending",
        legs: (legs ?? []) as unknown as Database["public"]["Tables"]["tickets"]["Insert"]["legs"],
        phone: toE164(t.phone),
        region: t.region ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const tk = rowToTicket(data, profile);
    setTickets((prev) => [tk, ...prev]);
    return tk;
  };

  const getTicket = (id: string) => tickets.find((t) => t.id === id);

  const updateStatus: Ctx["updateStatus"] = async (id, status, prize) => {
    await adminUpdateTicketStatus({
      data: { code: id, status, prize: prize ?? null },
    });
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status, prize } : t)));
  };

  const updateLegStatus: Ctx["updateLegStatus"] = async (ticketId, legId, status, prize) => {
    const res = await adminUpdateTicketLegStatus({
      data: { code: ticketId, legId, status, prize: prize ?? null },
    });
    setTickets((prev) => prev.map((t) => {
      if (t.id !== ticketId || !t.legs) return t;
      const legs = t.legs.map((l) => (l.legId === legId ? { ...l, status, prize } : l));
      return { ...t, legs, status: res.status, prize: res.prize ?? undefined };
    }));
  };

  return (
    <TicketsCtx.Provider value={{ tickets, loading, error, refresh, addTicket, getTicket, updateStatus, updateLegStatus }}>
      {children}
    </TicketsCtx.Provider>
  );
}

export function useTickets() {
  const c = useContext(TicketsCtx);
  if (!c) throw new Error("useTickets must be used inside TicketsProvider");
  return c;
}