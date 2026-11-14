-- Keep one active daily result for PMU and Loto while preserving
-- provider-managed football's multiple match-result rows per day.
drop index if exists public.uq_draw_results_active_game_date;
create unique index uq_draw_results_active_game_date
  on public.draw_results(game_id, draw_date)
  where status in ('pending', 'published') and game_id in ('pmu', 'loto');

-- A rejected PMU submission must release its race so a corrected result can be resubmitted.
drop index if exists public.uq_draw_results_pmu_race;
create unique index uq_draw_results_pmu_race
  on public.draw_results(pmu_race_id)
  where pmu_race_id is not null and status in ('pending', 'published');
