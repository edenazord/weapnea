-- Blog Articles schema
CREATE TABLE IF NOT EXISTS public.blog_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text,
  cover_image_url text,
  gallery_images jsonb,
  seo_title text,
  seo_description text,
  seo_keywords text[],
  hashtags text[],
  published boolean DEFAULT false,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
