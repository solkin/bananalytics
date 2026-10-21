-- The backend must be stopped during this one-time backfill: the new backend
-- maintains these counters in the same transaction as the raw event insert.
SET LOCAL work_mem = '256MB';

CREATE TABLE IF NOT EXISTS event_stats_daily (
    app_id UUID NOT NULL,
    day DATE NOT NULL,
    version_code BIGINT,
    name VARCHAR(255) NOT NULL,
    count BIGINT NOT NULL,
    UNIQUE NULLS NOT DISTINCT (app_id, day, version_code, name)
);

INSERT INTO event_stats_daily (app_id, day, version_code, name, count)
SELECT app_id, (created_at AT TIME ZONE 'UTC')::date, version_code, name, COUNT(*)
FROM events
GROUP BY 1, 2, 3, 4;

-- Queries without a version filter need the date before version/dimension.
CREATE INDEX IF NOT EXISTS idx_device_stats_app_day ON device_stats_daily (app_id, day);
ANALYZE event_stats_daily;
