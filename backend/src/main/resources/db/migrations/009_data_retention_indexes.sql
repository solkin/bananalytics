-- Support retention previews and deletes scoped by app and age.
CREATE INDEX IF NOT EXISTS idx_crashes_app_created_at ON crashes(app_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_app_created_at ON events(app_id, created_at);
CREATE INDEX IF NOT EXISTS idx_app_sessions_app_first_seen ON app_sessions(app_id, first_seen);
