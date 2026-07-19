-- Index the predicates used while deleting a release and its related data.
CREATE INDEX IF NOT EXISTS idx_crashes_version_id ON crashes(version_id);
CREATE INDEX IF NOT EXISTS idx_events_app_version ON events(app_id, version_code);
CREATE INDEX IF NOT EXISTS idx_device_stats_app_version ON device_stats_daily(app_id, version_code);
