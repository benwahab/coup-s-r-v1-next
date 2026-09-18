-- Pari Foot: one published result per match, so coupons can settle incrementally.
-- A match result is immutable once published. Publishing a result re-evaluates all
-- pending Foot coupons for the same draw date.
drop index if exists public.uq_draw_results_published;

create unique index if not exists uq_draw_results_published_non_foot
  on public.draw_results(game_id, draw_date)
  where status = 'published' and game_id <> 'foot';

create unique index if not exists uq_draw_results_published_foot_match
  on public.draw_results(
    game_id,
    draw_date,
    (result->>'matchId')
  )
  where status = 'published' and game_id = 'foot';

create index if not exists idx_draw_results_foot_match
  on public.draw_results(game_id, draw_date, (result->>'matchId'))
  where game_id = 'foot';

comment on index public.uq_draw_results_published_foot_match is
  'Allows automatic incremental settlement of Pari Foot coupons, one immutable published result per match and date.';
