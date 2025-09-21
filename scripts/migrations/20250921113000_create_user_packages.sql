-- Ensure required extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User packages table: tracks organizer/sponsor packages assigned to users
CREATE TABLE IF NOT EXISTS public.user_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type IN ('organizer','sponsor')),
  package_id text NOT NULL,
  package_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, package_type)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_packages_user_id ON public.user_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_packages_created_at ON public.user_packages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_packages_status ON public.user_packages(status);
