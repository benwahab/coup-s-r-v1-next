-- Align payment persistence with the server-side payment intent model.
-- Legacy rows may predate game_id, so the column starts nullable and is
-- constrained to supported games. New server-created payments always set it.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS game_id TEXT;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_game_id_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_game_id_check
  CHECK (game_id IS NULL OR game_id IN ('pmu', 'loto', 'foot'));

CREATE INDEX IF NOT EXISTS idx_payments_game_created
  ON public.payments (game_id, created_at DESC);

COMMENT ON COLUMN public.payments.game_id IS
  'Game attached to the payment intent. Nullable only for legacy records created before this field existed.';
