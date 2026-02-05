-- Add device_id column to crashes table for efficient device counting
ALTER TABLE crashes ADD COLUMN IF NOT EXISTS device_id VARCHAR(64);

-- Create index for efficient COUNT(DISTINCT device_id) queries
CREATE INDEX IF NOT EXISTS idx_crashes_device_id ON crashes(device_id);

-- Create composite index for filtered queries
CREATE INDEX IF NOT EXISTS idx_crashes_group_device ON crashes(group_id, device_id);

-- Backfill device_id from device_info JSON for existing records
UPDATE crashes 
SET device_id = device_info->>'device_id'
WHERE device_id IS NULL AND device_info IS NOT NULL;
