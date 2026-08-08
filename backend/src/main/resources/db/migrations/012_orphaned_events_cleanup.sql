-- Migration: drop events left over from deleted apps
-- `events` and its `device_stats_daily` rollup have no foreign key to `apps`,
-- so until AppRepository.delete started clearing them explicitly, every app
-- deletion left its events and stats in the database forever.

-- The orphaned app_ids come from a loose index scan over idx_events_app_id:
-- one index entry per app instead of the full sequential scan a plain
-- `WHERE NOT EXISTS` anti-join would read from every partition.
WITH RECURSIVE event_apps AS (
    SELECT (SELECT app_id FROM events ORDER BY app_id LIMIT 1) AS app_id
    UNION ALL
    SELECT (SELECT app_id FROM events WHERE app_id > event_apps.app_id ORDER BY app_id LIMIT 1)
    FROM event_apps
    WHERE event_apps.app_id IS NOT NULL
)
DELETE FROM events
WHERE app_id IN (
    SELECT app_id
    FROM event_apps
    WHERE app_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM apps WHERE apps.id = event_apps.app_id)
);

-- device_stats_daily is a per-app/day rollup, small enough to scan outright.
DELETE FROM device_stats_daily
WHERE NOT EXISTS (SELECT 1 FROM apps WHERE apps.id = device_stats_daily.app_id);
