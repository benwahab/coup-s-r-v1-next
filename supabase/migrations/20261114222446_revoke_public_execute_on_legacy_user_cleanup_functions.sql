-- Remove client execution from obsolete legacy account-cleanup routines.
-- Keep service_role execution available for trusted server-side maintenance.
-- No function, account, role, or user data is deleted by this migration.

REVOKE EXECUTE ON FUNCTION public.purge_legacy_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_legacy_bootstrap_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_legacy_user_role() FROM PUBLIC, anon, authenticated;
