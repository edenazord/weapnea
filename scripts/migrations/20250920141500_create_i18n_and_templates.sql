-- i18n and email templates schema
CREATE TABLE IF NOT EXISTS public.languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.translations (
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  PRIMARY KEY(language_code, key)
);

CREATE TABLE IF NOT EXISTS public.email_templates (
  template_type text PRIMARY KEY,
  subject text,
  html text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
