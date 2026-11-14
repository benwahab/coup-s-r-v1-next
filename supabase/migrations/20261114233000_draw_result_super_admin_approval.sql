-- Official draw results must be reviewed by a Super Admin before publication.
alter table public.draw_results
  drop constraint if exists draw_results_status_check;

alter table public.draw_results
  add constraint draw_results_status_check
  check (status in ('draft', 'pending', 'published', 'rejected'));

alter table public.draw_results
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

drop index if exists public.uq_draw_results_published;

-- At most one active submission (pending or published) per game and day.
-- Rejection releases the slot so a corrected result can be submitted.
create unique index if not exists uq_draw_results_active_game_date
  on public.draw_results(game_id, draw_date)
  where status in ('pending', 'published');

comment on column public.draw_results.submitted_by is
  'Administrator who submitted the official result for Super Admin review.';
comment on column public.draw_results.reviewed_by is
  'Super Admin who approved or rejected the submitted result.';
comment on column public.draw_results.reviewed_at is
  'Timestamp of the Super Admin approval or rejection.';
