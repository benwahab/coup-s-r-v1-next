// SMS delivery must be performed by an authenticated server endpoint backed by
// a configured provider. Client code must never simulate or log a delivery.
import type { Ticket, TicketLeg } from "./tickets";
import { signTicketToken } from "./ticket-token.functions";

export interface SmsEntry {
  id: string;          // ticket id (+ leg suffix)
  phone: string;
  prize: number;
  body: string;
  at: number;
}

export function readSmsLog(): SmsEntry[] {
  return [];
}

export async function sendWinSms(ticket: Ticket, leg?: TicketLeg): Promise<SmsEntry> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { token } = await signTicketToken({ data: { ticketId: ticket.id, legId: leg?.legId } });
  const drawLabel = leg?.drawName ?? ticket.drawName ?? ticket.gameName;
  const prize = leg?.prize ?? ticket.prize ?? 0;
  const body = `Coup Sûr: BRAVO! Ticket #${ticket.id}${leg ? ` (${leg.gameName})` : ""} — Tirage ${drawLabel} — Gain ${prize.toLocaleString()} FCFA. Reçu: ${origin}/verify/${token}`;
  const entry: SmsEntry = {
    id: leg ? `${ticket.id}#${leg.legId}` : ticket.id,
    phone: ticket.phone,
    prize,
    body,
    at: Date.now(),
  };
  throw new Error(`sms_provider_not_configured:${entry.id}`);
}

// ============================================================================
// Notifications de compte (suppression / annulation / expiration)
// Les notifications de compte restent indisponibles tant qu'un endpoint
// serveur authentifié et son fournisseur ne sont pas configurés.
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
  void subject;
  throw new Error(`notification_provider_not_configured:${entry.id}`);
}