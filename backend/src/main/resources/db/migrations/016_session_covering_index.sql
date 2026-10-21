-- Keep analytics off the wide, frequently updated session heap. The key also
-- replaces the older (app_id, first_seen) index; included columns do not change
-- the order or filtering contract.
CREATE INDEX IF NOT EXISTS idx_app_sessions_analytics
    ON app_sessions (app_id, first_seen)
    INCLUDE (version_code, device_id, has_event, has_crash);
DROP INDEX IF EXISTS idx_app_sessions_app_first_seen;

-- Default 20% thresholds let millions of updates accumulate between vacuums,
-- preventing index-only scans even when the requested rows are mostly old.
ALTER TABLE app_sessions SET (
    autovacuum_vacuum_scale_factor = 0.02,
    autovacuum_vacuum_insert_scale_factor = 0.02,
    autovacuum_analyze_scale_factor = 0.02
);
