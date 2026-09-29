CREATE TABLE public.monitoring_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('server','client')),
  level text NOT NULL DEFAULT 'INFO' CHECK (level IN ('DEBUG','INFO','WARNING','ERROR','CRITICAL')),
  service text NOT NULL,
  method text,
  endpoint text,
  status integer,
  duration_ms integer,
  spans jsonb NOT NULL DEFAULT '[]'::jsonb,
  session_hash text,
  page text,
  user_agent text,
  device text,
  app_version text,
  message text,
  environment text NOT NULL DEFAULT 'production'
);
CREATE INDEX monitoring_events_created_idx ON public.monitoring_events (created_at DESC);
CREATE INDEX monitoring_events_trace_idx ON public.monitoring_events (trace_id);
CREATE INDEX monitoring_events_service_idx ON public.monitoring_events (service, created_at DESC);
GRANT SELECT ON public.monitoring_events TO authenticated;
GRANT ALL ON public.monitoring_events TO service_role;
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors can view monitoring events" ON public.monitoring_events FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin') OR public.has_admin_permission((SELECT auth.uid()), 'supervision'));

CREATE TABLE public.monitoring_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL UNIQUE CHECK (metric IN ('error_rate','latency_ms','timeout_rate','service_down')),
  threshold numeric NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.monitoring_alert_rules TO authenticated;
GRANT ALL ON public.monitoring_alert_rules TO service_role;
ALTER TABLE public.monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors can view alert rules" ON public.monitoring_alert_rules FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin') OR public.has_admin_permission((SELECT auth.uid()), 'supervision'));
CREATE TRIGGER update_monitoring_alert_rules_updated_at BEFORE UPDATE ON public.monitoring_alert_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.monitoring_alert_rules (metric, threshold) VALUES
 ('error_rate', 5), ('latency_ms', 1000), ('timeout_rate', 3), ('service_down', 1);

CREATE TABLE public.monitoring_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  service text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('warning','critical')),
  title text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  started_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monitoring_incidents_status_idx ON public.monitoring_incidents (status, started_at DESC);
GRANT SELECT ON public.monitoring_incidents TO authenticated;
GRANT ALL ON public.monitoring_incidents TO service_role;
ALTER TABLE public.monitoring_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisors can view incidents" ON public.monitoring_incidents FOR SELECT TO authenticated
USING (public.has_role((SELECT auth.uid()), 'super_admin') OR public.has_admin_permission((SELECT auth.uid()), 'supervision'));
CREATE TRIGGER update_monitoring_incidents_updated_at BEFORE UPDATE ON public.monitoring_incidents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_admin_permissions_atomic(p_actor_user_id uuid, p_target_user_id uuid, p_permissions text[])
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare permission_value text;
begin
  if not exists (select 1 from public.user_roles where user_id=p_actor_user_id and role='super_admin') then raise exception 'super_admin_required'; end if;
  if p_actor_user_id=p_target_user_id then raise exception 'cannot_change_own_admin_permissions'; end if;
  if not exists (select 1 from public.user_roles where user_id=p_target_user_id and role='admin') then raise exception 'admin_role_required'; end if;
  foreach permission_value in array coalesce(p_permissions,array[]::text[]) loop
    if permission_value not in ('complaints','player_activity','ball_stats','publish_results','player_stats','region_stats','security_logs','operations','supervision') then raise exception 'invalid_admin_permission'; end if;
  end loop;
  delete from public.admin_permissions where user_id=p_target_user_id;
  insert into public.admin_permissions(user_id,permission)
  select p_target_user_id, permission_value from unnest(coalesce(p_permissions,array[]::text[])) as permission_value;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.set_admin_permissions_atomic(uuid,uuid,text[]) FROM PUBLIC, anon, authenticated;