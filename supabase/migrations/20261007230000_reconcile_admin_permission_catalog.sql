-- Reconcile the admin permission catalog with the capabilities exposed by the
-- application. Older migrations added "operations" and "supervision" to the
-- server-side RPC/UI catalog but left the table CHECK constraint unchanged.
-- Without this migration those two permissions can never be persisted.

ALTER TABLE public.admin_permissions
  DROP CONSTRAINT IF EXISTS admin_permissions_permission_check;

ALTER TABLE public.admin_permissions
  ADD CONSTRAINT admin_permissions_permission_check
  CHECK (permission IN (
    'complaints',
    'player_activity',
    'ball_stats',
    'publish_results',
    'player_stats',
    'region_stats',
    'security_logs',
    'operations',
    'supervision'
  ));
