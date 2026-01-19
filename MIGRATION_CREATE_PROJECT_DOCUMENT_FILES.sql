-- Migration SQL: Create project_document_files table
-- Stores generated/saved document files per project

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `project_document_files` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `projectId` INT NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `fileType` ENUM('pdf', 'docx') NOT NULL,
  `filePath` VARCHAR(500) NOT NULL,
  `createdBy` INT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_project_document_files_projectId` (`projectId`),
  CONSTRAINT `fk_project_document_files_project`
    FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_project_document_files_user`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;
