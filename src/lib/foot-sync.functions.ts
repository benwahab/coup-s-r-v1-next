import { createServerFn } from "@tanstack/react-start";

/**
 * Championnats prioritaires au démarrage (quota gratuit API-Football :
 * 100 requêtes/jour). IDs de championnat stables côté API-Football.
 */
export const TRACKED_LEAGUES = [
  { id: 61, name: "Ligue 1" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 135, name: "Serie A" },
  { id: 2, name: "Champions League" },
] as const;

const SYNC_STALE_MS = 10 * 60 * 1000; // ne resynchronise pas plus souvent que toutes les 10 min
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

interface ApiFootballFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; season: number };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

/** Statuts API-Football → statut interne. Réf. documentation officielle des codes de statut. */
function mapStatus(short: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  if (["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(short)) return "live";
  if (["FT", "AET", "PEN"].includes(short)) return "finished";
  if (["PST"].includes(short)) return "postponed";
  if (["CANC", "ABD", "AWD", "WO"].includes(short)) return "cancelled";
  return "scheduled";
}

/**
 * Synchronise les rencontres des championnats suivis depuis API-Football vers
 * public.foot_fixtures. Ne rappelle l'API externe que si les données en base
 * sont plus vieilles que SYNC_STALE_MS, pour préserver le quota gratuit
 * (100 req/jour) — appelée au chargement de la page Pari Foot.
 */
export const syncFootFixtures = createServerFn({ method: "POST" }).handler(async () => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    // Pas de clé configurée : on continue avec les données déjà en base
    // (ou aucune), sans faire planter la page.
    return { synced: false, reason: "missing_api_key" as const };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: freshest } = await supabaseAdmin
    .from("foot_fixtures")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastSync = freshest?.updated_at ? new Date(freshest.updated_at).getTime() : 0;
  if (Date.now() - lastSync < SYNC_STALE_MS) {
    return { synced: false, reason: "fresh" as const };
  }

  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  let upserted = 0;
  for (const league of TRACKED_LEAGUES) {
    const url = `${API_FOOTBALL_BASE}/fixtures?league=${league.id}&season=${today.getFullYear()}&from=${from}&to=${to}`;
    const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
    if (!res.ok) continue; // on ne fait pas échouer toute la sync pour un championnat en erreur
    const json = (await res.json()) as { response: ApiFootballFixture[] };

    const rows = json.response.map((f) => ({
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

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("foot_fixtures").upsert(rows, { onConflict: "external_id" });
      if (!error) upserted += rows.length;
    }
  }

  return { synced: true as const, upserted };
});
