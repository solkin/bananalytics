-- Restores device_info of sessions recorded before migration 017 and moves their
-- daily counters from 'Unknown' to the real values. Run once by hand, outside
-- migrations, because it works through every day of raw events:
--
--   psql -v ON_ERROR_STOP=1 -f backfill_session_device_info.sql
--
-- Events do not retain a session ID, so a session takes the first event of its
-- device on the same UTC day. Sessions without such an event stay Unknown.
-- Each app and day commits separately and only empty sessions are touched, so an
-- interrupted run can simply be started again.
DO $$
DECLARE
    target RECORD;
    day_start TIMESTAMPTZ;
    day_end TIMESTAMPTZ;
    restored_count BIGINT;
BEGIN
    FOR target IN
        SELECT app_id, (first_seen AT TIME ZONE 'UTC')::date AS day
        FROM app_sessions
        WHERE device_info IS NULL
        GROUP BY 1, 2
        ORDER BY 2 DESC, 1
    LOOP
        day_start := target.day::timestamp AT TIME ZONE 'UTC';
        day_end := (target.day + 1)::timestamp AT TIME ZONE 'UTC';

        WITH known AS (
            SELECT DISTINCT ON (device_info->>'device_id')
                device_info->>'device_id' AS device_id, device_info
            FROM events
            WHERE app_id = target.app_id
              AND created_at >= day_start AND created_at < day_end
              AND device_info->>'device_id' IS NOT NULL
            ORDER BY device_info->>'device_id', created_at
        ), restored AS (
            UPDATE app_sessions s
            SET device_info = known.device_info
            FROM known
            WHERE s.app_id = target.app_id
              AND s.first_seen >= day_start AND s.first_seen < day_end
              AND s.device_info IS NULL
              AND s.device_id = known.device_id
            RETURNING s.version_code, s.has_event, s.device_info
        ), moved AS (
            -- The same dimensions as deviceDimensionsSql in SessionDeviceStatsQuery.kt.
            -- A value that resolves to Unknown is already counted correctly.
            SELECT version_code, dimension, name, COUNT(*) AS count
            FROM restored
            CROSS JOIN LATERAL (VALUES
                ('model', COALESCE(NULLIF(TRIM(CONCAT(device_info->>'manufacturer', ' ', device_info->>'model')), ''), 'Unknown')),
                ('os', COALESCE(NULLIF(device_info->>'os_version', ''), 'Unknown')),
                ('country', COALESCE(NULLIF(UPPER(device_info->>'country'), ''), 'Unknown')),
                ('language', COALESCE(NULLIF(device_info->>'language', ''), 'Unknown'))
            ) dimensions(dimension, name)
            WHERE has_event AND name <> 'Unknown'
            GROUP BY 1, 2, 3
        ), added AS (
            INSERT INTO session_device_stats_daily (app_id, day, version_code, dimension, name, count)
            SELECT target.app_id, target.day, version_code, dimension, name, count FROM moved
            ON CONFLICT (app_id, day, version_code, dimension, name)
            DO UPDATE SET count = session_device_stats_daily.count + EXCLUDED.count
        ), removed AS (
            UPDATE session_device_stats_daily stats
            SET count = GREATEST(stats.count - totals.count, 0)
            FROM (
                SELECT version_code, dimension, SUM(count) AS count FROM moved GROUP BY 1, 2
            ) totals
            WHERE stats.app_id = target.app_id
              AND stats.day = target.day
              AND stats.version_code = totals.version_code
              AND stats.dimension = totals.dimension
              AND stats.name = 'Unknown'
        )
        SELECT COUNT(*) INTO restored_count FROM restored;

        COMMIT;
        RAISE NOTICE '% %: restored % sessions', target.app_id, target.day, restored_count;
    END LOOP;
END
$$;
