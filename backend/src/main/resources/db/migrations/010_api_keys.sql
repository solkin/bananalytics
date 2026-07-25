-- Migration: named API keys — many per app instead of a single apps.api_key
-- Only the SHA-256 hash is stored, so a key is readable once, at creation.

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(16) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_app_id ON api_keys(app_id);

-- Carry over the existing per-app key so deployed SDKs keep authenticating
-- with the value they already ship. pgcrypto is enabled in init.sql.
INSERT INTO api_keys (app_id, name, key_hash, key_prefix, created_at)
SELECT id, 'Default', encode(digest(api_key, 'sha256'), 'hex'), left(api_key, 12), created_at
FROM apps
ON CONFLICT (key_hash) DO NOTHING;

DROP INDEX IF EXISTS idx_apps_api_key;
ALTER TABLE apps DROP COLUMN IF EXISTS api_key;
