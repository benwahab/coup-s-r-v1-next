import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { FootMatch } from "@/lib/mock-data";

/** Cotes 1X2 déterministes dérivées de l'id de la rencontre (pas de vraies
 *  cotes bookmaker sur le plan gratuit API-Football — décision validée avec
 *  Ben). Même logique de seed que foot-markets.ts pour rester cohérent. */
function seed(str: string): number {
  let s = 0;
  for (let i = 0; i < str.length; i++) s = (s * 33 + str.charCodeAt(i)) | 0;
  return Math.abs(s);
}
export function fixtureOdds1x2(fixtureId: string): { "1": number; X: number; "2": number } {
  const r1 = (seed(fixtureId + "|1") % 250) / 100; // 0–2.5
  const rX = (seed(fixtureId + "|X") % 150) / 100; // 0–1.5
  const o1 = Number((1.35 + r1).toFixed(2));
  const oX = Number((2.9 + rX * 0.4).toFixed(2));
  const o2 = Number((1.35 + ((seed(fixtureId + "|2") % 250) / 100)).toFixed(2));
  return { "1": Math.max(1.1, o1), X: Math.max(2.5, oX), "2": Math.max(1.1, o2) };
}

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
}

/** Convertit une ligne foot_fixtures en FootMatch (format déjà consommé par l'UI existante). */
export function fixtureToFootMatch(row: FootFixtureRow): FootMatch {
  return {
    id: row.id,
    league: row.league_name,
    home: row.home_team,
    away: row.away_team,
    date: new Date(row.kickoff_at).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    odds: fixtureOdds1x2(row.id),
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
      // Synchronisation en tâche de fond (no-op si données fraîches ou clé absente).
      import("@/lib/foot-sync.functions").then(({ syncFootFixtures }) => syncFootFixtures()).catch(() => {});

      const nowIso = new Date().toISOString();
      const { data: fixtures } = await supabase
        .from("foot_fixtures")
        .select("id, external_id, league_name, home_team, away_team, kickoff_at, status, home_score, away_score")
        .in("status", ["scheduled", "live"])
        .gt("kickoff_at", nowIso)
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

  return { matches: rows.map(fixtureToFootMatch), pickedFixtureIds, loading, refresh: load };
}
