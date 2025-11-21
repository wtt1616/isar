-- Migration: Add Dhuha Preacher
-- Date: 2025-11-20
-- Description: Add dhuha_preacher_id for Saturday and Sunday schedules

-- Add dhuha_preacher_id column to preacher_schedules table
ALTER TABLE preacher_schedules
ADD COLUMN IF NOT EXISTS dhuha_preacher_id INT NULL AFTER subuh_preacher_id;
