-- Controlled transfer of the Coup Sûr super-admin role.
-- This is intentionally NOT a generic role-granting function.
-- It can only transfer super_admin from the authenticated actor to an existing admin,
-- and the function itself is callable only by service_role.

create or replace function public.transfer_super_admin_ownership(
  p_actor_user_id uuid,
  p_target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_user_id is null or p_target_user_id is null then
    raise exception 'invalid_transfer_target';
  end if;

  if p_actor_user_id = p_target_user_id then
    raise exception 'cannot_transfer_to_self';
  end if;

  if not exists (
    select 1
      from public.user_roles
     where user_id = p_actor_user_id
       and role = 'super_admin'
  ) then
    raise exception 'super_admin_required';
  end if;

  if not exists (
    select 1
      from public.user_roles
     where user_id = p_target_user_id
       and role = 'admin'
  ) then
    raise exception 'target_admin_required';
  end if;

  insert into public.user_roles (user_id, role)
  values (p_target_user_id, 'super_admin')
  on conflict (user_id, role) do nothing;

  delete from public.user_roles
   where user_id = p_actor_user_id
     and role = 'super_admin';
end;
$$;

revoke all on function public.transfer_super_admin_ownership(uuid, uuid) from public;
revoke all on function public.transfer_super_admin_ownership(uuid, uuid) from anon;
revoke all on function public.transfer_super_admin_ownership(uuid, uuid) from authenticated;
grant execute on function public.transfer_super_admin_ownership(uuid, uuid) to service_role;
