-- Migration: Add APK distribution functionality
-- Run this on production database

-- Add APK fields to app_versions
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_path VARCHAR(512);
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_size BIGINT;
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_filename VARCHAR(255);
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS apk_uploaded_at TIMESTAMPTZ;
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS release_notes TEXT;
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS published_for_testers BOOLEAN NOT NULL DEFAULT false;

-- Create download tokens table for temporary public links
CREATE TABLE IF NOT EXISTS download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON download_tokens(token);
CREATE INDEX IF NOT EXISTS idx_download_tokens_version ON download_tokens(version_id);
