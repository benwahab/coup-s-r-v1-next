-- Per-ticket cash-out lifecycle, independent from result settlement and incoming stakes.
-- The database change was applied and verified before this migration was committed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  ticket_code text NOT NULL,
  prize integer NOT NULL CHECK (prize > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_reference text,
  CHECK (
    (status = 'pending' AND completed_at IS NULL AND processed_by IS NULL)
    OR
    (status = 'completed' AND completed_at IS NOT NULL AND processed_by IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_cashout_requests_status_requested
  ON public.cashout_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_requested
  ON public.cashout_requests(user_id, requested_at DESC);

ALTER TABLE public.cashout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cashout_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.cashout_requests TO service_role;

ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_event_type_check;
ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_event_type_check
  CHECK (event_type IN (
    'payment_pending', 'payment_confirmed', 'payment_failed', 'ticket_paid',
    'cashout_requested', 'cashout_completed'
  ));

CREATE OR REPLACE FUNCTION public.request_ticket_cashout(p_ticket_code text, p_user_id uuid)
RETURNS public.cashout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_request public.cashout_requests%ROWTYPE;
  v_inserted boolean := false;
BEGIN
  IF p_ticket_code IS NULL OR length(p_ticket_code) < 1 OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_cashout_request';
  END IF;
  SELECT * INTO v_ticket FROM public.tickets
   WHERE code = p_ticket_code AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF v_ticket.status = 'paid' THEN
    SELECT * INTO v_request FROM public.cashout_requests WHERE ticket_id = v_ticket.id;
    IF FOUND THEN RETURN v_request; END IF;
    RAISE EXCEPTION 'ticket_already_paid';
  END IF;
  IF v_ticket.status <> 'winning' OR COALESCE(v_ticket.prize, 0) <= 0 THEN
    RAISE EXCEPTION 'ticket_not_eligible_for_cashout';
  END IF;
  INSERT INTO public.cashout_requests(ticket_id, user_id, ticket_code, prize)
  VALUES (v_ticket.id, p_user_id, v_ticket.code, v_ticket.prize)
  ON CONFLICT (ticket_id) DO NOTHING RETURNING * INTO v_request;
  v_inserted := FOUND;
  IF NOT v_inserted THEN
    SELECT * INTO v_request FROM public.cashout_requests WHERE ticket_id = v_ticket.id;
  ELSE
    INSERT INTO public.financial_ledger(event_type, user_id, ticket_id, reference, prize, metadata)
    VALUES ('cashout_requested', p_user_id, v_ticket.id, v_ticket.code, v_ticket.prize,
      jsonb_build_object('cashout_request_id', v_request.id));
  END IF;
  RETURN v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ticket_cashout(
  p_request_id uuid, p_admin_id uuid, p_provider_reference text DEFAULT NULL
)
RETURNS public.cashout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.cashout_requests%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
BEGIN
  IF p_request_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'invalid_cashout_completion';
  END IF;
  SELECT * INTO v_request FROM public.cashout_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'cashout_request_not_found'; END IF;
  IF v_request.status = 'completed' THEN RETURN v_request; END IF;
  SELECT * INTO v_ticket FROM public.tickets WHERE id = v_request.ticket_id FOR UPDATE;
  IF NOT FOUND OR v_ticket.status <> 'winning' OR v_ticket.prize <> v_request.prize THEN
    RAISE EXCEPTION 'cashout_ticket_state_conflict';
  END IF;
  UPDATE public.tickets SET status = 'paid'
   WHERE id = v_ticket.id AND status = 'winning';
  IF NOT FOUND THEN RAISE EXCEPTION 'cashout_ticket_state_conflict'; END IF;
  UPDATE public.cashout_requests
     SET status = 'completed', completed_at = now(), processed_by = p_admin_id,
         provider_reference = NULLIF(trim(p_provider_reference), '')
   WHERE id = p_request_id RETURNING * INTO v_request;
  INSERT INTO public.financial_ledger(
    event_type, user_id, ticket_id, reference, prize, provider_reference, metadata
  ) VALUES (
    'cashout_completed', v_request.user_id, v_request.ticket_id,
    v_request.ticket_code, v_request.prize, v_request.provider_reference,
    jsonb_build_object('cashout_request_id', v_request.id, 'processed_by', p_admin_id)
  );
  RETURN v_request;
END;
$$;

REVOKE ALL ON FUNCTION public.request_ticket_cashout(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ticket_cashout(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_ticket_cashout(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ticket_cashout(uuid, uuid, text) TO service_role;

COMMIT;
