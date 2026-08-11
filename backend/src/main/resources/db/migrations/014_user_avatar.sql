-- Migration: per-user avatar
-- Stored exactly like an app icon: the image lives in object storage, the row
-- keeps its key and the content type it must be served with, and the upload
-- timestamp versions the avatar URL so a replacement is not hidden behind a
-- browser cache entry for the old one.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_path VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_content_type VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;
