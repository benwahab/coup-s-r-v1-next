ALTER TABLE public.audit_logs DISABLE TRIGGER prevent_audit_log_update_delete;
DELETE FROM public.audit_logs WHERE user_id IN (SELECT id FROM auth.users WHERE email='phone-22790990001@coup-sur.local') OR detail->>'phone'='+22790990001';
ALTER TABLE public.audit_logs ENABLE TRIGGER prevent_audit_log_update_delete;
DELETE FROM public.otp_codes WHERE phone='+22790990001';
DELETE FROM public.auth_login_attempts WHERE user_id IN (SELECT id FROM auth.users WHERE email='phone-22790990001@coup-sur.local') OR phone_hash = encode(sha256('+22790990001'::bytea),'hex');
DELETE FROM auth.users WHERE email='phone-22790990001@coup-sur.local';