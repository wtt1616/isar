-- Migration: Add Dhuha Preacher
-- Date: 2025-11-20
-- Description: Add dhuha_preacher_id for Saturday and Sunday schedules

USE isar_db;

-- Add dhuha_preacher_id column to preacher_schedules table
ALTER TABLE preacher_schedules
ADD COLUMN dhuha_preacher_id INT NULL AFTER subuh_preacher_id,
ADD FOREIGN KEY (dhuha_preacher_id) REFERENCES preachers(id);
