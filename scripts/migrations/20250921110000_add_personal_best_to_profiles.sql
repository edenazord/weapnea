-- Aggiunge la colonna JSONB per i record personali dell'utente
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_best jsonb;
