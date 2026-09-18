GRANT SELECT ON public.admin_permissions TO authenticated;

DROP POLICY IF EXISTS "Users can view their own admin permissions" ON public.admin_permissions;
CREATE POLICY "Users can view their own admin permissions"
ON public.admin_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON POLICY "Users can view their own admin permissions" ON public.admin_permissions IS
  'Only the signed-in user can read their own capability assignments; mutations remain service_role-only.';
