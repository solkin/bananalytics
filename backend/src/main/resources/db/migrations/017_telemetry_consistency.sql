-- Older sessions have no recorded dimensions; keep them unknown rather than
-- attributing a later event's locale/device information to an earlier session.
ALTER TABLE app_sessions ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE crashes ADD COLUMN IF NOT EXISTS report_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crashes_app_report ON crashes (app_id, report_id) WHERE report_id IS NOT NULL;

CREATE TABLE session_device_stats_daily (
    app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    version_code BIGINT NOT NULL,
    dimension VARCHAR(16) NOT NULL,
    name VARCHAR(512) NOT NULL,
    count BIGINT NOT NULL,
    PRIMARY KEY (app_id, day, version_code, dimension, name)
);

WITH daily AS (
    SELECT app_id, (first_seen AT TIME ZONE 'UTC')::date AS day, version_code, COUNT(*) AS count
    FROM app_sessions WHERE has_event GROUP BY 1, 2, 3
)
INSERT INTO session_device_stats_daily (app_id, day, version_code, dimension, name, count)
SELECT app_id, day, version_code, dimension, 'Unknown', count
FROM daily CROSS JOIN (VALUES ('model'), ('os'), ('country'), ('language')) dimensions(dimension);
