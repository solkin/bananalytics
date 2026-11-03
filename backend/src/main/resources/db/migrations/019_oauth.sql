-- Migration: OAuth 2.1 authorization server for MCP clients.
-- A client (an agent product) is either registered dynamically (RFC 7591) or
-- identified by the URL of its metadata document; a person approving it creates
-- a grant, which holds the rotating refresh token; disconnecting deletes it,
-- and its codes and tokens with it. Access tokens issued under a
-- grant live in access_tokens next to personal ones. Only hashes are stored.

CREATE TABLE IF NOT EXISTS oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id VARCHAR(512) NOT NULL UNIQUE,
    client_name VARCHAR(200) NOT NULL,
    redirect_uris JSONB NOT NULL,
    kind VARCHAR(16) NOT NULL,  -- 'registered' or 'metadata'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(100) NOT NULL,
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
    -- The token the current one replaced: presenting it again means it leaked.
    previous_refresh_token_hash VARCHAR(64),
    refresh_expires_at TIMESTAMPTZ NOT NULL,
    -- Rotation time, which also bounds the grace window for a retried refresh.
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_grants_user_id ON oauth_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_client_id ON oauth_grants(client_id);
CREATE INDEX IF NOT EXISTS idx_oauth_grants_previous_refresh ON oauth_grants(previous_refresh_token_hash);

CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash VARCHAR(64) PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    scope VARCHAR(100) NOT NULL,
    code_challenge VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    -- Set on redemption; a second redemption revokes the grant it produced.
    used_at TIMESTAMPTZ,
    grant_id UUID REFERENCES oauth_grants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires_at ON oauth_codes(expires_at);

ALTER TABLE access_tokens ADD COLUMN IF NOT EXISTS grant_id UUID REFERENCES oauth_grants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_access_tokens_grant_id ON access_tokens(grant_id);
