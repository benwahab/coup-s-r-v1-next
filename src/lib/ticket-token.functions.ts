import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SignInput = z.object({
  ticketId: z.string().min(1),
  legId: z.string().min(1).optional(),
});

const VerifyInput = z.object({ token: z.string().min(1) });

export const signTicketToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SignInput.parse(data))
  .handler(async ({ data }) => {
    const { signTicketTokenServer } = await import("./ticket-token.server");
    return { token: await signTicketTokenServer(data.ticketId, data.legId) };
  });

export const verifyTicketToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VerifyInput.parse(data))
  .handler(async ({ data }) => {
    const { verifyTicketTokenServer } = await import("./ticket-token.server");
    return await verifyTicketTokenServer(data.token);
  });