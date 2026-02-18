-- Add pdf_url field to events for PDF attachments
ALTER TABLE events ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL;
