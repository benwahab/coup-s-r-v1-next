CREATE POLICY "Client access denied"
ON public.auth_login_attempts
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Client access denied"
ON public.game_rules
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Client access denied"
ON public.otp_codes
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);