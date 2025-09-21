-- Forum schema
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id SERIAL PRIMARY KEY,
  name text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  color text,
  order_index int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  content text,
  category_id int REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_pinned boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  views_count int DEFAULT 0,
  replies_count int DEFAULT 0,
  last_reply_at timestamptz,
  last_reply_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL,
  topic_id uuid REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
