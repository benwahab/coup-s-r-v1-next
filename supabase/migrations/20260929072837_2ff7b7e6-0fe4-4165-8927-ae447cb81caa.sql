CREATE OR REPLACE FUNCTION public.monitoring_db_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'connections', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()),
    'active', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active'),
    'slow', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND now() - query_start > interval '5 seconds'),
    'max_connections', current_setting('max_connections')::int
  );
$$;
REVOKE EXECUTE ON FUNCTION public.monitoring_db_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitoring_db_stats() TO service_role;