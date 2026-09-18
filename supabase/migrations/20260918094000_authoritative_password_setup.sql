-- Authoritative server-side password setup state.
-- This is intentionally separate from auth.users.app_metadata because JWT claims
-- can remain stale until token refresh. Sensitive server functions must consult
-- this profile flag before allowing financial/business actions.

alter table public.profiles
  add column if not exists password_setup_required boolean not null default false;

create index if not exists idx_profiles_password_setup_required
  on public.profiles (password_setup_required)
  where password_setup_required = true;

comment on column public.profiles.password_setup_required is
  'Server-authoritative gate: true while the account still needs to complete OTP/password setup.';

-- Users may not toggle this flag from the client.
revoke update (password_setup_required) on public.profiles from anon, authenticated;
