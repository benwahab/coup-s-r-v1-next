-- Keep operational controls behind an explicit admin permission.
-- Super-admins remain authorized through has_admin_permission's super-admin branch.

create or replace function public.set_admin_permissions_atomic(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  permission_value text;
begin
  if not exists (
    select 1 from public.user_roles
     where user_id = p_actor_user_id
       and role = 'super_admin'
  ) then
    raise exception 'super_admin_required';
  end if;

  if p_actor_user_id = p_target_user_id then
    raise exception 'cannot_change_own_admin_permissions';
  end if;

  if not exists (
    select 1 from public.user_roles
     where user_id = p_target_user_id
       and role = 'admin'
  ) then
    raise exception 'admin_role_required';
  end if;

  foreach permission_value in array coalesce(p_permissions, array[]::text[]) loop
    if permission_value not in (
      'complaints',
      'player_activity',
      'ball_stats',
      'publish_results',
      'player_stats',
      'region_stats',
      'security_logs',
      'operations'
    ) then
      raise exception 'invalid_admin_permission';
    end if;
  end loop;

  delete from public.admin_permissions
   where user_id = p_target_user_id;

  insert into public.admin_permissions (user_id, permission)
  select p_target_user_id, permission_value
    from unnest(coalesce(p_permissions, array[]::text[])) as permission_value;
end;
$function$;

revoke all on function public.set_admin_permissions_atomic(uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_admin_permissions_atomic(uuid, uuid, text[]) to service_role;
