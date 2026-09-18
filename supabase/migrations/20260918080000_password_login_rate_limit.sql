-- Server-side brute-force protection for password authentication.
-- Only the server/service-role path may write these records.
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_phone_time
  ON public.auth_login_attempts (phone_hash, created_at DESC);

REVOKE ALL ON TABLE public.auth_login_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.auth_login_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auth_login_attempts TO service_role;

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.auth_login_attempts IS
  'Server-side password login attempts used for brute-force protection and security auditability.';

COMMENT ON COLUMN public.auth_login_attempts.phone_hash IS
  'SHA-256 hash of the normalized phone number; raw phone is not stored in this table.';
