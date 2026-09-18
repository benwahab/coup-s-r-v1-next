DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view financial ledger" ON public.financial_ledger;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Super admins can view financial ledger"
  ON public.financial_ledger FOR SELECT TO authenticated
  USING (public.has_role((select auth.uid()), 'super_admin'));

CREATE POLICY "Authorized admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role((select auth.uid()), 'super_admin')
    OR public.has_admin_permission((select auth.uid()), 'security_logs')
  );

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own picks" ON public.foot_picks;
CREATE POLICY "Users can view their own picks"
  ON public.foot_picks FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);