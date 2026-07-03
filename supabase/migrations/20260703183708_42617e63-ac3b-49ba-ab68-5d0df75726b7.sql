-- ============================================================
-- Phase 1 — Fondations sécurité : schéma + RLS strict
-- ============================================================

-- 1. Enum de rôles applicatifs
CREATE TYPE public.app_role AS ENUM ('admin', 'player');

-- 2. Enums pour tickets et paiements
CREATE TYPE public.ticket_status AS ENUM ('pending', 'losing', 'winning', 'paid');
CREATE TYPE public.payment_status AS ENUM ('pending', 'confirmed', 'failed');

-- 3. Fonction utilitaire updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- USER_ROLES  (jamais stocké dans profiles → anti-escalade)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Lecture seule sur ses propres rôles ; personne ne peut s'auto-attribuer un rôle
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fonction SECURITY DEFINER pour éviter la récursion RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Les admins peuvent voir tous les rôles (pour panneau d'admin)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Les admins peuvent gérer les rôles (via serveur en pratique)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- OTP_CODES  (aucun accès client — serveur uniquement)
-- ============================================================
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone ON public.otp_codes (phone, created_at DESC);

-- Aucun GRANT à anon/authenticated : accès service_role uniquement
GRANT ALL ON public.otp_codes TO service_role;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
-- Pas de policy = tout est refusé pour anon/authenticated (verrouillage total)

-- ============================================================
-- TICKETS
-- ============================================================
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                     -- ex. "LNN-1234567" affiché à l'utilisateur
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,                         -- 'pmu' | 'loto' | 'foot'
  game_name TEXT NOT NULL,
  picks JSONB NOT NULL,
  picks_label TEXT NOT NULL,
  stake INT NOT NULL CHECK (stake >= 0),
  payment_method TEXT NOT NULL,
  draw_date DATE,
  draw_name TEXT,
  status public.ticket_status NOT NULL DEFAULT 'pending',
  prize INT,
  legs JSONB,
  phone TEXT,
  region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_user ON public.tickets (user_id, created_at DESC);
CREATE INDEX idx_tickets_game_date ON public.tickets (game_id, draw_date);

GRANT SELECT, INSERT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Un joueur voit UNIQUEMENT ses propres tickets
CREATE POLICY "Users can view their own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Un joueur peut créer un ticket pour lui-même, mais status forcé à 'pending' et prize NULL
CREATE POLICY "Users can insert their own tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND prize IS NULL
  );

-- Les admins voient tous les tickets
CREATE POLICY "Admins can view all tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Les admins peuvent mettre à jour statuts / gains
CREATE POLICY "Admins can update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  amount INT NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL,           -- 'airtel', 'moov', 'zamani', ...
  status public.payment_status NOT NULL DEFAULT 'pending',
  reference TEXT UNIQUE NOT NULL, -- txRef côté opérateur/simulé
  payment_key TEXT,               -- empreinte anti-doublon (paymentKey)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON public.payments (user_id, created_at DESC);
CREATE INDEX idx_payments_key ON public.payments (payment_key, created_at DESC);

GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Insertion "pending" uniquement — la confirmation passe par le serveur (service_role)
CREATE POLICY "Users can insert their own pending payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AUDIT_LOGS  (écriture serveur uniquement)
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  detail JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs (action, created_at DESC);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Les admins seulement peuvent lire l'audit ; personne (côté client) n'écrit
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Trigger : auto-création profile + rôle 'player' à chaque signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone)
  VALUES (NEW.id, NEW.phone)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
