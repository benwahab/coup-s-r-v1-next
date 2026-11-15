CREATE OR REPLACE FUNCTION public.create_ticket_with_payment(p_payment_id uuid, p_actor_user_id uuid, p_ticket jsonb, p_foot_picks jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_payment public.payments%ROWTYPE; v_ticket_id UUID; v_game_id TEXT; v_schedule JSONB;
 v_open_hour INTEGER; v_open_minute INTEGER; v_close_hour INTEGER; v_close_minute INTEGER;
 v_open_total INTEGER; v_close_total INTEGER; v_enabled BOOLEAN; v_local_time TIME;
 v_local_minute INTEGER; v_weekday INTEGER; v_is_open BOOLEAN;
 v_loto_multiplier NUMERIC(12,4); v_pmu_race_id UUID; v_draw_date DATE; v_draw_hour INTEGER; v_draw_minute INTEGER; v_draw_weekday INTEGER;
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
  v_local_minute:=EXTRACT(HOUR FROM v_local_time)::integer*60+EXTRACT(MINUTE FROM v_local_time)::integer;
  v_weekday:=EXTRACT(DOW FROM (now() AT TIME ZONE 'Africa/Niamey'))::integer;
  SELECT (x->>'open_hour')::integer,COALESCE((x->>'open_minute')::integer,0),
         (x->>'close_hour')::integer,COALESCE((x->>'close_minute')::integer,0)
    INTO v_open_hour,v_open_minute,v_close_hour,v_close_minute
    FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=v_weekday;
  IF v_open_hour IS NULL OR v_close_hour IS NULL THEN RAISE EXCEPTION 'game_schedule_day_missing'; END IF;
  v_open_total:=v_open_hour*60+v_open_minute;
  v_close_total:=v_close_hour*60+v_close_minute;
  v_is_open:=CASE WHEN v_open_total=v_close_total THEN true WHEN v_open_total>v_close_total
   THEN v_local_minute>=v_open_total OR v_local_minute<v_close_total
   ELSE v_local_minute>=v_open_total AND v_local_minute<v_close_total END;
  IF NOT v_is_open THEN
   IF v_weekday=0 THEN
    SELECT (x->>'open_hour')::integer,COALESCE((x->>'open_minute')::integer,0),
           (x->>'close_hour')::integer,COALESCE((x->>'close_minute')::integer,0)
      INTO v_open_hour,v_open_minute,v_close_hour,v_close_minute
      FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=6;
   ELSE
    SELECT (x->>'open_hour')::integer,COALESCE((x->>'open_minute')::integer,0),
           (x->>'close_hour')::integer,COALESCE((x->>'close_minute')::integer,0)
      INTO v_open_hour,v_open_minute,v_close_hour,v_close_minute
      FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=v_weekday-1;
   END IF;
   IF v_open_hour IS NOT NULL AND v_close_hour IS NOT NULL THEN
    v_open_total:=v_open_hour*60+v_open_minute;
    v_close_total:=v_close_hour*60+v_close_minute;
    IF v_open_total>v_close_total AND v_local_minute<v_close_total THEN v_is_open:=true; END IF;
   END IF;
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
  v_draw_weekday:=EXTRACT(DOW FROM v_draw_date)::integer;
  SELECT (x->>'draw_hour')::integer,COALESCE((x->>'draw_minute')::integer,0)
    INTO v_draw_hour,v_draw_minute
    FROM jsonb_array_elements(v_schedule) x WHERE (x->>'day')::integer=v_draw_weekday;
  IF v_draw_hour IS NULL THEN RAISE EXCEPTION 'pmu_draw_time_not_configured'; END IF;
  IF now() >= ((v_draw_date + make_time(v_draw_hour,v_draw_minute,0)) AT TIME ZONE 'Africa/Niamey') THEN
    RAISE EXCEPTION 'pmu_race_closed';
  END IF;
  PERFORM 1 FROM public.pmu_races WHERE id=v_pmu_race_id AND race_date=v_draw_date AND status IN ('scheduled','open');
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
END; $function$
;
