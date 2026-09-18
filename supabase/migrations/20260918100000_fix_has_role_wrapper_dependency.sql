-- Fix the role-check wrapper so it has no dependency on a private schema
-- function that is not part of the migration chain.
-- The wrapper is intentionally SECURITY INVOKER: RLS on user_roles only exposes
-- the caller's own rows, so the function can safely answer the caller's role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND auth.uid() = _user_id
     AND EXISTS (
       SELECT 1
         FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = _role
     )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_role(uuid, public.app_role) IS
  'Caller-scoped role check. Uses caller RLS and never reveals another user''s roles.';
