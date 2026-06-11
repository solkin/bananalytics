-- Drop device_info expression/GIN indexes added by 004_device_stats_indexes.sql.
-- Device stats are now served from the device_stats_daily rollup (006_perf_rollups.sql),
-- so no query reads events.device_info anymore — these indexes only slow down ingest
-- and waste disk. events is partitioned by month; dropping the parent index cascades
-- to all partition indexes.
DROP INDEX IF EXISTS idx_events_device_info;
DROP INDEX IF EXISTS idx_events_device_manufacturer;
DROP INDEX IF EXISTS idx_events_device_model;
DROP INDEX IF EXISTS idx_events_device_os_version;
DROP INDEX IF EXISTS idx_events_device_country;
DROP INDEX IF EXISTS idx_events_device_language;
DROP INDEX IF EXISTS idx_events_app_device;
