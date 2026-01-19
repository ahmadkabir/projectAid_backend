-- Migration SQL: Create project_documents table
-- 
-- This script creates the project_documents table for storing AI-generated documents
--
-- Safe to run multiple times (idempotent)

START TRANSACTION;

-- Create project_documents table
CREATE TABLE IF NOT EXISTS `project_documents` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `projectId` INT NOT NULL,
  `content` LONGTEXT NOT NULL COMMENT 'Generated and edited document content',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_project_document` (`projectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verify the migration
SELECT 
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE,
    COLUMN_KEY,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'project_documents'
ORDER BY ORDINAL_POSITION;

-- Commit the transaction
COMMIT;

-- If you need to rollback, use:
-- ROLLBACK;

-- To remove the table (if needed):
-- DROP TABLE IF EXISTS `project_documents`;
