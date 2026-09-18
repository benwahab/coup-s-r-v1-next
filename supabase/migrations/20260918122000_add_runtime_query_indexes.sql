-- Cover security and high-frequency user query paths.
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_user_id ON public.auth_login_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_game_date ON public.tickets (user_id, game_id, draw_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_user_status_created ON public.payments (user_id, status, created_at DESC);