import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL_VERSION = "adaptive-v1";

const PmuPrediction = z.object({
  summary: z.string(),
  tierce: z.array(z.number().int().positive()).length(3),
  quinte: z.array(z.number().int().positive()).length(5),
  confidence: z.enum(["faible", "moyenne", "élevée"]),
  rationale: z.string(),
});

type JsonRecord = Record<string, Json>;

function asRecord(value: Json): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asNumberArray(value: Json | undefined): number[] {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
}

function normalize(values: number[]): number[] {
  const sum = values.reduce((total, value) => total + value, 0);
  return sum > 0 ? values.map((value) => value / sum) : values.map(() => 1 / values.length);
}

async function storePrediction(
  gameId: string,
  referenceId: string,
  predictionDate: string,
  features: Json,
  prediction: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("ai_predictions")
    .upsert(
      {
        game_id: gameId,
        reference_id: referenceId,
        prediction_date: predictionDate,
        model_version: MODEL_VERSION,
        features,
        prediction,
        status: "published",
      },
      { onConflict: "game_id,reference_id,model_version" },
    )
    .select("id")
    .single();

  if (error) throw new Error("ai_prediction_store_failed");
  return data;
}

export const generateAdaptivePmu = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ raceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: race, error: raceError } = await supabaseAdmin
      .from("pmu_races")
      .select("id,race_date,name,start_at,status")
      .eq("id", data.raceId)
      .maybeSingle();

    if (raceError || !race) throw new Error("pmu_race_not_found");

    const { data: horses, error: horsesError } = await supabaseAdmin
      .from("pmu_horses")
      .select(
        "number,name,jockey,trainer,form,win_rate,place_rate,weight,odds,status",
      )
      .eq("race_id", race.id)
      .eq("status", "partant")
      .order("number");

    if (horsesError || !horses?.length) throw new Error("pmu_starters_unavailable");

    const { data: history, error: historyError } = await supabaseAdmin
      .from("draw_results")
      .select("draw_date,result")
      .eq("game_id", "pmu")
      .eq("status", "published")
      .lt("draw_date", race.race_date)
      .order("draw_date", { ascending: false })
      .limit(50);

    if (historyError) throw new Error("pmu_history_unavailable");

    const recent = (history ?? [])
      .map((row) => asNumberArray(asRecord(row.result)?.horses))
      .filter((draw) => draw.length > 0);

    const counts = new Map<number, number>();
    for (const draw of recent) {
      draw
        .slice(0, 5)
        .forEach((number, index) =>
          counts.set(number, (counts.get(number) ?? 0) + (5 - index)),
        );
    }

    const ranked = [...horses].sort((a, b) => {
      const score = (horse: typeof a) =>
        (counts.get(Number(horse.number)) ?? 0) +
        Number(horse.place_rate ?? 0) * 20 +
        Number(horse.win_rate ?? 0) * 30 +
        (horse.odds ? (1 / Number(horse.odds)) * 10 : 0);

      return score(b) - score(a);
    });

    const tierce = ranked.slice(0, 3).map((horse) => Number(horse.number));
    const quinte = ranked.slice(0, 5).map((horse) => Number(horse.number));
    const features = {
      historyDraws: recent.length,
      starterCount: horses.length,
      ranking: ranked.slice(0, 8).map((horse) => ({
        number: horse.number,
        historyScore: counts.get(Number(horse.number)) ?? 0,
        winRate: horse.win_rate,
        placeRate: horse.place_rate,
        odds: horse.odds,
      })),
    };

    let narrative: z.infer<typeof PmuPrediction> = {
      summary: "Pronostic statistique calculé à partir des partants et de l'historique disponible.",
      tierce: tierce as [number, number, number],
      quinte: quinte as [number, number, number, number, number],
      confidence: "faible",
      rationale: "Données historiques limitées.",
    };

    const key = process.env.LOVABLE_API_KEY;
    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const { experimental_output } = await generateText({
          model: gateway("google/gemini-3-5-flash"),
          experimental_output: Output.object({ schema: PmuPrediction }),
          system:
            "Tu es un analyste PMU prudent. Utilise uniquement les données fournies, ne prétends jamais connaître le futur et signale les limites.",
          prompt: JSON.stringify({
            race,
            topHorses: ranked.slice(0, 8),
            history: recent.slice(0, 20),
            statisticalTierce: tierce,
            statisticalQuinte: quinte,
          }),
        });
        narrative = experimental_output;
      } catch {
        // Le calcul statistique local reste le résultat de secours.
      }
    }

    const prediction = { ...narrative, tierce, quinte };
    await storePrediction(
      "pmu",
      race.id,
      race.race_date,
      features as Json,
      prediction as Json,
    );

    return { prediction, modelVersion: MODEL_VERSION };
  });

export const generateAdaptiveLoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ drawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("draw_results")
      .select("draw_date,result")
      .eq("game_id", "loto")
      .eq("status", "published")
      .lte("draw_date", data.drawDate)
      .order("draw_date", { ascending: false })
      .limit(100);

    if (error || !rows?.length) throw new Error("loto_history_unavailable");

    const history = (rows ?? [])
      .map((row) => asNumberArray(asRecord(row.result)?.numbers))
      .filter((draw) => draw.length > 0);

    const counts = new Map<number, number>();
    for (const draw of history) {
      for (const number of draw) counts.set(number, (counts.get(number) ?? 0) + 1);
    }

    const numbers = Array.from({ length: 90 }, (_, index) => index + 1);
    const hot = [...numbers]
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
      .slice(0, 10);
    const cold = [...numbers]
      .sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0))
      .slice(0, 10);
    const suggestions = [0, 1, 2].map((offset) =>
      hot
        .slice(offset, offset + 3)
        .concat(cold.slice(offset, offset + 2))
        .sort((a, b) => a - b),
    );

    const prediction = {
      summary:
        "Analyse descriptive de fréquence; les tirages restent aléatoires et aucune combinaison n'est garantie.",
      hot,
      cold,
      suggestions: suggestions.map((balls) => ({
        balls,
        rationale:
          "Combinaison diversifiée issue des fréquences historiques, sans valeur prédictive garantie.",
      })),
      confidence: "faible" as const,
    };

    await storePrediction(
      "loto",
      data.drawDate,
      data.drawDate,
      { historyDraws: history.length, frequency: Object.fromEntries(counts) },
      prediction as Json,
    );

    return { prediction, modelVersion: MODEL_VERSION };
  });

export const generateAdaptiveFoot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ fixtureId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: fixture, error: fixtureError } = await supabaseAdmin
      .from("foot_fixtures")
      .select(
        "id,league_name,kickoff_at,home_team,away_team,odds_home,odds_draw,odds_away,status,home_score,away_score",
      )
      .eq("id", data.fixtureId)
      .maybeSingle();

    if (fixtureError || !fixture) throw new Error("foot_fixture_not_found");

    const { data: past, error: pastError } = await supabaseAdmin
      .from("foot_fixtures")
      .select("home_team,away_team,home_score,away_score,league_name,kickoff_at")
      .eq("status", "finished")
      .lt("kickoff_at", fixture.kickoff_at)
      .order("kickoff_at", { ascending: false })
      .limit(500);

    if (pastError) throw new Error("foot_history_unavailable");

    const rows = (past ?? []).filter(
      (row) => row.home_score != null && row.away_score != null,
    );
    const relevant = rows.filter((row) => row.league_name === fixture.league_name);

    function teamStats(team: string) {
      const games = rows
        .filter((row) => row.home_team === team || row.away_team === team)
        .slice(0, 10);
      let wins = 0;
      let draws = 0;
      let losses = 0;
      let goalsFor = 0;
      let goalsAgainst = 0;

      for (const game of games) {
        const home = game.home_team === team;
        const scored = (home ? game.home_score : game.away_score) ?? 0;
        const conceded = (home ? game.away_score : game.home_score) ?? 0;
        goalsFor += scored;
        goalsAgainst += conceded;
        if (scored > conceded) wins++;
        else if (scored === conceded) draws++;
        else losses++;
      }

      return { games: games.length, wins, draws, losses, goalsFor, goalsAgainst };
    }

    const homeStats = teamStats(fixture.home_team);
    const awayStats = teamStats(fixture.away_team);
    const base = [
      Math.max(1, homeStats.wins + 1),
      Math.max(1, (homeStats.draws + awayStats.draws) / 2 + 1),
      Math.max(1, awayStats.wins + 1),
    ];

    const odds = [
      Number(fixture.odds_home ?? 0),
      Number(fixture.odds_draw ?? 0),
      Number(fixture.odds_away ?? 0),
    ];
    const implied = odds.every((value) => value > 0)
      ? normalize(odds.map((value) => 1 / value))
      : [1 / 3, 1 / 3, 1 / 3];
    const statistical = normalize(base);
    const probabilities = normalize([
      0.6 * statistical[0] + 0.4 * implied[0],
      0.6 * statistical[1] + 0.4 * implied[1],
      0.6 * statistical[2] + 0.4 * implied[2],
    ]);

    const outcome = ["1", "X", "2"][probabilities.indexOf(Math.max(...probabilities))] as
      | "1"
      | "X"
      | "2";

    const features = {
      league: fixture.league_name,
      leagueFinishedSamples: relevant.length,
      home: homeStats,
      away: awayStats,
      odds: {
        home: fixture.odds_home,
        draw: fixture.odds_draw,
        away: fixture.odds_away,
      },
      probabilities,
    };

    const prediction = {
      summary:
        "Tendance calculée à partir de la forme récente disponible, de la compétition et des cotes actuelles; elle ne garantit pas le résultat.",
      outcome,
      probabilities: {
        home: probabilities[0],
        draw: probabilities[1],
        away: probabilities[2],
      },
      confidence: probabilities.some((probability) => probability > 0.55) ? "moyenne" : "faible",
      keyFactors: [
        `Forme récente: ${fixture.home_team} ${homeStats.wins}-${homeStats.draws}-${homeStats.losses}`,
        `Forme récente: ${fixture.away_team} ${awayStats.wins}-${awayStats.draws}-${awayStats.losses}`,
        `Échantillon compétition: ${relevant.length} matchs terminés`,
      ],
    };

    await storePrediction(
      "foot",
      fixture.id,
      new Date(fixture.kickoff_at).toISOString().slice(0, 10),
      features as Json,
      prediction as Json,
    );

    return { prediction, modelVersion: MODEL_VERSION };
  });

export async function evaluatePublishedAiPredictions(
  gameId: string,
  referenceId: string,
  actual: Json,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("ai_predictions")
    .select("id,prediction,model_version")
    .eq("game_id", gameId)
    .eq("reference_id", referenceId)
    .eq("status", "published");

  if (error) return;

  for (const row of rows ?? []) {
    const prediction = asRecord(row.prediction);
    let correct: boolean | null = null;
    let score: number | null = null;

    if (gameId === "foot" && typeof prediction?.outcome === "string" && typeof actual === "string") {
      correct = prediction.outcome === actual;
      score = correct ? 1 : 0;
    }

    if (gameId === "loto") {
      const actualNumbers = asNumberArray(asRecord(actual)?.numbers);
      const suggestions = Array.isArray(prediction?.suggestions) ? prediction.suggestions : [];
      if (actualNumbers.length > 0 && suggestions.length > 0) {
        const actualSet = new Set(actualNumbers);
        const hits = suggestions.map((suggestion) => {
          const record = asRecord(suggestion);
          const balls = asNumberArray(record?.balls);
          return balls.filter((number) => actualSet.has(number)).length;
        });
        score = hits.reduce((total, hit) => total + hit, 0) / (hits.length * 5);
        correct = score >= 0.6;
      }
    }

    if (gameId === "pmu") {
      const actualHorses = asNumberArray(asRecord(actual)?.horses);
      const predictedQuinte = new Set(asNumberArray(prediction?.quinte));
      if (actualHorses.length > 0 && predictedQuinte.size > 0) {
        const hits = actualHorses.filter((number) => predictedQuinte.has(number)).length;
        score = hits / Math.max(1, predictedQuinte.size);
        correct = hits >= 3;
      }
    }

    if (correct === null) continue;

    await supabaseAdmin
      .from("ai_predictions")
      .update({
        status: "evaluated",
        actual_result: actual,
        correct,
        score,
        evaluated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}
