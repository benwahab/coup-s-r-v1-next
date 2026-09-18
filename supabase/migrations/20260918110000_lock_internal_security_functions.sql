REVOKE ALL ON FUNCTION public.record_payment_ledger_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ticket_paid_ledger_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.prevent_financial_ledger_mutation() SET search_path = public;
ALTER FUNCTION public.prevent_audit_log_mutation() SET search_path = public;

COMMENT ON FUNCTION public.rls_auto_enable() IS 'Internal maintenance helper. Not callable through the public API.';