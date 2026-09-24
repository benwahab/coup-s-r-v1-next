CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, phone)
  VALUES (NEW.id, CASE WHEN NEW.phone IS NULL OR NEW.phone = '' THEN NULL
                       WHEN left(NEW.phone,1) = '+' THEN NEW.phone
                       ELSE '+' || NEW.phone END)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'player')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

ALTER TABLE public.audit_logs DISABLE TRIGGER prevent_audit_log_update_delete;
DELETE FROM public.audit_logs
 WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('phone-22799294949@coup-sur.local','phone-22790990001@coup-sur.local'))
    OR detail->>'phone' IN ('+22799294949','+22790990001','+22781234567');
ALTER TABLE public.audit_logs ENABLE TRIGGER prevent_audit_log_update_delete;

DELETE FROM public.otp_codes WHERE phone IN ('+22799294949','+22790990001','+22781234567');
DELETE FROM public.auth_login_attempts
 WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('phone-22799294949@coup-sur.local','phone-22790990001@coup-sur.local'));
DELETE FROM auth.users WHERE email IN ('phone-22799294949@coup-sur.local','phone-22790990001@coup-sur.local');