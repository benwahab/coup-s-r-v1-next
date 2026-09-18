-- Coup Sûr currently demonstrates Airtel Money only.
-- Other Mobile Money providers remain disabled until an official integration is validated.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_airtel_only_check CHECK (method = 'airtel');
COMMENT ON COLUMN public.payments.method IS 'Current demo payment provider: Airtel Money only. Other providers are disabled pending official partner integration.';