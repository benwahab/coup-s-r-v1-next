-- Keep new public objects closed by default. Access is granted explicitly per table/function.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- AI data is server-generated. Clients only need the explicitly intended reads.
revoke insert, update, delete, truncate, references, trigger
  on public.ai_predictions from anon, authenticated;
grant select on public.ai_predictions to anon, authenticated;

revoke all
  on public.ai_model_metrics from anon, authenticated;
grant select on public.ai_model_metrics to authenticated;
