-- Extra fields for profiles used in payments gating and public profile
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assicurazione text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scadenza_assicurazione date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scadenza_certificato_medico date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram_contact text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS brevetto text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scadenza_brevetto date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assicurazione_document_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certificato_medico_document_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vat_number text;
