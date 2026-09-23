-- Final least-privilege reconciliation for PMU tables and public helper functions.
-- Clients remain read-only on PMU operational data.
REVOKE ALL ON TABLE public.pmu_races FROM anon, authenticated;
REVOKE ALL ON TABLE public.pmu_horses FROM anon, authenticated;
GRANT SELECT ON TABLE public.pmu_races TO anon, authenticated;
GRANT SELECT ON TABLE public.pmu_horses TO anon, authenticated;

-- Authorization helpers remain available to signed-in users for RLS/authorization checks.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) FROM anon;

-- Trigger-only integrity guards are not client RPC APIs.
REVOKE EXECUTE ON FUNCTION public.prevent_audit_log_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_financial_ledger_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_phone_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_published_draw_result_mutation() FROM PUBLIC, anon, authenticated;
