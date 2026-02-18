-- Add subtitle column to blog_articles
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS subtitle TEXT DEFAULT NULL;
