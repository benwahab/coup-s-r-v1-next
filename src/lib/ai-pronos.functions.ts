import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PmuOut = z.object({
  summary: z.string().describe("Synthèse globale (1-2 phrases)"),
  horses: z.array(
    z.object({
      number: z.number(),
      name: z.string(),
      score: z.number(),
      strength: z.string(),
      weakness: z.string(),
    }),
  ),
  recommended: z.object({
    tierce: z.array(z.number()),
    quinte: z.array(z.number()),
    rationale: z.string(),
  }),
});

const LotoOut = z.object({
  summary: z.string(),
  hot: z.array(z.number()),
  cold: z.array(z.number()),
  rotation: z.string(),
  suggestions: z.array(
    z.object({
      balls: z.array(z.number()),
      rationale: z.string(),
    }),
  ),
});

export const analyzePmu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { horses: { number: number; name: string; jockey: string }[] }) =>
    z
      .object({
        horses: z.array(z.object({ number: z.number(), name: z.string(), jockey: z.string() })),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: PmuOut }),
      system:
        "Tu es un analyste hippique du PMU au Niger. Analyse les chevaux et propose un tiercé et un quinté basés sur la forme et le profil. Réponds en français.",
      prompt: `Voici les chevaux engagés aujourd'hui :\n${data.horses.map((h) => `${h.number}. ${h.name} (jockey: ${h.jockey})`).join("\n")}\n\nDonne pour chaque cheval un score 0-100, une force, une faiblesse, puis un tiercé et un quinté recommandés avec justification.`,
    });
    return experimental_output;
  });

export const analyzeLoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { history: number[][]; hotSeed: number[] }) =>
    z.object({ history: z.array(z.array(z.number().int().min(1).max(90)).max(5)).max(100), hotSeed: z.array(z.number().int().min(1).max(90)).max(20) }).parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: LotoOut }),
      system:
        "Tu es un analyste de loterie. Tu observes la rotation des boules d'un loto 1-90 et proposes des grilles de 3 à 5 boules avec rationale. Réponds en français.",
      prompt: `Historique des tirages récents (du plus récent au plus ancien) :\n${data.history.map((t, i) => `Tirage ${i + 1}: ${t.join(", ")}`).join("\n")}\n\nBoules réputées chaudes : ${data.hotSeed.join(", ")}.\n\nAnalyse la rotation, identifie les boules chaudes/froides et propose 3 grilles diversifiées avec leur justification.`,
    });
    return experimental_output;
  });
