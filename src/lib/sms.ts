// Mock SMS sender for LoNaNi — logs to console + localStorage so the Admin Ops tab can render history.
// In production, wire to Twilio/GatewayAPI via /api/public/sms.
import type { Ticket, TicketLeg } from "./tickets";
import { signTicketToken } from "./ticket-token";

export interface SmsEntry {
  id: string;          // ticket id (+ leg suffix)
  phone: string;
  prize: number;
  body: string;
  at: number;
}

const KEY = "lonani.sms";

export function readSmsLog(): SmsEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

function writeSmsLog(entries: SmsEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 200)));
}

export async function sendWinSms(ticket: Ticket, leg?: TicketLeg): Promise<SmsEntry> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = await signTicketToken(ticket.id, leg?.legId);
  const drawLabel = leg?.drawName ?? ticket.drawName ?? ticket.gameName;
  const prize = leg?.prize ?? ticket.prize ?? 0;
  const body = `LoNaNi: BRAVO! Ticket #${ticket.id}${leg ? ` (${leg.gameName})` : ""} — Tirage ${drawLabel} — Gain ${prize.toLocaleString()} FCFA. Reçu: ${origin}/verify/${token}`;
  const entry: SmsEntry = {
    id: leg ? `${ticket.id}#${leg.legId}` : ticket.id,
    phone: ticket.phone,
    prize,
    body,
    at: Date.now(),
  };
  const prev = readSmsLog();
  writeSmsLog([entry, ...prev]);
  // Hook prod (non-câblé tant que VITE_SMS_PROVIDER absent)
  if (import.meta.env.VITE_SMS_PROVIDER) {
    fetch("/api/public/sms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: ticket.phone, text: body }) }).catch(() => undefined);
  }
  // eslint-disable-next-line no-console
  console.info("[LoNaNi SMS]", body);
  return entry;
}