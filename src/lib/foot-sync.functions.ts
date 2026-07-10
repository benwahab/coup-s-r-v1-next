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
  const { data: finishedFixtures } = await supabaseAdmin
    .from("foot_fixtures")
    .select("id, home_score, away_score")
    .eq("status", "finished")
    .not("home_score", "is", null)
    .not("away_score", "is", null);
  if (!finishedFixtures || finishedFixtures.length === 0) return 0;

  const { data: pendingPicks } = await supabaseAdmin
    .from("foot_picks")
    .select("id, fixture_id, ticket_id, selection, market_id")
    .eq("status", "pending")
    .eq("market_id", "1x2")
    .in("fixture_id", finishedFixtures.map((f) => f.id));
  if (!pendingPicks || pendingPicks.length === 0) return 0;

  const fixtureById = new Map(finishedFixtures.map((f) => [f.id, f]));
  let settledCount = 0;
  const affectedTicketIds = new Set<string>();

  for (const pick of pendingPicks) {
    const fx = fixtureById.get(pick.fixture_id);
    if (!fx || fx.home_score === null || fx.away_score === null) continue;
    const result = fx.home_score > fx.away_score ? "1" : fx.home_score < fx.away_score ? "2" : "X";
    const won = pick.selection === result;
    await supabaseAdmin.from("foot_picks").update({ status: won ? "winning" : "losing", settled_at: new Date().toISOString() }).eq("id", pick.id);
    settledCount += 1;
    if (pick.ticket_id) affectedTicketIds.add(pick.ticket_id);
  }

  // Cascade sur les tickets affectés : perdant immédiat si une jambe perd,
  // gagnant seulement si toutes les jambes foot 1x2 du ticket sont gagnantes
  // et qu'aucune autre jambe (PMU/Loto éventuel) n'est encore en attente.
  for (const ticketId of affectedTicketIds) {
    const { data: picksForTicket } = await supabaseAdmin.from("foot_picks").select("status").eq("ticket_id", ticketId);
    if (!picksForTicket) continue;
    const anyLost = picksForTicket.some((p) => p.status === "losing");
    const allDone = picksForTicket.every((p) => p.status === "winning" || p.status === "losing");
    if (anyLost) {
      await supabaseAdmin.from("tickets").update({ status: "losing" }).eq("id", ticketId).eq("status", "pending");
    } else if (allDone) {
      const { data: ticketRow } = await supabaseAdmin.from("tickets").select("legs").eq("id", ticketId).maybeSingle();
      const legs = (ticketRow?.legs as { gameId: string }[] | null) ?? [];
      const onlyFootLeg = legs.every((l) => l.gameId === "foot");
      if (onlyFootLeg) {
        await supabaseAdmin.from("tickets").update({ status: "winning" }).eq("id", ticketId).eq("status", "pending");
      }
      // Ticket mixte (foot + autre jeu) : on laisse l'admin trancher le
      // statut global, la partie foot est réglée mais l'autre jambe ne l'est
      // peut-être pas encore.
    }
  }

  return settledCount;
}
