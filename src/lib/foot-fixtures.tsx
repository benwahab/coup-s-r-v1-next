import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FootMatch } from "@/lib/foot.types";

export interface FootFixtureRow {
  id: string;
  external_id: number;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
}

/** Cotes autoritaires issues de foot_fixtures. Null si une cote manque : aucune cote n'est inventée côté client. */
export function fixtureOdds1x2(row: Pick<FootFixtureRow, "odds_home" | "odds_draw" | "odds_away">): { "1": number; X: number; "2": number } | null {
  if (row.odds_home == null || row.odds_draw == null || row.odds_away == null) return null;
  return { "1": Number(row.odds_home), X: Number(row.odds_draw), "2": Number(row.odds_away) };
}

/** Convertit une ligne foot_fixtures en FootMatch ; null si les cotes autoritaires sont absentes. */
export function fixtureToFootMatch(row: FootFixtureRow): FootMatch | null {
  const odds = fixtureOdds1x2(row);
  if (!odds) return null;
  return {
    id: row.id,
    league: row.league_name,
    leagueName: row.league_name,
    country: "",
    home: row.home_team,
    away: row.away_team,
    date: new Date(row.kickoff_at).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    kickoffAt: row.kickoff_at,
    odds,
  };
}

/** Charge les rencontres à venir + les matchs déjà pariés par l'utilisateur (règle "une fois pour toujours"). */
export function useFootFixtures() {
  const { session } = useAuth();
  const [rows, setRows] = useState<FootFixtureRow[]>([]);
  const [pickedFixtureIds, setPickedFixtureIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { data: fixtures } = await supabase
        .from("foot_fixtures")
        .select("id, external_id, league_name, home_team, away_team, kickoff_at, status, home_score, away_score, odds_home, odds_draw, odds_away")
        .or(`status.eq.live,and(status.eq.scheduled,kickoff_at.gt.${nowIso})`)
        .order("kickoff_at", { ascending: true })
        .limit(200);
      setRows(fixtures ?? []);

      if (session) {
        const { data: picks } = await supabase.from("foot_picks").select("fixture_id").eq("user_id", session.userId);
        setPickedFixtureIds(new Set((picks ?? []).map((p) => p.fixture_id)));
      } else {
        setPickedFixtureIds(new Set());
      }
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const matches = rows.map(fixtureToFootMatch).filter((m): m is FootMatch => m !== null);
  return { matches, pickedFixtureIds, loading, refresh: load };
}
