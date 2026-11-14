-- Restore the caller-scoped role lookup required by public.has_role().
-- The existing RLS policy "Users can view their own roles" restricts
-- authenticated users to rows where user_id = auth.uid().
-- Without this table-level SELECT grant, has_role() fails with SQLSTATE 42501.
GRANT SELECT ON TABLE public.user_roles TO authenticated;

COMMENT ON TABLE public.user_roles IS
  'Role assignments. Authenticated users may read only their own rows through RLS; role writes remain server-side.';
