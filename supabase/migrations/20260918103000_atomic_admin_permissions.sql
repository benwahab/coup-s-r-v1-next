CREATE OR REPLACE FUNCTION public.set_admin_permissions_atomic(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  permission_value text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_actor_user_id
       AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'super_admin_required';
  END IF;

  IF p_actor_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'cannot_change_own_admin_permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_target_user_id
       AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin_role_required';
  END IF;

  FOREACH permission_value IN ARRAY COALESCE(p_permissions, ARRAY[]::text[]) LOOP
    IF permission_value NOT IN (
      'complaints',
      'player_activity',
      'ball_stats',
      'publish_results',
      'player_stats',
      'region_stats',
      'security_logs',
    'operations'
    ) THEN
      RAISE EXCEPTION 'invalid_admin_permission';
    END IF;
  END LOOP;

  DELETE FROM public.admin_permissions
   WHERE user_id = p_target_user_id;

  INSERT INTO public.admin_permissions (user_id, permission)
  SELECT p_target_user_id, permission_value
    FROM unnest(COALESCE(p_permissions, ARRAY[]::text[])) AS permission_value;
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_permissions_atomic(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_permissions_atomic(uuid, uuid, text[]) TO service_role;

COMMENT ON FUNCTION public.set_admin_permissions_atomic(uuid, uuid, text[]) IS
  'Atomic least-privilege permission replacement for an admin. Only a verified super_admin actor may assign capabilities.';
