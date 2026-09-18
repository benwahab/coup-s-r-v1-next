import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireConfiguredUser } from "@/lib/secure-user.functions";

const SignInput = z.object({
  ticketId: z.string().min(1),
  legId: z.string().min(1).optional(),
});

const VerifyInput = z.object({ token: z.string().min(1) });

export const signTicketToken = createServerFn({ method: "POST" })
  .middleware([requireConfiguredUser])
  .inputValidator((data: unknown) => SignInput.parse(data))
  .handler(async ({ data, context }) => {
    // Vérifie que le ticket appartient bien à l'utilisateur connecté avant
    // de signer — sans ça, n'importe qui pouvait obtenir un token signé
    // valide pour le ticket de quelqu'un d'autre (juste en connaissant son
    // code public), ce qui compromet la vérification d'authenticité du reçu.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, user_id, legs")
      .eq("code", data.ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== context.userId) {
      throw new Error("Ticket introuvable ou non autorisé");
    }

    // A legId is part of the signed payload, so it must itself belong to the
    // ticket. Otherwise an authenticated owner could obtain a valid-looking
    // receipt token carrying an arbitrary leg identifier.
    if (data.legId) {
      const legs = Array.isArray(ticket.legs)
        ? (ticket.legs as Array<{ legId?: unknown }>)
        : [];
      if (!legs.some((leg) => leg.legId === data.legId)) {
        throw new Error("Pari introuvable sur ce ticket");
      }
    }
    const { signTicketTokenServer } = await import("./ticket-token.server");
    return { token: await signTicketTokenServer(data.ticketId, data.legId) };
  });

export const verifyTicketToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const { verifyTicketTokenServer } = await import("./ticket-token.server");
    const result = await verifyTicketTokenServer(data.token);
    if (!result.valid || !result.ticketId) return result;

    // Une signature valide prouve l'authenticité du token, mais ne suffit pas :
    // le ticket peut avoir été supprimé ou invalidé depuis l'émission du reçu.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket, error } = await supabaseAdmin
      .from("tickets")
      .select("id, code, status, legs")
      .eq("code", result.ticketId)
      .maybeSingle();

    if (error) return { valid: false as const, reason: "Vérification indisponible" };
    if (!ticket) return { valid: false as const, reason: "Ticket introuvable" };

    if (result.legId) {
      const legs = Array.isArray(ticket.legs)
        ? (ticket.legs as Array<{ legId?: unknown }>)
        : [];
      if (!legs.some((leg) => leg.legId === result.legId)) {
        return { valid: false as const, reason: "Pari introuvable sur ce ticket" };
      }
    }

    return { ...result, ticketStatus: ticket.status };
  });