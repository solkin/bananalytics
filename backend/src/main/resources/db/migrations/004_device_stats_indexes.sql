-- Add indexes for faster device stats aggregation
-- GIN index on device_info for JSONB containment queries
CREATE INDEX IF NOT EXISTS idx_events_device_info ON events USING GIN (device_info);

-- B-tree indexes on extracted JSONB fields for faster GROUP BY
CREATE INDEX IF NOT EXISTS idx_events_device_manufacturer ON events ((device_info->>'manufacturer'));
CREATE INDEX IF NOT EXISTS idx_events_device_model ON events ((device_info->>'model'));
CREATE INDEX IF NOT EXISTS idx_events_device_os_version ON events ((device_info->>'os_version'));
CREATE INDEX IF NOT EXISTS idx_events_device_country ON events ((device_info->>'country'));
CREATE INDEX IF NOT EXISTS idx_events_device_language ON events ((device_info->>'language'));

-- Composite index for common query pattern (app_id + device_info not null)
CREATE INDEX IF NOT EXISTS idx_events_app_device ON events (app_id) WHERE device_info IS NOT NULL;
