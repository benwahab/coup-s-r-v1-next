-- Database-level invariants for production hardening.
-- Keep monetary amounts strictly positive and prizes non-negative.
-- Keep ticket games and football fixture values within the supported domain.
-- Keep security throttling records structurally valid.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive_check CHECK (amount > 0);

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_stake_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_stake_positive_check CHECK (stake > 0);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_game_id_check CHECK (game_id IN ('pmu','loto','foot'));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_prize_nonnegative_check CHECK (prize IS NULL OR prize >= 0);

ALTER TABLE public.foot_fixtures ADD CONSTRAINT foot_fixtures_score_pair_check
CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score >= 0 AND away_score >= 0));
ALTER TABLE public.foot_fixtures ADD CONSTRAINT foot_fixtures_odds_min_check
CHECK ((odds_home IS NULL OR odds_home >= 1) AND (odds_draw IS NULL OR odds_draw >= 1) AND (odds_away IS NULL OR odds_away >= 1));

ALTER TABLE public.auth_login_attempts ADD CONSTRAINT auth_login_attempts_phone_hash_check CHECK (length(phone_hash) >= 32);
ALTER TABLE public.auth_login_attempts ADD CONSTRAINT auth_login_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_attempts_check CHECK (attempts >= 0 AND attempts <= 3);
ALTER TABLE public.otp_codes ADD CONSTRAINT otp_codes_phone_check CHECK (length(phone) >= 8);