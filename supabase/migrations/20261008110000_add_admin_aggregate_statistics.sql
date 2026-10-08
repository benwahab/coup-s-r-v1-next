create or replace function public.get_admin_player_statistics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with grouped as (
    select
      t.user_id,
      max(t.phone) as phone,
      (array_agg(coalesce(nullif(trim(t.region), ''), 'Non renseignée') order by t.created_at desc))[1] as region,
      count(*)::integer as tickets,
      coalesce(sum(t.stake), 0) as staked,
      coalesce(sum(case when t.status = 'paid' then coalesce(t.prize, 0) else 0 end), 0) as won
    from public.tickets t
    group by t.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'player', case
          when phone is null then 'Joueur ' || left(user_id::text, 8)
          else '****' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 4)
        end,
        'region', region,
        'tickets', tickets,
        'staked', staked,
        'won', won
      )
      order by staked desc
    ),
    '[]'::jsonb
  )
  from grouped;
$$;

create or replace function public.get_admin_region_statistics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with normalized as (
    select
      coalesce(nullif(trim(t.region), ''), 'Non renseignée') as region,
      t.user_id,
      t.stake,
      t.prize,
      t.status,
      t.created_at
    from public.tickets t
  ),
  grouped as (
    select
      region,
      count(distinct user_id)::integer as players,
      count(*)::integer as tickets,
      coalesce(sum(stake), 0) as staked,
      coalesce(sum(case when status = 'paid' then coalesce(prize, 0) else 0 end), 0) as paid,
      coalesce(sum(stake) filter (where created_at >= now() - interval '7 days'), 0) as current_7d,
      coalesce(sum(stake) filter (
        where created_at >= now() - interval '14 days'
          and created_at < now() - interval '7 days'
      ), 0) as previous_7d
    from normalized
    group by region
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'region', region,
        'players', players,
        'tickets', tickets,
        'staked', staked,
        'paid', paid,
        'delta7d', case
          when previous_7d = 0 then 0
          else round(((current_7d - previous_7d) / previous_7d) * 100)::integer
        end
      )
      order by staked desc
    ),
    '[]'::jsonb
  )
  from grouped;
$$;

revoke execute on function public.get_admin_player_statistics() from public, anon, authenticated;
revoke execute on function public.get_admin_region_statistics() from public, anon, authenticated;
grant execute on function public.get_admin_player_statistics() to service_role;
grant execute on function public.get_admin_region_statistics() to service_role;
