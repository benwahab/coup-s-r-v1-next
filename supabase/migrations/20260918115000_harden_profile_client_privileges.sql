-- Lock profile creation to trusted server-side flows.
-- The auth trigger and server functions create/update profiles; clients may only edit
-- non-sensitive presentation fields after authentication.

REVOKE INSERT ON public.profiles FROM authenticated;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

REVOKE UPDATE (phone, password_setup_required) ON public.profiles FROM authenticated;

COMMENT ON TABLE public.profiles IS
'User profile. Identity phone and password-setup state are server-authoritative; clients cannot insert profiles or mutate sensitive identity/security fields.';