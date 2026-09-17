-- Phase sécurité : empêcher toute écriture directe des données financières et des paris.
-- Les opérations d'écriture passent désormais par des fonctions serveur avec
-- authentification et validation métier.

REVOKE INSERT, UPDATE, DELETE ON public.tickets FROM authenticated;
DROP POLICY IF EXISTS "Users can insert their own tickets" ON public.tickets;

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated;
DROP POLICY IF EXISTS "Users can insert their own pending payments" ON public.payments;

REVOKE INSERT, UPDATE, DELETE ON public.foot_picks FROM authenticated;
DROP POLICY IF EXISTS "Users can insert their own picks" ON public.foot_picks;

-- Les matchs restent publiquement lisibles. Les écritures de fixtures/picks,
-- tickets et paiements sont réservées aux fonctions serveur/service_role.
