-- Cache des analyses IA par match, pour éviter de regénérer (coût + temps)
-- à chaque consultation. Une analyse par match, réutilisée pour tous les
-- utilisateurs qui consultent ce match.
CREATE TABLE public.foot_ai_analyses (
  fixture_id UUID PRIMARY KEY REFERENCES public.foot_fixtures(id) ON DELETE CASCADE,
  analysis JSONB NOT NULL,
  model_used TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.foot_ai_analyses TO anon, authenticated;
GRANT ALL ON public.foot_ai_analyses TO service_role;

ALTER TABLE public.foot_ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI analyses are publicly readable"
  ON public.foot_ai_analyses FOR SELECT
  TO anon, authenticated
  USING (true);
-- Écriture réservée à service_role (générée côté serveur uniquement).

COMMENT ON TABLE public.foot_ai_analyses IS 'Cache des analyses IA générées à la demande pour un match (voir src/lib/ai-foot.functions.ts). Une ligne par match, régénérée seulement si absente.';
