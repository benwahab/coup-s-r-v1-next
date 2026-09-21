create table if not exists public.game_schedules (
  game_id text primary key check (game_id in ('pmu','loto')),
  open_hour smallint not null check (open_hour between 0 and 23),
  close_hour smallint not null check (close_hour between 0 and 23),
  draw_hour smallint not null check (draw_hour between 0 and 23),
  draw_minute smallint not null default 0 check (draw_minute between 0 and 59),
  timezone text not null default 'Africa/Niamey',
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.game_schedules(game_id,open_hour,close_hour,draw_hour,draw_minute)
values
 ('pmu',16,15,15,30),
 ('loto',16,15,15,30)
on conflict (game_id) do nothing;

alter table public.game_schedules enable row level security;
revoke all on public.game_schedules from anon, authenticated;
grant select on public.game_schedules to anon, authenticated;

drop policy if exists "public can read game schedules" on public.game_schedules;
create policy "public can read game schedules"
on public.game_schedules for select
to anon, authenticated
using (enabled = true);

create index if not exists game_schedules_enabled_idx on public.game_schedules(enabled);