-- Granular admin permissions.
-- An admin account alone grants no dashboard access. Permissions are additive,
-- and only super_admin bypasses the permission matrix.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN (
    'complaints',
    'player_activity',
    'ball_stats',
    'publish_results',
    'player_stats',
    'region_stats',
    'security_logs',
    'operations'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_user_id
  ON public.admin_permissions(user_id);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_permissions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_permissions TO service_role;

-- Caller-scoped permission check. It never answers for another user and requires
-- the caller to still have the admin role. Super admins receive the full matrix.
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND auth.uid() = _user_id
     AND (
       EXISTS (
         SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'super_admin'
       )
       OR (
         EXISTS (
           SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid() AND role = 'admin'
         )
         AND EXISTS (
           SELECT 1 FROM public.admin_permissions
            WHERE user_id = auth.uid() AND permission = _permission
         )
       )
     )
$$;

REVOKE ALL ON FUNCTION public.has_admin_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) TO authenticated, service_role;

COMMENT ON TABLE public.admin_permissions IS
  'Least-privilege admin capability assignments. Ordinary admins never receive full dashboard access; super_admin bypasses this matrix.';
COMMENT ON FUNCTION public.has_admin_permission(uuid, text) IS
  'Caller-scoped least-privilege check. Super admins have all capabilities; ordinary admins require an explicit permission.';
