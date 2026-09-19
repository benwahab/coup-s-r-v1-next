-- Production hardening: database-level uniqueness for payment de-duplication
-- and draw-result publication inputs. These constraints remain active even if
-- multiple requests arrive concurrently and bypass the application-level check.

CREATE UNIQUE INDEX IF NOT EXISTS payments_user_payment_key_active_uniq
  ON public.payments (user_id, payment_key)
  WHERE payment_key IS NOT NULL
    AND status IN ('pending', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS draw_results_non_foot_game_date_uniq
  ON public.draw_results (game_id, draw_date)
  WHERE game_id IN ('pmu', 'loto');

CREATE UNIQUE INDEX IF NOT EXISTS draw_results_foot_match_uniq
  ON public.draw_results (game_id, draw_date, ((result->>'matchId')))
  WHERE game_id = 'foot';

-- Reconcile with the published-result uniqueness rules already used in the database.
-- These partial indexes prevent duplicate published outcomes while still allowing drafts.
CREATE UNIQUE INDEX IF NOT EXISTS uq_draw_results_published_non_foot
  ON public.draw_results (game_id, draw_date)
  WHERE status = 'published' AND game_id <> 'foot';

CREATE UNIQUE INDEX IF NOT EXISTS uq_draw_results_published_foot_match
  ON public.draw_results (game_id, draw_date, ((result->>'matchId')))
  WHERE status = 'published' AND game_id = 'foot';

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_ticket_id
  ON public.payments (ticket_id)
  WHERE ticket_id IS NOT NULL;
