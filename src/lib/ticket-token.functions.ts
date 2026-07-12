import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SignInput = z.object({
  ticketId: z.string().min(1),
  legId: z.string().min(1).optional(),
});

const VerifyInput = z.object({ token: z.string().min(1) });

export const signTicketToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SignInput.parse(data))
  .handler(async ({ data, context }) => {
    // Vérifie que le ticket appartient bien à l'utilisateur connecté avant
    // de signer — sans ça, n'importe qui pouvait obtenir un token signé
    // valide pour le ticket de quelqu'un d'autre (juste en connaissant son
    // code public), ce qui compromet la vérification d'authenticité du reçu.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ticket } = await supabaseAdmin
      .from("tickets")
      .select("id, user_id")
      .eq("code", data.ticketId)
      .maybeSingle();
    if (!ticket || ticket.user_id !== context.userId) {
      throw new Error("Ticket introuvable ou non autorisé");
    }
    const { signTicketTokenServer } = await import("./ticket-token.server");
    return { token: await signTicketTokenServer(data.ticketId, data.legId) };
  });

export const verifyTicketToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const { verifyTicketTokenServer } = await import("./ticket-token.server");
    return await verifyTicketTokenServer(data.token);
  });