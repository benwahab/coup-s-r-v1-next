-- ============================================================
-- FOOT_FIXTURES — matchs synchronisés depuis API-Football
-- ============================================================
CREATE TABLE public.foot_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id BIGINT UNIQUE NOT NULL,            -- id fixture API-Football
  league_external_id BIGINT NOT NULL,
  league_name TEXT NOT NULL,
  season INT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  kickoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score INT,
  away_score INT,
  odds_home NUMERIC,
  odds_draw NUMERIC,
  odds_away NUMERIC,
  settled_at TIMESTAMPTZ,                        -- rempli quand les paris liés ont été réglés
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_foot_fixtures_kickoff ON public.foot_fixtures (kickoff_at);
CREATE INDEX idx_foot_fixtures_status ON public.foot_fixtures (status) WHERE status IN ('scheduled', 'live');
CREATE INDEX idx_foot_fixtures_league ON public.foot_fixtures (league_external_id, kickoff_at);

-- Données de référence publiques : lecture libre, écriture réservée au serveur (sync API-Football).
GRANT SELECT ON public.foot_fixtures TO anon, authenticated;
GRANT ALL ON public.foot_fixtures TO service_role;

ALTER TABLE public.foot_fixtures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fixtures are publicly readable"
  ON public.foot_fixtures FOR SELECT
  TO anon, authenticated
  USING (true);
-- Pas de policy INSERT/UPDATE/DELETE pour anon/authenticated : seul service_role
-- (utilisé par la fonction serveur de synchronisation) peut écrire.

-- ============================================================
-- FOOT_PICKS — un pari = un match, pour appliquer "une seule fois par
-- match, pour toujours" au niveau base de données (pas seulement côté UI).
-- ============================================================
CREATE TABLE public.foot_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.foot_fixtures(id) ON DELETE RESTRICT,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  selection TEXT NOT NULL CHECK (selection IN ('1', 'X', '2')),
  odds NUMERIC NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  -- Un même utilisateur ne peut parier qu'une seule fois sur un même match,
  -- pour toujours (même dans un ticket différent créé plus tard).
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX idx_foot_picks_user ON public.foot_picks (user_id, created_at DESC);
CREATE INDEX idx_foot_picks_fixture ON public.foot_picks (fixture_id);
CREATE INDEX idx_foot_picks_ticket ON public.foot_picks (ticket_id);

GRANT SELECT, INSERT ON public.foot_picks TO authenticated;
GRANT ALL ON public.foot_picks TO service_role;

ALTER TABLE public.foot_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own picks"
  ON public.foot_picks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Un joueur ne peut créer un pick que pour lui-même, statut forcé à 'pending'.
CREATE POLICY "Users can insert their own picks"
  ON public.foot_picks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

COMMENT ON TABLE public.foot_fixtures IS 'Matchs de football synchronisés périodiquement depuis API-Football (voir src/lib/foot-sync.functions.ts). Écriture réservée à service_role.';
COMMENT ON TABLE public.foot_picks IS 'Un pari = un match. La contrainte UNIQUE(user_id, fixture_id) applique la règle "un seul pari par match, pour toujours" au niveau base de données.';
