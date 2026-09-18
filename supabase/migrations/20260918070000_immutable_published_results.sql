-- Once an official draw result is published, it becomes immutable.
-- This protects the settlement source of truth even if a future server-side
-- code path accidentally attempts to edit or delete an already-published row.

create or replace function public.prevent_published_draw_result_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.status = 'published' then
    raise exception 'published_draw_result_immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'published' then
    raise exception 'published_draw_result_immutable';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_published_draw_result_mutation on public.draw_results;

create trigger trg_prevent_published_draw_result_mutation
before update or delete on public.draw_results
for each row
execute function public.prevent_published_draw_result_mutation();

comment on function public.prevent_published_draw_result_mutation() is
  'Prevents modification or deletion of published official results; settlement depends on immutable published data.';
