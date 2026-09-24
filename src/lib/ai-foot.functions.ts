import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const FootAnalysisOut = z.object({
  summary: z.string().describe("Synthèse globale du match en 2-3 phrases"),
  homeStrength: z.string().describe("Analyse du profil/de la forme de l'équipe à domicile"),
  awayStrength: z.string().describe("Analyse du profil/de la forme de l'équipe à l'extérieur"),
  headToHead: z.string().describe("Commentaire sur l'historique des confrontations directes"),
  keyFactors: z.array(z.string()).describe("2 à 4 facteurs clés à surveiller pour ce match"),
  prediction: z.object({
    outcome: z.enum(["1", "X", "2"]),
    confidence: z.enum(["faible", "moyenne", "élevée"]),
    rationale: z.string(),
  }),
  dataLimitations: z
    .string()
    .describe(
      "Mention honnête des données non disponibles (blessures/suspensions détaillées, non incluses sur le plan gratuit de la source de données)",
    ),
});
export type FootAnalysis = z.infer<typeof FootAnalysisOut>;

const AI_MODEL = "google/gemini-3-5-flash";

/**
 * Analyse IA d'un match, générée à la demande à partir des noms d'équipes
 * fournis directement (fonctionne aussi bien pour des matchs fictifs de
 * démo que pour de vrais matchs plus tard — pas de dépendance à une
 * rencontre existant en base).
 */
export const analyzeFootMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { homeTeam: string; awayTeam: string; league: string }) =>
    z
      .object({
        homeTeam: z.string().min(1).max(80),
        awayTeam: z.string().min(1).max(80),
        league: z.string().min(1).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const { experimental_output } = await generateText({
      model: gateway(AI_MODEL),
      experimental_output: Output.object({ schema: FootAnalysisOut }),
      system:
        "Tu es un analyste football pour une plateforme de paris sportifs au Niger. Analyse les rencontres de façon factuelle et prudente, sans jamais garantir un résultat. Sois honnête sur les limites des données disponibles. Réponds en français.",
      prompt: `Match : ${data.homeTeam} vs ${data.awayTeam}\nCompétition : ${data.league}\n\nAnalyse ce match : profil de chaque équipe, ce que dit généralement l'historique de ce type de confrontation, facteurs clés à surveiller, et une prédiction prudente avec un niveau de confiance. Précise clairement que les données statistiques détaillées (forme récente réelle, blessures, suspensions) ne sont pas connectées à une source de données en direct pour cette démonstration.`,
    });

    return {
      analysis: experimental_output as FootAnalysis,
      cached: false,
      generatedAt: new Date().toISOString(),
    };
  });
