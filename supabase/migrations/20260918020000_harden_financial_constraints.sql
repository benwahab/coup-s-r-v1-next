-- Défense supplémentaire contre les écritures directes et les courses concurrentes.
-- Les fonctions serveur/service_role restent responsables des mutations sensibles.

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.otp_codes FROM authenticated, anon;

-- Un même identifiant anti-doublon ne peut pas avoir deux paiements actifs
-- (pending/confirmed) simultanément pour un même utilisateur.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_user_active_key
  ON public.payments (user_id, payment_key)
  WHERE payment_key IS NOT NULL
    AND status IN ('pending', 'confirmed');

-- Un paiement ne peut être lié qu'à un seul ticket.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_ticket_id
  ON public.payments (ticket_id)
  WHERE ticket_id IS NOT NULL;

COMMENT ON INDEX public.uq_payments_user_active_key IS
  'Anti-course: un utilisateur ne peut avoir deux paiements pending/confirmed avec la même clé active.';
COMMENT ON INDEX public.uq_payments_ticket_id IS
  'Un ticket ne peut être associé qu''à un seul paiement.';
