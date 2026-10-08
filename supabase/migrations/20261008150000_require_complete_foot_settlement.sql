-- Defense in depth: a winning Foot settlement must explicitly resolve every
-- stored foot leg exactly once. The trusted evaluator already sends this list;
-- the database now refuses incomplete or duplicated settlement payloads.
CREATE OR REPLACE FUNCTION public.settle_ticket_atomic(
  p_ticket_id UUID,
  p_status public.ticket_status,
  p_prize INTEGER,
  p_leg_updates JSONB DEFAULT '[]'::jsonb,
  p_mark_all_foot_losing BOOLEAN DEFAULT false
)
RETURNS TABLE(id UUID, status public.ticket_status, prize INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_expected_count INTEGER := 0;
  v_actual_count INTEGER := 0;
  v_distinct_update_count INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_total_odds NUMERIC(30,10) := 1;
  v_expected_prize NUMERIC(30,10);
  v_pick JSONB;
  v_odd NUMERIC;
BEGIN
  IF p_ticket_id IS NULL OR p_status NOT IN ('winning','losing') OR p_prize < 0
     OR (p_status='losing' AND p_prize <> 0)
     OR (p_status='winning' AND p_prize <= 0) THEN
    RAISE EXCEPTION 'invalid_settlement_input';
  END IF;

  IF jsonb_typeof(p_leg_updates) <> 'array' THEN
    RAISE EXCEPTION 'invalid_leg_updates_payload';
  END IF;

  SELECT * INTO v_ticket FROM public.tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF v_ticket.status <> 'pending' THEN
    RETURN QUERY SELECT v_ticket.id,v_ticket.status,v_ticket.prize;
    RETURN;
  END IF;

  IF v_ticket.game_id='foot' THEN
    SELECT count(*)::integer INTO v_actual_count
      FROM public.foot_picks WHERE ticket_id=p_ticket_id;

    IF v_actual_count = 0 THEN
      RAISE EXCEPTION 'missing_foot_picks';
    END IF;

    IF p_mark_all_foot_losing AND p_status <> 'losing' THEN
      RAISE EXCEPTION 'invalid_foot_losing_flag';
    END IF;

    FOR v_pick IN SELECT fp.picks FROM public.foot_picks fp WHERE fp.ticket_id=p_ticket_id LOOP
      IF jsonb_typeof(v_pick) <> 'array' THEN RAISE EXCEPTION 'invalid_foot_pick_payload'; END IF;
      FOR v_pick IN SELECT value FROM jsonb_array_elements(v_pick) LOOP
        v_odd := NULLIF(v_pick->>'odds','')::numeric;
        IF v_odd IS NULL OR v_odd < 1 OR v_odd > 1000 THEN
          RAISE EXCEPTION 'invalid_frozen_odds';
        END IF;
        v_total_odds := v_total_odds * v_odd;
        IF v_total_odds > 100000000000 THEN RAISE EXCEPTION 'foot_payout_overflow'; END IF;
      END LOOP;
    END LOOP;

    IF p_status='winning' THEN
      IF p_mark_all_foot_losing THEN RAISE EXCEPTION 'invalid_foot_losing_flag'; END IF;

      SELECT count(*)::integer,
             count(DISTINCT x.id)::integer
        INTO v_expected_count, v_distinct_update_count
        FROM jsonb_to_recordset(p_leg_updates)
          AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ);

      IF v_expected_count <> v_actual_count
         OR v_distinct_update_count <> v_actual_count THEN
        RAISE EXCEPTION 'foot_leg_update_conflict';
      END IF;

      IF EXISTS (
        SELECT 1
          FROM jsonb_to_recordset(p_leg_updates)
            AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ)
         WHERE x.status <> 'winning'
      ) THEN
        RAISE EXCEPTION 'invalid_winning_leg_status';
      END IF;

      IF EXISTS (
        SELECT 1
          FROM public.foot_picks fp
          LEFT JOIN jsonb_to_recordset(p_leg_updates)
            AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ)
            ON x.id = fp.id
         WHERE fp.ticket_id=p_ticket_id AND x.id IS NULL
      ) THEN
        RAISE EXCEPTION 'foot_leg_update_conflict';
      END IF;

      v_expected_prize := floor(v_ticket.stake * v_total_odds);
      IF v_expected_prize <= 0 OR v_expected_prize > 2147483647
         OR p_prize::numeric <> v_expected_prize THEN
        RAISE EXCEPTION 'foot_payout_mismatch';
      END IF;
    END IF;

    IF p_mark_all_foot_losing THEN
      UPDATE public.foot_picks
         SET status='losing', settled_at=COALESCE(settled_at,now())
       WHERE ticket_id=p_ticket_id;
    ELSE
      SELECT count(*)::integer INTO v_expected_count
        FROM jsonb_to_recordset(p_leg_updates)
          AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ);

      IF v_expected_count > 0 THEN
        UPDATE public.foot_picks fp
           SET status=x.status, settled_at=x.settled_at
          FROM jsonb_to_recordset(p_leg_updates)
            AS x(id UUID,status public.ticket_status,settled_at TIMESTAMPTZ)
         WHERE fp.id=x.id AND fp.ticket_id=p_ticket_id
           AND x.status IN ('winning','losing');
        GET DIAGNOSTICS v_updated_count=ROW_COUNT;
        IF v_updated_count <> v_expected_count THEN
          RAISE EXCEPTION 'foot_leg_update_conflict';
        END IF;
      END IF;
    END IF;
  ELSIF p_mark_all_foot_losing OR jsonb_array_length(p_leg_updates) > 0 THEN
    RAISE EXCEPTION 'non_foot_leg_payload';
  END IF;

  UPDATE public.tickets
     SET status=p_status, prize=p_prize
   WHERE id=p_ticket_id AND status='pending'
  RETURNING tickets.id,tickets.status,tickets.prize INTO id,status,prize;

  IF NOT FOUND THEN RAISE EXCEPTION 'settlement_conflict'; END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ticket_atomic(UUID,public.ticket_status,INTEGER,JSONB,BOOLEAN)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ticket_atomic(UUID,public.ticket_status,INTEGER,JSONB,BOOLEAN)
  TO service_role;
