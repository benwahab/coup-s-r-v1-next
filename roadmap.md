# Production readiness

- [x] Diagnose and fix the real preview startup failure on mobile and `/index`.
- [x] Audit and repair authentication/session handling.
- [x] Audit PMU, Loto, football, tickets, results, account, and admin flows.
- [x] Audit Supabase permissions, RLS, RPCs, and environment configuration.
- [x] Remove unsafe demo behavior from production paths without inventing provider integrations.
- [x] Upgrade vulnerable production dependencies and verify the lockfile.
- [x] Validate public routes and the private admin redirect in the real signed-out mobile preview.
- [ ] Configure and validate a real SMS provider (blocked: provider URL and key required).
- [ ] Configure and validate Airtel Money charging and signed callbacks (blocked: Airtel credentials and contract required).
- [ ] Configure and validate PMU/football synchronization and payout/cashout (blocked: provider credentials and payout rules required).
- [ ] Validate authenticated player and administrator journeys (blocked: working SMS provider or designated test sessions required).
- [ ] Enable leaked-password protection in Supabase Auth settings (blocked: hosted Auth setting requires owner action).