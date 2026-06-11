-- Pre-aggregated daily device stats, maintained at event ingest time.
-- Replaces 4 sequential JSONB GROUP BY scans over the events table (~3.5s on 5M rows).
-- dimension: model | os | country | language; version_code = -1 means "unknown version".
CREATE TABLE IF NOT EXISTS device_stats_daily (
    app_id UUID NOT NULL,
    dimension VARCHAR(16) NOT NULL,
    version_code BIGINT NOT NULL DEFAULT -1,
    day DATE NOT NULL,
    name VARCHAR(512) NOT NULL,
    count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (app_id, dimension, version_code, day, name)
);

-- Backfill from existing events (one-time scan per dimension).
-- Day boundaries are pinned to UTC to match ingest-time bucketing.
INSERT INTO device_stats_daily (app_id, dimension, version_code, day, name, count)
SELECT app_id, 'model', COALESCE(version_code, -1), (created_at AT TIME ZONE 'UTC')::date,
       COALESCE(NULLIF(TRIM(CONCAT(device_info->>'manufacturer', ' ', device_info->>'model')), ''), 'Unknown'),
       COUNT(*)
FROM events
WHERE device_info IS NOT NULL
GROUP BY 1, 3, 4, 5;

INSERT INTO device_stats_daily (app_id, dimension, version_code, day, name, count)
SELECT app_id, 'os', COALESCE(version_code, -1), (created_at AT TIME ZONE 'UTC')::date,
       COALESCE(NULLIF(device_info->>'os_version', ''), 'Unknown'),
       COUNT(*)
FROM events
WHERE device_info IS NOT NULL
GROUP BY 1, 3, 4, 5;

INSERT INTO device_stats_daily (app_id, dimension, version_code, day, name, count)
SELECT app_id, 'country', COALESCE(version_code, -1), (created_at AT TIME ZONE 'UTC')::date,
       COALESCE(NULLIF(UPPER(device_info->>'country'), ''), 'Unknown'),
       COUNT(*)
FROM events
WHERE device_info IS NOT NULL
GROUP BY 1, 3, 4, 5;

INSERT INTO device_stats_daily (app_id, dimension, version_code, day, name, count)
SELECT app_id, 'language', COALESCE(version_code, -1), (created_at AT TIME ZONE 'UTC')::date,
       COALESCE(NULLIF(device_info->>'language', ''), 'Unknown'),
       COUNT(*)
FROM events
WHERE device_info IS NOT NULL
GROUP BY 1, 3, 4, 5;

-- Date-range session queries currently rely on the (app_id, session_id) unique index prefix.
CREATE INDEX IF NOT EXISTS idx_app_sessions_app_first_seen ON app_sessions (app_id, first_seen);
