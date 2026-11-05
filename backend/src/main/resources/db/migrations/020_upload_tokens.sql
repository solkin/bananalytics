-- Migration: upload tokens — how an agent hands over a build or a mapping.
-- A token is made for one file of one version, works once and for a short
-- while, and acts for the person who made it: the upload is refused if that
-- person is no longer an admin of the app. It travels in a header, never in a
-- URL, so it stays out of access logs. Only the SHA-256 is stored.

CREATE TABLE IF NOT EXISTS upload_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
    kind VARCHAR(16) NOT NULL,  -- 'mapping' or 'apk'
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_upload_tokens_expires_at ON upload_tokens(expires_at);
