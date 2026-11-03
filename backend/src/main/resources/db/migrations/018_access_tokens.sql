-- Migration: access tokens — credentials of a person, not of an app.
-- They authenticate agents on the MCP endpoint; what a token can see is always
-- capped by its owner's current role in each app. Only the SHA-256 is stored.

CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    scope VARCHAR(100) NOT NULL,  -- space-separated: 'mcp:read' or 'mcp:read mcp:write'
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(16) NOT NULL,
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_tokens_user_id ON access_tokens(user_id);
