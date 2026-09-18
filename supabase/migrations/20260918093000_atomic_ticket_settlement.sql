-- Atomic settlement of a ticket and its football legs.
-- The settlement engine remains responsible for evaluating results; this RPC
-- only commits the already-evaluated state as one transaction.

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
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_expected_count INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  IF p_ticket_id IS NULL OR p_status NOT IN ('winning', 'losing') OR p_prize < 0 THEN
    RAISE EXCEPTION 'invalid_settlement_input';
  END IF;

  IF jsonb_typeof(p_leg_updates) <> 'array' THEN
    RAISE EXCEPTION 'invalid_leg_updates_payload';
  END IF;

  SELECT *
    INTO v_ticket
    FROM public.tickets
   WHERE id = p_ticket_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found';
  END IF;

  IF v_ticket.status <> 'pending' THEN
    RETURN QUERY SELECT v_ticket.id, v_ticket.status, v_ticket.prize;
    RETURN;
  END IF;

  IF v_ticket.game_id = 'foot' THEN
    IF p_mark_all_foot_losing THEN
      UPDATE public.foot_picks
         SET status = 'losing',
             settled_at = COALESCE(settled_at, now())
       WHERE ticket_id = p_ticket_id;
    ELSE
      SELECT count(*)::integer
        INTO v_expected_count
        FROM jsonb_to_recordset(p_leg_updates)
          AS x(id UUID, status public.ticket_status, settled_at TIMESTAMPTZ);

      IF v_expected_count > 0 THEN
        UPDATE public.foot_picks fp
           SET status = x.status,
               settled_at = x.settled_at
          FROM jsonb_to_recordset(p_leg_updates)
            AS x(id UUID, status public.ticket_status, settled_at TIMESTAMPTZ)
         WHERE fp.id = x.id
           AND fp.ticket_id = p_ticket_id
           AND x.status IN ('winning', 'losing');

        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
        IF v_updated_count <> v_expected_count THEN
          RAISE EXCEPTION 'foot_leg_update_conflict';
        END IF;
      END IF;
    END IF;
  ELSIF p_mark_all_foot_losing OR v_expected_count > 0 THEN
    RAISE EXCEPTION 'non_foot_leg_payload';
  END IF;

  UPDATE public.tickets
     SET status = p_status,
         prize = p_prize
   WHERE id = p_ticket_id
     AND status = 'pending'
  RETURNING tickets.id, tickets.status, tickets.prize
  INTO id, status, prize;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'settlement_conflict';
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ticket_atomic(UUID, public.ticket_status, INTEGER, JSONB, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ticket_atomic(UUID, public.ticket_status, INTEGER, JSONB, BOOLEAN)
  TO service_role;

COMMENT ON FUNCTION public.settle_ticket_atomic(UUID, public.ticket_status, INTEGER, JSONB, BOOLEAN) IS
  'Atomically commits evaluated ticket settlement and football leg states. Called only by trusted settlement server code.';
