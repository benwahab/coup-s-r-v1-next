-- Strict admin privacy boundary.
--
-- Administrators may inspect operational activity through dedicated server
-- functions, but must never have direct Data API access to a player's ticket
-- contents or payment records.
--
-- Ticket outcome is produced only by the settlement engine. Admins do not
-- receive a generic ticket mutation API and cannot use RLS to edit tickets.

drop policy if exists "Admins can view all tickets" on public.tickets;
drop policy if exists "Admins can update tickets" on public.tickets;

drop policy if exists "Admins can view all payments" on public.payments;
drop policy if exists "Admins can update payments" on public.payments;

comment on table public.tickets is
  'Player-private betting records. Admins have no direct SELECT/UPDATE policy; settlement is server-controlled and result-driven.';

comment on table public.payments is
  'Player-private payment records. Admin activity views must use sanitized server functions; payment secrets are never stored here.';
