-- Ajoute un niveau "super_admin" : seul ce rôle peut donner/retirer l'accès
-- admin à d'autres comptes. Les admins simples gardent tous leurs autres
-- droits (dashboard, transactions, etc.) mais ne peuvent plus gérer les
-- autres admins.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
