-- Restrict the public role-check wrapper to the authenticated caller.
-- The SECURITY DEFINER implementation remains private; the API-facing wrapper
-- must not disclose whether arbitrary user IDs have privileged roles.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND auth.uid() = _user_id
     AND private.has_role(auth.uid(), _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
