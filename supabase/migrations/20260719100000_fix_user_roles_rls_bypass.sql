-- CORRECTIF DE SÉCURITÉ CRITIQUE
--
-- La policy "Admins can manage roles" (créée avant l'introduction du rôle
-- super_admin) autorisait N'IMPORTE QUEL admin simple à modifier
-- directement la table user_roles depuis le client (INSERT/UPDATE/DELETE),
-- en contournant entièrement les fonctions serveur adminGrantRole/
-- adminRevokeRole et leur vérification assertSuperAdmin.
--
-- Concrètement : un admin simple pouvait ouvrir la console du navigateur et
-- s'auto-attribuer le rôle super_admin (ou en donner à n'importe qui) en un
-- seul appel Supabase direct, sans jamais passer par l'interface ni par les
-- contrôles serveur.
--
-- Correctif : la table n'est plus accessible en écriture directe pour
-- personne côté client, quel que soit son rôle. Toute modification des
-- rôles doit obligatoirement passer par les fonctions serveur
-- (adminGrantRole / adminRevokeRole), qui utilisent le service_role et
-- vérifient explicitement le rôle super_admin.

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Lecture : chacun voit ses propres rôles (déjà couvert par la policy
-- existante "Users can view their own roles"), les admins voient tout
-- (déjà couvert par "Admins can view all roles"). Aucune policy
-- INSERT/UPDATE/DELETE n'est recréée : par défaut, sans policy, ces
-- opérations sont refusées à tous les rôles authenticated/anon — seul
-- service_role (qui bypass RLS) peut écrire, ce qui correspond exactement
-- au chemin déjà emprunté par adminGrantRole/adminRevokeRole.
