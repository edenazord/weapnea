-- Migrate integer IDs to UUID for categories and forum_categories, and related FKs
DO $$ BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END $$;

-- Events -> categories FK
ALTER TABLE IF EXISTS public.events DROP CONSTRAINT IF EXISTS events_category_id_fkey;

-- Categories.id to UUID
ALTER TABLE IF EXISTS public.categories
  ALTER COLUMN id DROP DEFAULT;

-- Convert existing integer ids to new generated UUIDs (table expected empty in prod)
ALTER TABLE IF EXISTS public.categories
  ALTER COLUMN id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS public.categories
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop serial sequence if present
DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.categories','id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('DROP SEQUENCE IF EXISTS %s', seq_name);
  END IF;
END $$;

-- Alter events.category_id to UUID and restore FK
ALTER TABLE IF EXISTS public.events
  ALTER COLUMN category_id TYPE uuid USING NULL;

ALTER TABLE IF EXISTS public.events
  ADD CONSTRAINT events_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

-- Forum: topics -> forum_categories FK
ALTER TABLE IF EXISTS public.forum_topics DROP CONSTRAINT IF EXISTS forum_topics_category_id_fkey;

-- Forum categories.id to UUID
ALTER TABLE IF EXISTS public.forum_categories
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE IF EXISTS public.forum_categories
  ALTER COLUMN id TYPE uuid USING gen_random_uuid();

ALTER TABLE IF EXISTS public.forum_categories
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Drop forum serial sequence if present
DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.forum_categories','id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('DROP SEQUENCE IF EXISTS %s', seq_name);
  END IF;
END $$;

-- Alter forum_topics.category_id to UUID and restore FK
ALTER TABLE IF EXISTS public.forum_topics
  ALTER COLUMN category_id TYPE uuid USING NULL;

ALTER TABLE IF EXISTS public.forum_topics
  ADD CONSTRAINT forum_topics_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.forum_categories(id) ON DELETE SET NULL;
