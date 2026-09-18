-- Le numéro de téléphone est l'identifiant de compte. Il ne doit pas être
-- modifiable via l'API client après création du profil.
CREATE OR REPLACE FUNCTION public.prevent_profile_phone_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'profile_phone_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_phone_change ON public.profiles;
CREATE TRIGGER prevent_profile_phone_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_phone_change();

COMMENT ON COLUMN public.profiles.phone IS
  'Identifiant de compte immuable après création; tout changement futur doit passer par un flux serveur de récupération/vérification.';
