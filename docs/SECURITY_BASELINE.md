# Coup Sûr — Production Security Baseline

Date: 2026-09-23
Branch: `security/hardening-production-foundation`
Supabase project: `gisjxogimycghgkxedif`

## Purpose

This document records the verified live security baseline of the canonical Supabase project. It is a reference point for future deployments and frontend integration.

It intentionally does **not** reconstruct historical migrations that are no longer present in the Git repository.

## Verified client privileges

### anon
The `anon` role has table-level `SELECT` only on:
- `game_schedules`
- `pmu_horses`
- `pmu_races`

No `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` privileges are granted to `anon` on public tables.

### authenticated
The `authenticated` role has table-level `SELECT` only on:
- `admin_permissions`
- `draw_results`
- `foot_picks`
- `game_schedules`
- `payments`
- `pmu_horses`
- `pmu_races`
- `profiles`
- `tickets`

No client-side write privileges are granted to `authenticated` on public tables. Row-level security remains the authoritative row filter.

## Verified public routines

`authenticated` can execute only:
- `has_admin_permission(uuid, text)`
- `has_role(uuid, app_role)`

Sensitive financial, ticket, settlement, administrative, and statistics routines are not exposed to client roles.

## RLS baseline

RLS is enabled on every public application table currently present.

The following intentionally have RLS enabled with zero client policies because they are backend-only:
- `auth_login_attempts`
- `game_rules`
- `otp_codes`

These are not to be given public policies merely to silence a security-advisor informational finding.

## Integrity triggers

Verified live triggers include:
- append-only protection on `audit_logs`
- published-result mutation protection on `draw_results`
- immutable financial ledger protection on `financial_ledger`
- payment ledger recording on `payments`
- profile phone immutability on `profiles`
- ticket ledger recording on `tickets`
- automatic `updated_at` maintenance

## Migration reproducibility note

Supabase contains historical migrations whose original files are not currently present in this Git branch, including:

- `20260918112000_optimize_rls_and_draw_result_indexes`
- `20260918113000_fix_loto_statistics_number_parsing`
- `20260918114000_lockdown_public_table_grants`
- `20260918122000_add_runtime_query_indexes`
- `20260918123000_airtel_money_only`
- `harden_payment_and_result_uniqueness`
- `remove_duplicate_payment_active_index`

Their effects are already reflected in the live database and later hardening migrations. Their historical SQL must not be fabricated from the current schema.

The repository therefore treats `final_least_privilege_reconciliation` as a current-state security consolidation point, not as a replacement for the missing historical migration source.

## Rules for future changes

1. Do not modify `main` until the production-foundation branch is validated end-to-end.
2. Do not remove or rewrite applied Supabase migration history.
3. Do not invent replacement SQL for missing historical migrations.
4. New schema changes must be committed as new migrations in Git.
5. Any change to client privileges, RLS, security-definer functions, payment flow, ledger logic, or settlement logic requires a fresh security audit.
6. Production Airtel Money integration must add provider verification, callback/webhook validation, idempotency, and reconciliation before real money is enabled.
7. OTP must remain DEMO-only until a real SMS provider is integrated; production must never return or log OTP values.

## Current readiness

- Database security baseline: verified
- Client write surface: locked down
- Financial integrity: verified
- Ticket/payment atomicity: implemented
- Settlement atomicity: implemented
- PMU/Loto V1: manual/real-data foundation
- Football authoritative odds: currently 1X2 only
- OTP: DEMO
- Airtel Money: DEMO
- Historical migration reproducibility: documented limitation
