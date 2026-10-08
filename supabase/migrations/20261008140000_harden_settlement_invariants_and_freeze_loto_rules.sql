ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS loto_multiplier NUMERIC(12,4);
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_loto_multiplier_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_loto_multiplier_check CHECK (loto_multiplier IS NULL OR (loto_multiplier >= 1 AND loto_multiplier <= 100000));

CREATE OR REPLACE FUNCTION public.create_ticket_with_payment(p_payment_id UUID,p_actor_user_id UUID,p_ticket JSONB,p_foot_picks JSONB DEFAULT '[]'::jsonb)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_payment public.payments%ROWTYPE; v_ticket_id UUID; v_game_id TEXT; v_open_hour INTEGER; v_close_hour INTEGER; v_enabled BOOLEAN; v_local_time TIME; v_is_open BOOLEAN; v_loto_multiplier NUMERIC(12,4);
BEGIN
 IF p_actor_user_id IS NULL OR p_payment_id IS NULL THEN RAISE EXCEPTION 'invalid_atomic_ticket_input'; END IF;
 IF jsonb_typeof(p_foot_picks) <> 'array' THEN RAISE EXCEPTION 'invalid_foot_picks_payload'; END IF;
 v_game_id:=p_ticket->>'game_id';
 IF COALESCE(v_game_id,'') NOT IN ('pmu','loto','foot') THEN RAISE EXCEPTION 'invalid_game'; END IF;
 IF v_game_id IN ('pmu','loto') THEN
  SELECT open_hour,close_hour,enabled INTO v_open_hour,v_close_hour,v_enabled FROM public.game_schedules WHERE game_id=v_game_id;
  IF NOT FOUND OR NOT COALESCE(v_enabled,false) THEN RAISE EXCEPTION 'game_schedule_disabled'; END IF;
  v_local_time:=(now() AT TIME ZONE 'Africa/Niamey')::time;
  v_is_open:=CASE WHEN v_open_hour>v_close_hour THEN v_local_time>=make_time(v_open_hour,0,0) OR v_local_time<make_time(v_close_hour,0,0) ELSE v_local_time>=make_time(v_open_hour,0,0) AND v_local_time<make_time(v_close_hour,0,0) END;
  IF NOT v_is_open THEN RAISE EXCEPTION 'game_closed'; END IF;
 END IF;
 IF v_game_id='loto' THEN
  SELECT multiplier::numeric(12,4) INTO v_loto_multiplier FROM public.game_rules WHERE game_id='loto' AND pick_count=jsonb_array_length(COALESCE(p_ticket->'picks','[]'::jsonb)) AND active=true;
  IF v_loto_multiplier IS NULL OR v_loto_multiplier<1 OR v_loto_multiplier>100000 THEN RAISE EXCEPTION 'loto_rule_not_configured'; END IF;
 END IF;
 SELECT * INTO v_payment FROM public.payments WHERE id=p_payment_id AND user_id=p_actor_user_id AND status='confirmed' AND ticket_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_available'; END IF;
 IF v_payment.game_id IS DISTINCT FROM v_game_id THEN RAISE EXCEPTION 'payment_game_mismatch'; END IF;
 IF v_payment.amount IS DISTINCT FROM (p_ticket->>'stake')::integer THEN RAISE EXCEPTION 'payment_amount_mismatch'; END IF;
 IF v_payment.method IS DISTINCT FROM p_ticket->>'payment_method' THEN RAISE EXCEPTION 'payment_method_mismatch'; END IF;
 INSERT INTO public.tickets(user_id,code,game_id,game_name,picks,picks_label,stake,payment_method,draw_date,draw_name,status,legs,phone,region,loto_multiplier)
 VALUES(p_actor_user_id,p_ticket->>'code',v_game_id,p_ticket->>'game_name',COALESCE(p_ticket->'picks','[]'::jsonb),COALESCE(p_ticket->>'picks_label',''),(p_ticket->>'stake')::integer,p_ticket->>'payment_method',NULLIF(p_ticket->>'draw_date','')::date,NULLIF(p_ticket->>'draw_name',''),'pending',COALESCE(p_ticket->'legs','[]'::jsonb),NULLIF(p_ticket->>'phone',''),NULLIF(p_ticket->>'region',''),v_loto_multiplier) RETURNING id INTO v_ticket_id;
 IF jsonb_array_length(p_foot_picks)>0 THEN INSERT INTO public.foot_picks(user_id,fixture_id,ticket_id,picks,status) SELECT p_actor_user_id,x.fixture_id,v_ticket_id,x.picks,'pending' FROM jsonb_to_recordset(p_foot_picks) AS x(fixture_id UUID,picks JSONB); END IF;
 UPDATE public.payments SET ticket_id=v_ticket_id WHERE id=v_payment.id AND user_id=p_actor_user_id AND status='confirmed' AND ticket_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'payment_link_failed'; END IF;
 RETURN v_ticket_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_ticket_with_payment(UUID,UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_with_payment(UUID,UUID,JSONB,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ticket_atomic(p_ticket_id UUID,p_status public.ticket_status,p_prize INTEGER,p_leg_updates JSONB DEFAULT '[]'::jsonb,p_mark_all_foot_losing BOOLEAN DEFAULT false)
RETURNS TABLE(id UUID,status public.ticket_status,prize INTEGER) LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_ticket public.tickets%ROWTYPE; v_expected_count INTEGER:=0; v_updated_count INTEGER:=0; v_actual_count INTEGER:=0; v_distinct_count INTEGER:=0; v_total_odds NUMERIC(30,10):=1; v_expected_prize NUMERIC(30,10); v_pick JSONB; v_odd NUMERIC;
BEGIN
 IF p_ticket_id IS NULL OR p_status NOT IN ('winning','losing') OR p_prize<0 OR (p_status='losing' AND p_prize<>0) OR (p_status='winning' AND p_prize<=0) THEN RAISE EXCEPTION 'invalid_settlement_input'; END IF;
 IF jsonb_typeof(p_leg_updates)<>'array' THEN RAISE EXCEPTION 'invalid_leg_updates_payload'; END IF;
 SELECT * INTO v_ticket FROM public.tickets WHERE id=p_ticket_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
 IF v_ticket.status<>'pending' THEN RETURN QUERY SELECT v_ticket.id,v_ticket.status,v_ticket.prize; RETURN; END IF;
 IF v_ticket.game_id='foot' THEN
  IF p_mark_all_foot_losing AND p_status<>'losing' THEN RAISE EXCEPTION 'invalid_foot_losing_flag'; END IF;
  FOR v_pick IN SELECT fp.picks FROM public.foot_picks fp WHERE fp.ticket_id=p_ticket_id LOOP
   IF jsonb_typeof(v_pick)<>'array' THEN RAISE EXCEPTION 'invalid_foot_pick_payload'; END IF;
   FOR v_pick IN SELECT value FROM jsonb_array_elements(v_pick) LOOP
    v_odd:=NULLIF(v_pick->>'odds','')::numeric;
    IF v_odd IS NULL OR v_odd<1 OR v_odd>1000 THEN RAISE EXCEPTION 'invalid_frozen_odds'; END IF;
    v_total_odds:=v_total_odds*v_odd;
    IF v_total_odds>100000000000 THEN RAISE EXCEPTION 'foot_payout_overflow'; END IF;
   END LOOP;
  END LOOP;
  IF p_status='winning' THEN
   v_expected_prize:=floor(v_ticket.stake*v_total_odds);
   IF v_expected_prize<=0 OR v_expected_prize>2147483647 OR p_prize::numeric<>v_expected_prize THEN RAISE EXCEPTION 'foot_payout_mismatch'; END IF;
  END IF;
  IF p_mark_all_foot_losing THEN UPDATE public.foot_picks SET status='losing',settled_at=COALESCE(settled_at,now()) WHERE ticket_id=p_ticket_id;
  ELSE
   SELECT count(*)::integer INTO v_expected_count FROM jsonb_to_recordset(p_leg_updates) AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ);
   SELECT count(*)::integer, count(distinct id)::integer INTO v_actual_count, v_distinct_count FROM public.foot_picks WHERE ticket_id=p_ticket_id;
   IF p_status='winning' THEN
    IF v_expected_count=0 OR v_expected_count<>v_actual_count OR v_expected_count<>v_distinct_count THEN
      RAISE EXCEPTION 'foot_leg_update_incomplete';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_leg_updates) AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ)
      WHERE x.status<>'winning'
    ) THEN
      RAISE EXCEPTION 'foot_winning_leg_mismatch';
    END IF;
   ELSIF v_expected_count>0 AND v_expected_count<>v_actual_count THEN
    RAISE EXCEPTION 'foot_leg_update_incomplete';
   END IF;
   IF v_expected_count>0 THEN
    SELECT count(*)::integer INTO v_distinct_count
      FROM (
        SELECT DISTINCT x.id
          FROM jsonb_to_recordset(p_leg_updates) AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ)
      ) ids;
    IF v_distinct_count<>v_expected_count THEN RAISE EXCEPTION 'foot_leg_duplicate'; END IF;
    UPDATE public.foot_picks fp SET status=x.status,settled_at=x.settled_at FROM jsonb_to_recordset(p_leg_updates) AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ) WHERE fp.id=x.id AND fp.ticket_id=p_ticket_id AND x.status IN ('winning','losing');
    GET DIAGNOSTICS v_updated_count=ROW_COUNT;
    IF v_updated_count<>v_expected_count THEN RAISE EXCEPTION 'foot_leg_update_conflict'; END IF;
   END IF;
  END IF;
 ELSIF p_mark_all_foot_losing OR v_expected_count>0 THEN RAISE EXCEPTION 'non_foot_leg_payload';
 END IF;
 UPDATE public.tickets SET status=p_status,prize=p_prize WHERE id=p_ticket_id AND status='pending' RETURNING tickets.id,tickets.status,tickets.prize INTO id,status,prize;
 IF NOT FOUND THEN RAISE EXCEPTION 'settlement_conflict'; END IF;
 RETURN NEXT;
END; $$;
REVOKE ALL ON FUNCTION public.settle_ticket_atomic(UUID,public.ticket_status,INTEGER,JSONB,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ticket_atomic(UUID,public.ticket_status,INTEGER,JSONB,BOOLEAN) TO service_role;
COMMENT ON FUNCTION public.settle_ticket_atomic(UUID,public.ticket_status,INTEGER,JSONB,BOOLEAN) IS 'Atomically commits evaluated ticket settlement and independently verifies payout invariants. Called only by trusted settlement server code.';