-- Store the two manually managed PMU daily figures alongside the existing PMU game schedule.
alter table public.game_schedules
  add column if not exists daily_stats_date date not null default ((now() at time zone 'Africa/Niamey')::date),
  add column if not exists today_winners_count integer,
  add column if not exists today_paid_fcfa integer;

alter table public.game_schedules
  drop constraint if exists game_schedules_today_winners_count_check;

alter table public.game_schedules
  add constraint game_schedules_today_winners_count_check
  check (today_winners_count is null or today_winners_count >= 0);

alter table public.game_schedules
  drop constraint if exists game_schedules_today_paid_fcfa_check;

alter table public.game_schedules
  add constraint game_schedules_today_paid_fcfa_check
  check (today_paid_fcfa is null or today_paid_fcfa >= 0);
