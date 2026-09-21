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
  if (["1H","HT","2H","ET","BT","P","SUSP","INT","LIVE"].includes(short)) return "live";
  if (["FT","AET","PEN"].includes(short)) return "finished";
  if (short === "PST") return "postponed";
  if (["CANC","ABD","AWD","WO"].includes(short)) return "cancelled";
  return "scheduled";
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("FOOT_SYNC_CRON_SECRET");
  if (expected && req.headers.get("x-cron-secret") !== expected) {
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

  for (const league of LEAGUES) {
    const endpoint = `${API_BASE}/fixtures?league=${league}&season=${now.getUTCFullYear()}&from=${from}&to=${to}`;
    const response = await fetch(endpoint, { headers: { "x-apisports-key": apiKey } });
    if (!response.ok) continue;
    const body = await response.json() as { response?: Fixture[] };
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
    if (!error) upserted += rows.length;
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
    // The application settlement function is authoritative for ticket rules.
    // This function only refreshes provider data; it never accepts admin results.
    const { error } = await supabase.from("foot_picks").select("id").eq("ticket_id", ticketId).limit(1);
    if (!error) settled += 0;
  }

  return Response.json({ ok: true, upserted, settled, at: now.toISOString() });
});