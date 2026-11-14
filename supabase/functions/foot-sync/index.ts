import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://v3.football.api-sports.io";
const LEAGUES = [1, 61, 39, 140, 135, 2];

interface Fixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; season: number };
  teams: { home: { name: string; logo: string }; away: { name: string; logo: string } };
  goals: { home: number | null; away: number | null };
}

function mapStatus(short: string) {
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled";
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("FOOT_SYNC_CRON_SECRET");
  if (!expected) {
    return Response.json({ error: "missing_cron_configuration" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("API_FOOTBALL_KEY");
  if (!url || !serviceKey || !apiKey) {
    return Response.json({ error: "missing_provider_configuration" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey);
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);
  let upserted = 0;
  let successfulLeagues = 0;
  const providerFailures: { league: number; status?: number; reason: string }[] = [];

  for (const league of LEAGUES) {
    const endpoint = API_BASE + "/fixtures?league=" + league + "&season=" + now.getUTCFullYear() + "&from=" + from + "&to=" + to;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers: { "x-apisports-key": apiKey },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      providerFailures.push({ league, reason: error instanceof Error ? error.name : "provider_network_error" });
      console.error("foot-sync provider request failed", { league });
      continue;
    }

    if (!response.ok) {
      providerFailures.push({ league, status: response.status, reason: "provider_http_error" });
      console.error("foot-sync provider returned HTTP error", {
        league, status: response.status,
        remaining: response.headers.get("x-ratelimit-requests-remaining"),
      });
      continue;
    }

    const body = (await response.json()) as { response?: Fixture[]; errors?: Record<string, unknown> | unknown[] };
    if (body.errors && Object.keys(body.errors).length > 0) {
      providerFailures.push({ league, reason: "provider_api_error" });
      console.error("foot-sync provider API error", { league, errors: body.errors });
      continue;
    }

    successfulLeagues++;
    const rows = (body.response ?? []).map((f) => ({
      external_id: f.fixture.id,
      league_external_id: f.league.id,
      league_name: f.league.name,
      season: f.league.season,
      home_team: f.teams.home.name,
      away_team: f.teams.away.name,
      home_team_logo: f.teams.home.logo,
      away_team_logo: f.teams.away.logo,
      kickoff_at: f.fixture.date,
      status: mapStatus(f.fixture.status.short),
      home_score: f.goals.home,
      away_score: f.goals.away,
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) continue;

    const { error } = await supabase.from("foot_fixtures").upsert(rows, { onConflict: "external_id" });
    if (error) {
      providerFailures.push({ league, reason: "fixture_upsert_failed" });
      console.error("foot-sync fixture upsert failed", { league, message: error.message });
      continue;
    }
    upserted += rows.length;
  }

  console.info("foot-sync fixture summary", { successfulLeagues, failedLeagues: providerFailures.length, upserted, from, to });
  if (successfulLeagues === 0 || providerFailures.length > 0) {
    return Response.json({
      ok: false,
      error: successfulLeagues === 0 ? "all_provider_requests_failed" : "partial_provider_sync_failure",
      successfulLeagues, failedLeagues: providerFailures, upserted, at: now.toISOString(),
    }, { status: 502 });
  }

  // Evaluate stored AI predictions against provider-authoritative finished fixtures.
  const evaluationCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: finishedFixtures } = await supabase
    .from("foot_fixtures")
    .select("id,home_score,away_score,status,updated_at")
    .eq("status", "finished")
    .gte("updated_at", evaluationCutoff)
    .limit(500);
  for (const fixture of finishedFixtures ?? []) {
    if (fixture.home_score == null || fixture.away_score == null) continue;
    const actual = fixture.home_score > fixture.away_score ? "1" : fixture.home_score < fixture.away_score ? "2" : "X";
    const { data: predictions } = await supabase
      .from("ai_predictions")
      .select("id,prediction")
      .eq("game_id", "foot")
      .eq("reference_id", fixture.id)
      .eq("status", "published");
    for (const prediction of predictions ?? []) {
      const p = prediction.prediction as { outcome?: string };
      if (p.outcome !== "1" && p.outcome !== "X" && p.outcome !== "2") continue;
      await supabase.from("ai_predictions").update({
        status: "evaluated", actual_result: actual, correct: p.outcome === actual,
        score: p.outcome === actual ? 1 : 0, evaluated_at: new Date().toISOString(),
      }).eq("id", prediction.id);
    }
  }

  // Reuse the server settlement endpoint so provider updates and ticket
  // settlement remain one trusted server-side path.
  const { data: pending } = await supabase
    .from("foot_picks")
    .select("ticket_id")
    .eq("status", "pending")
    .not("ticket_id", "is", null)
    .limit(500);
  const ticketIds = [...new Set((pending ?? []).map((r) => r.ticket_id).filter(Boolean))];

  let settled = 0;
  for (const ticketId of ticketIds) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id,stake,status")
      .eq("id", ticketId)
      .eq("status", "pending")
      .maybeSingle();
    if (!ticket) continue;
    const { data: picks } = await supabase
      .from("foot_picks")
      .select("id,fixture_id,picks")
      .eq("ticket_id", ticketId);
    if (!picks?.length) continue;
    let losing = false,
      pendingState = false,
      totalOdds = 1;
    const updates: { id: string; status: "winning" | "losing"; settledAt: string }[] = [];
    for (const row of picks) {
      const { data: fixture } = await supabase
        .from("foot_fixtures")
        .select("home_score,away_score,status")
        .eq("id", row.fixture_id)
        .maybeSingle();
      const rowPicks = Array.isArray(row.picks) ? row.picks : [];
      if (
        !fixture ||
        fixture.status !== "finished" ||
        fixture.home_score == null ||
        fixture.away_score == null
      ) {
        pendingState = true;
        continue;
      }
      const validatedPicks = rowPicks as Array<{
        marketId?: unknown;
        selection?: unknown;
        odds?: unknown;
      }>;
      if (
        !rowPicks.length ||
        validatedPicks.some(
          (p) =>
            p?.marketId !== "1x2" ||
            typeof p?.selection !== "string" ||
            typeof p?.odds !== "number" ||
            !Number.isFinite(p.odds) ||
            p.odds < 1 ||
            p.odds > 1000,
        )
      ) {
        pendingState = true;
        continue;
      }
      const result =
        fixture.home_score > fixture.away_score
          ? "1"
          : fixture.home_score < fixture.away_score
            ? "2"
            : "X";
      let rowLosing = false;
      for (const p of validatedPicks) {
        if (
          typeof p.odds !== "number" ||
          !Number.isFinite(p.odds) ||
          p.odds < 1 ||
          p.odds > 1000 ||
          typeof p.selection !== "string"
        ) {
          pendingState = true;
          break;
        }
        totalOdds *= p.odds;
        if (!Number.isSafeInteger(totalOdds) && totalOdds > Number.MAX_SAFE_INTEGER) {
          pendingState = true;
          break;
        }
        if (p.selection !== result) rowLosing = true;
      }
      losing ||= rowLosing;
      updates.push({
        id: row.id,
        status: rowLosing ? "losing" : "winning",
        settledAt: new Date().toISOString(),
      });
    }
    const status = losing ? "losing" : pendingState ? "pending" : "winning";
    if (status === "pending") continue;
    const prize = status === "winning" ? Math.floor(ticket.stake * totalOdds) : 0;
    const { data: result, error } = await supabase.rpc("settle_ticket_atomic", {
      p_ticket_id: ticket.id,
      p_status: status,
      p_prize: prize,
      p_leg_updates: updates,
      p_mark_all_foot_losing: status === "losing",
    });
    if (!error && result?.length) settled++;
  }

  return Response.json({ ok: true, upserted, settled, at: now.toISOString() });
});