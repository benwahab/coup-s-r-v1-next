import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
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
  dataLimitations: z.string().describe("Mention honnête des données non disponibles (blessures/suspensions détaillées, non incluses sur le plan gratuit de la source de données)"),
});
export type FootAnalysis = z.infer<typeof FootAnalysisOut>;

const AI_MODEL = "google/gemini-3-5-flash";

/**
 * Analyse IA d'un match, générée à la demande et mise en cache (une seule
 * génération par match, réutilisée ensuite pour tout le monde) — pour
 * rester dans le budget IA et le quota de l'API de données sportives.
 */
export const analyzeFootMatch = createServerFn({ method: "POST" })
  .inputValidator((data: { fixtureId: string }) => z.object({ fixtureId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cached } = await supabaseAdmin
      .from("foot_ai_analyses")
      .select("analysis, model_used, created_at")
      .eq("fixture_id", data.fixtureId)
      .maybeSingle();
    if (cached) return { analysis: cached.analysis as FootAnalysis, cached: true, generatedAt: cached.created_at };

    const { data: fixture } = await supabaseAdmin
      .from("foot_fixtures")
      .select("external_id, league_name, home_team, away_team, kickoff_at")
      .eq("id", data.fixtureId)
      .maybeSingle();
    if (!fixture) throw new Error("Match introuvable");

    // Confrontations directes — un seul appel, peu coûteux en quota, et le
    // résultat est stable dans le temps (l'historique ne change pas).
    let h2hSummary = "Aucune donnée de confrontation directe disponible.";
    const apiKey = process.env.API_FOOTBALL_KEY;
    if (apiKey) {
      try {
        const teamsRes = await fetch(
          `https://v3.football.api-sports.io/fixtures?id=${fixture.external_id}`,
          { headers: { "x-apisports-key": apiKey } },
        );
        const teamsJson = (await teamsRes.json()) as { response: Array<{ teams: { home: { id: number }; away: { id: number } } }> };
        const teams = teamsJson.response[0]?.teams;
        if (teams) {
          const h2hRes = await fetch(
            `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${teams.home.id}-${teams.away.id}&last=5`,
            { headers: { "x-apisports-key": apiKey } },
          );
          const h2hJson = (await h2hRes.json()) as { response: Array<{ teams: { home: { name: string; winner: boolean | null }; away: { name: string; winner: boolean | null } }; goals: { home: number | null; away: number | null } }> };
          if (h2hJson.response?.length) {
            h2hSummary = h2hJson.response
              .map((m) => `${m.teams.home.name} ${m.goals.home ?? "?"}-${m.goals.away ?? "?"} ${m.teams.away.name}`)
              .join(" ; ");
          }
        }
      } catch {
        // Pas bloquant : l'IA travaillera sans H2H si l'appel échoue.
      }
    }

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const { experimental_output } = await generateText({
      model: gateway(AI_MODEL),
      experimental_output: Output.object({ schema: FootAnalysisOut }),
      system: "Tu es un analyste football pour une plateforme de paris sportifs au Niger. Analyse les rencontres de façon factuelle et prudente, sans jamais garantir un résultat. Sois honnête sur les limites des données disponibles (pas de données de blessures/suspensions en temps réel sur le plan gratuit utilisé). Réponds en français.",
      prompt: `Match : ${fixture.home_team} vs ${fixture.away_team}\nCompétition : ${fixture.league_name}\nCoup d'envoi : ${fixture.kickoff_at}\nHistorique des confrontations directes (5 dernières, si disponibles) : ${h2hSummary}\n\nAnalyse ce match : profil de chaque équipe, ce que dit l'historique des confrontations, facteurs clés à surveiller, et une prédiction prudente avec un niveau de confiance. Précise clairement que les données de blessures/suspensions ne sont pas disponibles avec la source actuelle.`,
    });

    await supabaseAdmin.from("foot_ai_analyses").insert({
      fixture_id: data.fixtureId,
      analysis: experimental_output,
      model_used: AI_MODEL,
    });

    return { analysis: experimental_output, cached: false, generatedAt: new Date().toISOString() };
  });
