-- Migration SQL: Set all existing projects to "documentation"
-- 
-- This script bulk updates all projects where projectType is NULL
-- to set projectType = 'documentation'
--
-- Safe to run multiple times (idempotent)
-- Wrap in a transaction for safety

START TRANSACTION;

-- Check current state (for reference)
SELECT 
    COUNT(*) as total_projects,
    SUM(CASE WHEN projectType IS NULL THEN 1 ELSE 0 END) as null_projectType_count,
    SUM(CASE WHEN projectType = 'documentation' THEN 1 ELSE 0 END) as documentation_count,
    SUM(CASE WHEN projectType = 'software' THEN 1 ELSE 0 END) as software_count
FROM projects;

-- Update all NULL projectType to 'documentation'
UPDATE projects
SET projectType = 'documentation'
WHERE projectType IS NULL;

-- Verify the update
SELECT 
    COUNT(*) as total_projects,
    SUM(CASE WHEN projectType IS NULL THEN 1 ELSE 0 END) as null_projectType_count,
    SUM(CASE WHEN projectType = 'documentation' THEN 1 ELSE 0 END) as documentation_count,
    SUM(CASE WHEN projectType = 'software' THEN 1 ELSE 0 END) as software_count
FROM projects;

-- Commit the transaction
COMMIT;

-- If you need to rollback, use:
-- ROLLBACK;