# Production readiness

- [ ] Diagnose and fix the real preview startup failure on mobile and `/index`.
- [ ] Audit and repair authentication/session handling.
- [ ] Audit and repair PMU, Loto, football, tickets, results, account, and admin flows.
- [ ] Audit Supabase permissions, RLS, RPCs, and environment configuration.
- [ ] Remove unsafe demo behavior from production paths without inventing provider integrations.
- [ ] Upgrade vulnerable production dependencies and verify the lockfile.
- [ ] Validate all routes in the real preview, signed out and signed in where possible.
- [ ] Document external production blockers requiring Airtel Money, SMS, or data-provider credentials.