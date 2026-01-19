-- Migration SQL to add projectType and price columns to projects table
-- Run this manually in your MySQL database

-- Add projectType column (ENUM)
ALTER TABLE `projects` 
ADD COLUMN `projectType` ENUM('documentation', 'software') NULL 
COMMENT 'Project type: documentation or software' 
AFTER `status`;

-- Add price column (DECIMAL)
ALTER TABLE `projects` 
ADD COLUMN `price` DECIMAL(10, 2) NULL 
COMMENT 'Single price field (replaces documentationPrice/softwarePrice/fullProjectPrice)' 
AFTER `projectType`;

-- Migrate existing data: Set projectType based on existing prices
UPDATE `projects` 
SET `projectType` = CASE 
  WHEN `softwarePrice` > 0 OR `fullProjectPrice` > 0 THEN 'software'
  WHEN `documentationPrice` > 0 THEN 'documentation'
  ELSE 'documentation'
END,
`price` = CASE
  WHEN `documentationPrice` > 0 THEN `documentationPrice`
  WHEN `softwarePrice` > 0 THEN `softwarePrice`
  WHEN `fullProjectPrice` > 0 THEN `fullProjectPrice`
  ELSE 0
END
WHERE `projectType` IS NULL OR `price` IS NULL;

-- Verify the migration
SELECT COUNT(*) as total_projects, 
       COUNT(`projectType`) as projects_with_type,
       COUNT(`price`) as projects_with_price
FROM `projects`;
