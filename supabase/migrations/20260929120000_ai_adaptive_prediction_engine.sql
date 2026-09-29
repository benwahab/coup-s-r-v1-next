-- Adaptive AI prediction engine (V1)
CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL CHECK (game_id IN ('pmu','loto','foot')),
  reference_id TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  model_version TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  prediction JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','evaluated','invalid')),
  actual_result JSONB,
  correct BOOLEAN,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evaluated_at TIMESTAMPTZ,
  UNIQUE (game_id, reference_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_game_date
  ON public.ai_predictions (game_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_status
  ON public.ai_predictions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_model_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL CHECK (game_id IN ('pmu','loto','foot')),
  model_version TEXT NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  accuracy NUMERIC,
  brier_score NUMERIC,
  last_evaluated_at TIMESTAMPTZ,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, model_version)
);

GRANT SELECT ON public.ai_predictions TO anon, authenticated;
GRANT ALL ON public.ai_predictions TO service_role;
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published AI predictions are publicly readable"
  ON public.ai_predictions FOR SELECT
  TO anon, authenticated
  USING (status IN ('published','evaluated'));

GRANT SELECT ON public.ai_model_metrics TO authenticated;
GRANT ALL ON public.ai_model_metrics TO service_role;
ALTER TABLE public.ai_model_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI metrics are readable by authenticated users"
  ON public.ai_model_metrics FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.ai_predictions IS
  'Server-generated adaptive predictions. Features and model version are persisted so every prediction can be evaluated against the later official result without data leakage.';

COMMENT ON TABLE public.ai_model_metrics IS
  'Evaluation metrics for adaptive prediction model versions. Metrics describe historical performance and do not guarantee future outcomes.';
