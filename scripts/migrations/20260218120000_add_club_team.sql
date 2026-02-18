-- Add club_team field to profiles (optional, displayed on public profile)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS club_team TEXT DEFAULT NULL;
