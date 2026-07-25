-- Migration: API key scopes — separate SDK ingestion keys from CI upload keys
-- An SDK key ships inside the APK, so it must not be able to publish releases.
-- Existing keys stay 'sdk': that is what deployed apps already use.

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'sdk';
