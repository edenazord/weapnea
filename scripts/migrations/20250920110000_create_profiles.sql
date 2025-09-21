-- Base schema per profili e estensioni richieste
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'final_user',
  is_active boolean NOT NULL DEFAULT true,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
