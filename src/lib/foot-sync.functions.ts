import { createServerFn } from "@tanstack/react-start";
import type { supabaseAdmin as SupabaseAdminInstance } from "@/integrations/supabase/client.server";

type SupabaseAdmin = typeof SupabaseAdminInstance;

/**
 * Championnats prioritaires au démarrage (quota gratuit API-Football :
 * 100 requêtes/jour). IDs de championnat stables côté API-Football.
 */
export const TRACKED_LEAGUES = [
  { id: 1, name: "Coupe du Monde FIFA" },
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

  const settled = await settleFinishedFixtures(supabaseAdmin);

  return { synced: true as const, upserted, settled };
});

/**
 * Règle automatiquement les paris 1X2 des rencontres terminées.
 * - Marché 1x2 uniquement (les autres marchés restent réglés manuellement
 *   par un admin, faute de données statistiques suffisantes côté API
 *   gratuite pour les calculer automatiquement — décision validée avec Ben).
 * - Dès qu'une jambe d'un ticket combiné est perdante, tout le ticket passe
 *   immédiatement à 'losing', même si d'autres matchs du combiné sont
 *   encore en cours.
 */
async function settleFinishedFixtures(supabaseAdmin: SupabaseAdmin) {
  const { data: finishedFixtures, error: fixturesError } = await supabaseAdmin
    .from("foot_fixtures")
    .select("id, home_score, away_score")
    .eq("status", "finished")
    .not("home_score", "is", null)
    .not("away_score", "is", null);
  if (fixturesError) throw new Error("finished_fixtures_lookup_failed");
  if (!finishedFixtures?.length) return 0;

  const fixtureIds = finishedFixtures.map((f) => f.id);
  const { data: pendingRows, error: picksError } = await supabaseAdmin
    .from("foot_picks")
    .select("id, fixture_id, ticket_id, picks, status")
    .eq("status", "pending")
    .in("fixture_id", fixtureIds);
  if (picksError) throw new Error("pending_foot_picks_lookup_failed");
  if (!pendingRows?.length) return 0;

  const fixtureById = new Map(finishedFixtures.map((f) => [f.id, f]));
  const ticketIds = new Set<string>();
  for (const row of pendingRows) if (row.ticket_id) ticketIds.add(row.ticket_id);

  let settledCount = 0;
  for (const ticketId of ticketIds) {
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id,stake,status")
      .eq("id", ticketId)
      .eq("status", "pending")
      .maybeSingle();
    if (ticketError || !ticket) continue;

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("foot_picks")
      .select("id,fixture_id,picks,status")
      .eq("ticket_id", ticketId);
    if (rowsError || !rows?.length) continue;

    let losing = false;
    let pending = false;
    let totalOdds = 1;
    const updates: { id: string; status: "winning" | "losing"; settledAt: string }[] = [];

    for (const row of rows) {
      const fixture = fixtureById.get(row.fixture_id);
      const picks = Array.isArray(row.picks) ? row.picks : [];
      if (!picks.length) { pending = true; continue; }

      for (const raw of picks) {
        if (!raw || typeof raw !== "object") { pending = true; continue; }
        const p = raw as { marketId?: unknown; selection?: unknown; odds?: unknown; status?: unknown };
        if (p.marketId !== "1x2" || typeof p.selection !== "string" || typeof p.odds !== "number" || p.odds < 1 || p.odds > 1000) {
          // Les marchés non supportés ne peuvent pas être réglés manuellement.
          // Ils restent bloqués jusqu'à ce qu'un provider fournisse leurs données.
          pending = true;
          continue;
        }
        totalOdds *= p.odds;
        if (!Number.isFinite(totalOdds) || totalOdds > 1e12) throw new Error("foot_payout_overflow");
        if (!fixture || fixture.home_score == null || fixture.away_score == null) { pending = true; continue; }
        const result = fixture.home_score > fixture.away_score ? "1" : fixture.home_score < fixture.away_score ? "2" : "X";
        if (p.selection !== result) losing = true;
      }

      if (fixtureById.has(row.fixture_id) && !picks.some((p) => p && typeof p === "object" && (p as { marketId?: unknown }).marketId !== "1x2")) {
        const fixture = fixtureById.get(row.fixture_id);
        if (fixture?.home_score != null && fixture?.away_score != null) {
          const result = fixture.home_score > fixture.away_score ? "1" : fixture.home_score < fixture.away_score ? "2" : "X";
          const rowPicks = picks as { marketId?: unknown; selection?: unknown }[];
          if (rowPicks.every((p) => p.marketId === "1x2" && typeof p.selection === "string")) {
            const rowLosing = rowPicks.some((p) => p.selection !== result);
            updates.push({ id: row.id, status: rowLosing ? "losing" : "winning", settledAt: new Date().toISOString() });
          }
        }
      }
    }

    const nextStatus = losing ? "losing" : pending ? "pending" : "winning";
    if (nextStatus === "pending") continue;
    const prize = nextStatus === "winning" ? Math.floor(ticket.stake * totalOdds) : 0;
    const { data: settled, error: settlementError } = await supabaseAdmin.rpc("settle_ticket_atomic", {
      p_ticket_id: ticket.id,
      p_status: nextStatus,
      p_prize: prize,
      p_leg_updates: updates,
      p_mark_all_foot_losing: nextStatus === "losing",
    });
    if (!settlementError && settled?.length) settledCount += 1;
  }
  return settledCount;
}