ALTER TABLE public.game_schedules ADD COLUMN IF NOT EXISTS day_schedules jsonb;
UPDATE public.game_schedules
SET day_schedules=(SELECT jsonb_agg(jsonb_build_object('day',d,'open_hour',open_hour,'close_hour',close_hour,'draw_hour',draw_hour,'draw_minute',draw_minute) ORDER BY d) FROM generate_series(0,6) AS d)
WHERE day_schedules IS NULL;
ALTER TABLE public.game_schedules ALTER COLUMN day_schedules SET NOT NULL;
ALTER TABLE public.game_schedules ADD CONSTRAINT game_schedules_seven_days_check CHECK(jsonb_typeof(day_schedules)='array' AND jsonb_array_length(day_schedules)=7);

-- Keep all existing PMU race binding and Loto multiplier safeguards while enforcing the weekday schedule atomically.
CREATE OR REPLACE FUNCTION public.create_ticket_with_payment(
 p_payment_id UUID,p_actor_user_id UUID,p_ticket JSONB,p_foot_picks JSONB DEFAULT '[]'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_payment public.payments%ROWTYPE; v_ticket_id UUID; v_game_id TEXT; v_schedule JSONB;
 v_open_hour INTEGER; v_close_hour INTEGER; v_enabled BOOLEAN; v_local_time TIME; v_weekday INTEGER; v_is_open BOOLEAN;
 v_loto_multiplier NUMERIC(12,4); v_pmu_race_id UUID; v_draw_date DATE;
BEGIN
 IF p_actor_user_id IS NULL OR p_payment_id IS NULL THEN RAISE EXCEPTION 'invalid_atomic_ticket_input'; END IF;
 IF jsonb_typeof(p_foot_picks)<>'array' THEN RAISE EXCEPTION 'invalid_foot_picks_payload'; END IF;
 v_game_id:=p_ticket->>'game_id';
 IF COALESCE(v_game_id,'') NOT IN ('pmu','loto','foot') THEN RAISE EXCEPTION 'invalid_game'; END IF;
 v_draw_date:=NULLIF(p_ticket->>'draw_date','')::date;
 IF v_game_id IN ('pmu','loto') THEN
  SELECT day_schedules,enabled INTO v_schedule,v_enabled FROM public.game_schedules WHERE game_id=v_game_id;
  IF NOT FOUND OR NOT COALESCE(v_enabled,false) THEN RAISE EXCEPTION 'game_schedule_disabled'; END IF;
  v_local_time:=(now() AT TIME ZONE 'Africa/Niamey')::time;
  v_weekday:=EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Niamey'))::integer;
  SELECT (x->>'open_hour')::integer,(x->>'close_hour')::integer INTO v_open_hour,v_close_hour
   FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=v_weekday;
  IF v_open_hour IS NULL OR v_close_hour IS NULL THEN RAISE EXCEPTION 'game_schedule_day_missing'; END IF;
  v_is_open:=CASE WHEN v_open_hour=v_close_hour THEN true WHEN v_open_hour>v_close_hour
   THEN v_local_time>=make_time(v_open_hour,0,0) OR v_local_time<make_time(v_close_hour,0,0)
   ELSE v_local_time>=make_time(v_open_hour,0,0) AND v_local_time<make_time(v_close_hour,0,0) END;
  IF NOT v_is_open THEN
   IF v_weekday=0 THEN
    SELECT (x->>'open_hour')::integer,(x->>'close_hour')::integer INTO v_open_hour,v_close_hour FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=6;
   ELSE
    SELECT (x->>'open_hour')::integer,(x->>'close_hour')::integer INTO v_open_hour,v_close_hour FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=v_weekday-1;
   END IF;
   IF v_open_hour>v_close_hour AND v_local_time<make_time(v_close_hour,0,0) THEN v_is_open:=true; END IF;
  END IF;
  IF NOT v_is_open THEN RAISE EXCEPTION 'game_closed'; END IF;
 END IF;
 IF v_game_id='loto' THEN
  SELECT multiplier::numeric(12,4) INTO v_loto_multiplier FROM public.game_rules
   WHERE game_id='loto' AND pick_count=jsonb_array_length(COALESCE(p_ticket->'picks','[]'::jsonb)) AND active=true;
  IF v_loto_multiplier IS NULL OR v_loto_multiplier<1 OR v_loto_multiplier>100000 THEN RAISE EXCEPTION 'loto_rule_not_configured'; END IF;
 END IF;
 IF v_game_id='pmu' THEN
  BEGIN v_pmu_race_id:=NULLIF(p_ticket->>'pmu_race_id','')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'invalid_pmu_race_id'; END;
  IF v_pmu_race_id IS NULL OR v_draw_date IS NULL THEN RAISE EXCEPTION 'pmu_race_binding_required'; END IF;
  PERFORM 1 FROM public.pmu_races WHERE id=v_pmu_race_id AND race_date=v_draw_date AND status IN ('scheduled','open') AND start_at>now();
  IF NOT FOUND THEN RAISE EXCEPTION 'pmu_race_unavailable'; END IF;
 END IF;
 SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id AND user_id=p_actor_user_id AND status='confirmed' AND ticket_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_available'; END IF;
 IF v_payment.game_id IS DISTINCT FROM v_game_id THEN RAISE EXCEPTION 'payment_game_mismatch'; END IF;
 IF v_payment.amount IS DISTINCT FROM (p_ticket->>'stake')::integer THEN RAISE EXCEPTION 'payment_amount_mismatch'; END IF;
 IF v_payment.method IS DISTINCT FROM p_ticket->>'payment_method' THEN RAISE EXCEPTION 'payment_method_mismatch'; END IF;
 INSERT INTO public.tickets(user_id,code,game_id,game_name,picks,picks_label,stake,payment_method,draw_date,draw_name,status,legs,phone,region,loto_multiplier,pmu_race_id)
 VALUES(p_actor_user_id,p_ticket->>'code',v_game_id,p_ticket->>'game_name',COALESCE(p_ticket->'picks','[]'::jsonb),COALESCE(p_ticket->>'picks_label',''),(p_ticket->>'stake')::integer,p_ticket->>'payment_method',v_draw_date,NULLIF(p_ticket->>'draw_name',''),'pending',COALESCE(p_ticket->'legs','[]'::jsonb),NULLIF(p_ticket->>'phone',''),NULLIF(p_ticket->>'region',''),v_loto_multiplier,v_pmu_race_id)
 RETURNING id INTO v_ticket_id;
 IF jsonb_array_length(p_foot_picks)>0 THEN
  INSERT INTO public.foot_picks(user_id,fixture_id,ticket_id,picks,status)
  SELECT p_actor_user_id,x.fixture_id,v_ticket_id,x.picks,'pending' FROM jsonb_to_recordset(p_foot_picks) AS x(fixture_id UUID,picks JSONB);
 END IF;
 UPDATE public.payments SET ticket_id=v_ticket_id WHERE id=v_payment.id AND user_id=p_actor_user_id AND status='confirmed' AND ticket_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'payment_link_failed'; END IF;
 RETURN v_ticket_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_ticket_with_payment(UUID,UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_with_payment(UUID,UUID,JSONB,JSONB) TO service_role;
COMMENT ON FUNCTION public.create_ticket_with_payment(UUID,UUID,JSONB,JSONB) IS 'Atomically creates a ticket and links its confirmed payment. Enforces per-weekday PMU/Loto hours and retains PMU race and Loto multiplier validation.';
