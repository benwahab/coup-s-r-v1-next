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

// ============================================================================
// Notifications de compte (suppression / annulation / expiration)
// SMS mock + Email mock — journalisées dans le même log que les gains.
// En prod, brancher /api/public/sms et /api/public/email.
// ============================================================================

export type AccountNoticeKind = "deletion-requested" | "deletion-cancelled" | "deletion-expired";

const KIND_MESSAGES: Record<AccountNoticeKind, (firstName: string) => { subject: string; body: string }> = {
  "deletion-requested": (fn) => ({
    subject: "Coup Sûr — Suppression de compte demandée",
    body: `Coup Sûr: ${fn || "Bonjour"}, votre demande de suppression a été enregistrée. Votre compte sera définitivement supprimé dans 30 jours. Vous pouvez annuler à tout moment depuis « Mon compte ».`,
  }),
  "deletion-cancelled": (fn) => ({
    subject: "Coup Sûr — Suppression annulée",
    body: `Coup Sûr: ${fn || "Bonjour"}, la suppression de votre compte a été annulée. Votre compte reste actif.`,
  }),
  "deletion-expired": (fn) => ({
    subject: "Coup Sûr — Compte supprimé",
    body: `Coup Sûr: ${fn || "Bonjour"}, votre compte a été définitivement supprimé après le délai de 30 jours. Merci de votre confiance.`,
  }),
};

export async function sendAccountNotice(
  kind: AccountNoticeKind,
  target: { phone: string; email?: string; firstName?: string },
): Promise<SmsEntry> {
  const { subject, body } = KIND_MESSAGES[kind](target.firstName ?? "");
  const entry: SmsEntry = {
    id: `notice-${kind}-${Date.now()}`,
    phone: target.phone,
    prize: 0,
    body,
    at: Date.now(),
  };
  const prev = readSmsLog();
  writeSmsLog([entry, ...prev]);
  // Hooks prod (non-câblés tant que providers absents)
  if (typeof window !== "undefined" && import.meta.env.VITE_SMS_PROVIDER) {
    fetch("/api/public/sms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: target.phone, text: body }) }).catch(() => undefined);
  }
  if (typeof window !== "undefined" && target.email && import.meta.env.VITE_EMAIL_PROVIDER) {
    fetch("/api/public/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: target.email, subject, text: body }) }).catch(() => undefined);
  }
  // eslint-disable-next-line no-console
  console.info(`[Coup Sûr NOTICE ${kind}]`, body, target.email ? `→ email: ${target.email}` : "");
  return entry;
}