-- Financial traceability ledger: append-only event history for money-related state changes.
-- This is a traceability ledger, not a wallet and does not move funds.

CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'payment_pending',
    'payment_confirmed',
    'payment_failed',
    'ticket_paid'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  reference TEXT,
  amount INT CHECK (amount IS NULL OR amount >= 0),
  prize INT CHECK (prize IS NULL OR prize >= 0),
  method TEXT,
  provider_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_user_created
  ON public.financial_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_payment_created
  ON public.financial_ledger (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_ticket_created
  ON public.financial_ledger (ticket_id, created_at DESC);

REVOKE ALL ON public.financial_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financial_ledger TO authenticated;
GRANT ALL ON public.financial_ledger TO service_role;

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view financial ledger"
  ON public.financial_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger_is_append_only';
END;
$$;

DROP TRIGGER IF EXISTS prevent_financial_ledger_update ON public.financial_ledger;
CREATE TRIGGER prevent_financial_ledger_update
  BEFORE UPDATE OR DELETE ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

CREATE OR REPLACE FUNCTION public.record_payment_ledger_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_ledger (
      event_type, user_id, payment_id, ticket_id, reference, amount,
      method, provider_reference, metadata
    ) VALUES (
      'payment_pending', NEW.user_id, NEW.id, NEW.ticket_id, NEW.reference, NEW.amount,
      NEW.method, NEW.reference, jsonb_build_object('status', NEW.status)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.financial_ledger (
      event_type, user_id, payment_id, ticket_id, reference, amount,
      method, provider_reference, metadata
    ) VALUES (
      CASE NEW.status
        WHEN 'confirmed' THEN 'payment_confirmed'
        WHEN 'failed' THEN 'payment_failed'
        ELSE 'payment_pending'
      END,
      NEW.user_id, NEW.id, NEW.ticket_id, NEW.reference, NEW.amount,
      NEW.method, NEW.reference,
      jsonb_build_object('previous_status', OLD.status, 'status', NEW.status)
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.ticket_id IS DISTINCT FROM OLD.ticket_id THEN
    INSERT INTO public.financial_ledger (
      event_type, user_id, payment_id, ticket_id, reference, amount,
      method, provider_reference, metadata
    ) VALUES (
      'payment_pending', NEW.user_id, NEW.id, NEW.ticket_id, NEW.reference, NEW.amount,
      NEW.method, NEW.reference,
      jsonb_build_object('event', 'ticket_linked', 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_financial_ledger ON public.payments;
CREATE TRIGGER payments_financial_ledger
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.record_payment_ledger_event();

CREATE OR REPLACE FUNCTION public.record_ticket_paid_ledger_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.financial_ledger (
      event_type, user_id, ticket_id, amount, prize, metadata
    ) VALUES (
      'ticket_paid', NEW.user_id, NEW.id, NEW.stake, NEW.prize,
      jsonb_build_object('previous_status', OLD.status, 'status', NEW.status, 'ticket_code', NEW.code)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_financial_ledger ON public.tickets;
CREATE TRIGGER tickets_financial_ledger
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.record_ticket_paid_ledger_event();

COMMENT ON TABLE public.financial_ledger IS
  'Append-only financial traceability ledger. Coup Sûr does not hold user funds; provider/LONANI remains the money-movement authority.';
