-- Migration: per-app icon
-- The image itself lives in object storage next to APKs and mappings; the row
-- only carries its key and the content type it must be served with. The upload
-- timestamp versions the icon URL, so replacing an icon is not hidden behind a
-- browser cache entry for the old one.

ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon_path VARCHAR(512);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon_content_type VARCHAR(64);
ALTER TABLE apps ADD COLUMN IF NOT EXISTS icon_updated_at TIMESTAMPTZ;
