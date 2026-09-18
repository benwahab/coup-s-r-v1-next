-- Prevent duplicate active payment intents for the same authenticated player.
-- This closes the check-then-insert race between concurrent browser requests.
CREATE UNIQUE INDEX IF NOT EXISTS payments_user_payment_key_active_uniq
  ON public.payments (user_id, payment_key)
  WHERE payment_key IS NOT NULL
    AND status IN ('pending', 'confirmed');

-- Only one PMU/Loto result may exist per draw date.
CREATE UNIQUE INDEX IF NOT EXISTS draw_results_non_foot_game_date_uniq
  ON public.draw_results (game_id, draw_date)
  WHERE game_id IN ('pmu', 'loto');

-- Only one football result may exist per match/date.
CREATE UNIQUE INDEX IF NOT EXISTS draw_results_foot_match_uniq
  ON public.draw_results (game_id, draw_date, ((result->>'matchId')))
  WHERE game_id = 'foot';
