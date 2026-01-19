-- Migration SQL: Add level and institution columns to projects table
-- 
-- This script adds:
-- - level (ENUM: 'ND', 'HND', 'BSc', 'MSc')
-- - institution (VARCHAR(255), nullable)
--
-- Safe to run multiple times (idempotent)
-- Wrap in a transaction for safety

START TRANSACTION;

-- Check if columns exist (for reference)
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'projects'
  AND COLUMN_NAME IN ('level', 'institution');

-- Add level column (ENUM)
-- Note: If column exists, this will fail - check first or use IF NOT EXISTS pattern
ALTER TABLE `projects` 
ADD COLUMN `level` ENUM('ND', 'HND', 'BSc', 'MSc') NULL 
COMMENT 'Academic level: ND, HND, BSc, or MSc' 
AFTER `price`;

-- Add institution column (VARCHAR)
ALTER TABLE `projects` 
ADD COLUMN `institution` VARCHAR(255) NULL 
COMMENT 'Institution name (e.g., Federal Polytechnic, Kano)' 
AFTER `level`;

-- Verify the migration
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'projects'
  AND COLUMN_NAME IN ('level', 'institution');

-- Commit the transaction
COMMIT;

-- If you need to rollback, use:
-- ROLLBACK;

-- To remove columns (if needed):
-- ALTER TABLE `projects` DROP COLUMN `level`;
-- ALTER TABLE `projects` DROP COLUMN `institution`;
