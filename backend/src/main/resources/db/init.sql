-- Bananalytics Database Schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions (cookie-based)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Applications table
CREATE TABLE IF NOT EXISTS apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apps_api_key ON apps(api_key);
CREATE INDEX IF NOT EXISTS idx_apps_package_name ON apps(package_name);

-- App access (sharing)
CREATE TABLE IF NOT EXISTS app_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',  -- 'admin', 'viewer', or 'tester'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_access_user_id ON app_access(user_id);
CREATE INDEX IF NOT EXISTS idx_app_access_app_id ON app_access(app_id);

-- Application versions with mappings and APK distribution
CREATE TABLE IF NOT EXISTS app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_code BIGINT NOT NULL,
    version_name VARCHAR(50),
    mapping_path VARCHAR(512),
    apk_path VARCHAR(512),
    apk_size BIGINT,
    apk_filename VARCHAR(255),
    apk_uploaded_at TIMESTAMPTZ,
    release_notes TEXT,
    published_for_testers BOOLEAN NOT NULL DEFAULT false,
    mute_crashes BOOLEAN NOT NULL DEFAULT false,
    mute_events BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(app_id, version_code)
);

CREATE INDEX IF NOT EXISTS idx_app_versions_app_id ON app_versions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_versions_published ON app_versions(app_id, published_for_testers);

-- Crash groups (aggregated by fingerprint)
CREATE TABLE IF NOT EXISTS crash_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    fingerprint VARCHAR(64) NOT NULL,
    exception_class VARCHAR(512),
    exception_message TEXT,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    occurrences INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    UNIQUE(app_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_crash_groups_app_id ON crash_groups(app_id);
CREATE INDEX IF NOT EXISTS idx_crash_groups_status ON crash_groups(app_id, status);

-- Individual crashes
CREATE TABLE IF NOT EXISTS crashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    version_id UUID REFERENCES app_versions(id) ON DELETE SET NULL,
    group_id UUID REFERENCES crash_groups(id) ON DELETE SET NULL,
    version_code BIGINT,
    stacktrace_raw TEXT NOT NULL,
    stacktrace_decoded TEXT,
    decoded_at TIMESTAMPTZ,
    decode_error TEXT,
    thread VARCHAR(100),
    is_fatal BOOLEAN NOT NULL DEFAULT true,
    context JSONB,
    breadcrumbs JSONB,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crashes_app_id ON crashes(app_id);
CREATE INDEX IF NOT EXISTS idx_crashes_group_id ON crashes(group_id);
CREATE INDEX IF NOT EXISTS idx_crashes_created_at ON crashes(created_at DESC);

-- Events table (partitioned by month)
CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL,
    app_id UUID NOT NULL,
    version_code BIGINT,
    name VARCHAR(255) NOT NULL,
    tags JSONB,
    fields JSONB,
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX IF NOT EXISTS idx_events_app_id ON events(app_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON events(app_id, name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Create partitions for current and next months
DO $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    FOR i IN 0..2 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        partition_name := 'events_' || TO_CHAR(partition_date, 'YYYY_MM');
        start_date := partition_date;
        end_date := partition_date + INTERVAL '1 month';
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE tablename = partition_name
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
        END IF;
    END LOOP;
END $$;

-- App sessions (SDK sessions for crash-free tracking)
CREATE TABLE IF NOT EXISTS app_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    version_code BIGINT NOT NULL,
    device_id VARCHAR(64),
    has_crash BOOLEAN NOT NULL DEFAULT false,
    has_event BOOLEAN NOT NULL DEFAULT false,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    UNIQUE(app_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_app_id ON app_sessions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_version ON app_sessions(app_id, version_code);
CREATE INDEX IF NOT EXISTS idx_app_sessions_first_seen ON app_sessions(first_seen);
CREATE INDEX IF NOT EXISTS idx_app_sessions_has_crash ON app_sessions(app_id, has_crash);

-- Download tokens for temporary public APK links
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

-- Invitations for pending user invitations
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    token VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(email, app_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_app_id ON invitations(app_id);

-- Device stats indexes for faster aggregation
CREATE INDEX IF NOT EXISTS idx_events_device_info ON events USING GIN (device_info);
CREATE INDEX IF NOT EXISTS idx_events_device_manufacturer ON events ((device_info->>'manufacturer'));
CREATE INDEX IF NOT EXISTS idx_events_device_model ON events ((device_info->>'model'));
CREATE INDEX IF NOT EXISTS idx_events_device_os_version ON events ((device_info->>'os_version'));
CREATE INDEX IF NOT EXISTS idx_events_device_country ON events ((device_info->>'country'));
CREATE INDEX IF NOT EXISTS idx_events_device_language ON events ((device_info->>'language'));
CREATE INDEX IF NOT EXISTS idx_events_app_device ON events (app_id) WHERE device_info IS NOT NULL;
