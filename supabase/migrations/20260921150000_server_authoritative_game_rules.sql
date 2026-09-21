-- Server-authoritative game payout configuration.
-- These are product rules, not draw/PMU result data.
CREATE TABLE IF NOT EXISTS public.game_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL CHECK (game_id IN ('loto')),
  pick_count INTEGER NOT NULL CHECK (pick_count BETWEEN 1 AND 5),
  multiplier NUMERIC NOT NULL CHECK (multiplier >= 1 AND multiplier <= 1000000),
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, pick_count)
);

INSERT INTO public.game_rules (game_id, pick_count, multiplier)
VALUES
  ('loto', 1, 70),
  ('loto', 2, 240),
  ('loto', 3, 800),
  ('loto', 4, 4000),
  ('loto', 5, 20000)
ON CONFLICT (game_id, pick_count) DO NOTHING;

ALTER TABLE public.game_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_rules FROM anon, authenticated;
GRANT SELECT ON public.game_rules TO service_role;
