-- Atomic financial/ticket finalization.
-- All three writes (ticket, football picks, payment->ticket link) happen in
-- one PostgreSQL transaction. The function is intentionally callable only by
-- the trusted service_role used by server functions.

CREATE OR REPLACE FUNCTION public.create_ticket_with_payment(
  p_payment_id UUID,
  p_actor_user_id UUID,
  p_ticket JSONB,
  p_foot_picks JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_ticket_id UUID;
BEGIN
  IF p_actor_user_id IS NULL OR p_payment_id IS NULL THEN
    RAISE EXCEPTION 'invalid_atomic_ticket_input';
  END IF;

  IF jsonb_typeof(p_foot_picks) <> 'array' THEN
    RAISE EXCEPTION 'invalid_foot_picks_payload';
  END IF;

  SELECT *
    INTO v_payment
    FROM public.payments
   WHERE id = p_payment_id
     AND user_id = p_actor_user_id
     AND status = 'confirmed'
     AND ticket_id IS NULL
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_available';
  END IF;

  IF COALESCE(p_ticket->>'game_id', '') NOT IN ('pmu', 'loto', 'foot') THEN
    RAISE EXCEPTION 'invalid_game';
  END IF;

  IF v_payment.game_id IS DISTINCT FROM p_ticket->>'game_id' THEN
    RAISE EXCEPTION 'payment_game_mismatch';
  END IF;

  IF v_payment.amount IS DISTINCT FROM (p_ticket->>'stake')::integer THEN
    RAISE EXCEPTION 'payment_amount_mismatch';
  END IF;

  IF v_payment.method IS DISTINCT FROM p_ticket->>'payment_method' THEN
    RAISE EXCEPTION 'payment_method_mismatch';
  END IF;

  INSERT INTO public.tickets (
    user_id, code, game_id, game_name, picks, picks_label, stake,
    payment_method, draw_date, draw_name, status, legs, phone, region
  ) VALUES (
    p_actor_user_id,
    p_ticket->>'code',
    p_ticket->>'game_id',
    p_ticket->>'game_name',
    COALESCE(p_ticket->'picks', '[]'::jsonb),
    COALESCE(p_ticket->>'picks_label', ''),
    (p_ticket->>'stake')::integer,
    p_ticket->>'payment_method',
    NULLIF(p_ticket->>'draw_date', '')::date,
    NULLIF(p_ticket->>'draw_name', ''),
    'pending',
    COALESCE(p_ticket->'legs', '[]'::jsonb),
    NULLIF(p_ticket->>'phone', ''),
    NULLIF(p_ticket->>'region', '')
  )
  RETURNING id INTO v_ticket_id;

  IF jsonb_array_length(p_foot_picks) > 0 THEN
    INSERT INTO public.foot_picks (
      user_id, fixture_id, ticket_id, picks, status
    )
    SELECT
      p_actor_user_id,
      x.fixture_id,
      v_ticket_id,
      x.picks,
      'pending'
    FROM jsonb_to_recordset(p_foot_picks)
      AS x(fixture_id UUID, picks JSONB);
  END IF;

  UPDATE public.payments
     SET ticket_id = v_ticket_id
   WHERE id = v_payment.id
     AND user_id = p_actor_user_id
     AND status = 'confirmed'
     AND ticket_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_link_failed';
  END IF;

  RETURN v_ticket_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ticket_with_payment(UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_with_payment(UUID, UUID, JSONB, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_ticket_with_payment(UUID, UUID, JSONB, JSONB) IS
  'Atomically creates a ticket, its football picks, and links the confirmed payment. Called only by trusted server code.';
