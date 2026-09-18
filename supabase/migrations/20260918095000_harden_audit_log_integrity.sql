-- Make security audit history append-only.
-- Application code writes audit events with service_role; clients must not be
-- able to rewrite or delete historical security evidence.

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read audit logs" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs_are_append_only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_audit_log_update_delete ON public.audit_logs;
CREATE TRIGGER prevent_audit_log_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

COMMENT ON TABLE public.audit_logs IS
  'Append-only security and administrative audit history. Mutations are server/service-role only.';
