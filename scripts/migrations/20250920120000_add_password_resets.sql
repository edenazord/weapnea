-- Password reset tokens storage
CREATE TABLE IF NOT EXISTS public.password_resets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful index for expiry
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON public.password_resets(expires_at);
