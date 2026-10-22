-- Ruang Kerja: upgrade companion MySQL 8.0.16+ from 1.0.1 to 1.1.0.
-- This is NOT a D1 migration and does not change the hosted application's adapter.
-- Run once against the existing gamstrlv2_next target, after backup and rehearsal
-- on a restored copy. Stop application writes for the entire upgrade.
-- MySQL DDL auto-commits. Do not use --force or rerun blindly after partial failure:
-- inspect INFORMATION_SCHEMA and complete the remaining steps before reopening.
-- Original source database gamstrlv2 is read neither here nor modified.
-- IDs, auth_subject, department text, dates, requests, balances and history remain.
-- Unknown real departments keep work_unit_id NULL for administrator review.

USE `gamstrlv2_next`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE `divisions` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_bin NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `active` tinyint NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `divisions_code_unique` (`code`),
  UNIQUE KEY `divisions_name_unique` (`name`),
  CONSTRAINT `divisions_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE `work_units` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `division_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(150) COLLATE utf8mb4_bin NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `active` tinyint NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `work_units_code_unique` (`code`),
  UNIQUE KEY `work_units_division_name_unique` (`division_id`, `name`),
  KEY `work_units_division_idx` (`division_id`),
  CONSTRAINT `work_units_division_fk` FOREIGN KEY (`division_id`) REFERENCES `divisions` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `work_units_active` CHECK (`active` IN (0,1))
) ENGINE=InnoDB;

-- Master 1.1.0: stable IDs/codes, with names exactly as configured by the organization.
INSERT INTO divisions (id, code, name, sort_order, active) VALUES
  ('div-production', 'PRODUCTION', 'Divisi Produksi', 1, 1),
  ('div-back-office', 'BACK_OFFICE', 'Divisi Back Office', 2, 1);
INSERT INTO work_units (id, division_id, code, name, sort_order, active) VALUES
  ('unit-surfacing', 'div-production', 'SURFACING', 'Surfacing', 1, 1),
  ('unit-warehouse-lab', 'div-production', 'WAREHOUSE_LAB', 'Warehouse LAB', 2, 1),
  ('unit-coating', 'div-production', 'COATING', 'Coating', 3, 1),
  ('unit-quality-control', 'div-production', 'QUALITY_CONTROL', 'Quality Control', 4, 1),
  ('unit-delivery', 'div-production', 'DELIVERY', 'Delivery', 5, 1),
  ('unit-admin-sales', 'div-back-office', 'ADMIN_SALES', 'Admin Sales', 1, 1),
  ('unit-marketing', 'div-back-office', 'MARKETING', 'Marketing', 2, 1),
  ('unit-sales', 'div-back-office', 'SALES', 'Sales', 3, 1),
  ('unit-customer-service', 'div-back-office', 'CUSTOMER_SERVICE', 'Customer Service', 4, 1),
  ('unit-accounting-tax', 'div-back-office', 'ACCOUNTING_TAX', 'Accounting dan Tax', 5, 1),
  ('unit-hr-general-affair', 'div-back-office', 'HR_GENERAL_AFFAIR', 'HR & General Affair', 6, 1),
  ('unit-it', 'div-back-office', 'IT', 'IT', 7, 1),
  ('unit-ar-finance', 'div-back-office', 'AR_FINANCE', 'Account Receiveable & Finance', 8, 1),
  ('unit-purchasing', 'div-back-office', 'PURCHASING', 'Purchasing', 9, 1),
  ('unit-warehouse-goods', 'div-back-office', 'WAREHOUSE_GOODS', 'Warehouse Goods', 10, 1);

ALTER TABLE `employees`
  ADD COLUMN `work_unit_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  ADD KEY `employees_work_unit_idx` (`work_unit_id`),
  ADD CONSTRAINT `employees_work_unit_fk`
    FOREIGN KEY (`work_unit_id`) REFERENCES `work_units` (`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Materialize approval assignments before updating employees. A separate temporary
-- table avoids MySQL's target-table/subquery restriction for the self relationship.
CREATE TEMPORARY TABLE tmp_account_manager_ids (
  id varchar(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY
);
INSERT IGNORE INTO tmp_account_manager_ids (id)
SELECT manager_id FROM employees WHERE active = 1 AND manager_id IS NOT NULL;
INSERT IGNORE INTO tmp_account_manager_ids (id)
SELECT approver_id FROM leave_requests WHERE status = 'pending' AND approver_id IS NOT NULL;
INSERT IGNORE INTO tmp_account_manager_ids (id)
SELECT approver_id FROM purchase_requests
WHERE status IN ('pending_manager','pending_purchasing') AND approver_id IS NOT NULL;

START TRANSACTION;
UPDATE employees e
LEFT JOIN work_units u
  ON BINARY LOWER(u.name) = BINARY LOWER(TRIM(e.department))
  OR (u.code = 'HR_GENERAL_AFFAIR' AND BINARY LOWER(TRIM(e.department)) = 'people & culture')
  OR (u.code = 'IT' AND BINARY LOWER(TRIM(e.department)) = 'teknologi')
  OR (u.code = 'AR_FINANCE' AND BINARY LOWER(TRIM(e.department)) = 'account receivable & finance')
SET e.work_unit_id = CASE
  WHEN BINARY e.role = 'purchasing' THEN 'unit-purchasing'
  WHEN BINARY e.role = 'hr' THEN 'unit-hr-general-affair'
  ELSE u.id
END;

-- Infer ambiguous demo departments only for these known fictional identities.
UPDATE employees
SET work_unit_id = CASE id
  WHEN 'demo-bima' THEN 'unit-surfacing'
  WHEN 'demo-nadia' THEN 'unit-surfacing'
  WHEN 'demo-dimas' THEN 'unit-warehouse-lab'
  WHEN 'demo-raka' THEN 'unit-it'
  WHEN 'demo-sekar' THEN 'unit-ar-finance'
  WHEN 'demo-ayu' THEN 'unit-hr-general-affair'
  WHEN 'demo-intan' THEN 'unit-hr-general-affair'
  WHEN 'demo-fajar' THEN 'unit-purchasing'
END
WHERE LOWER(email) LIKE '%@example.invalid'
  AND id IN ('demo-bima','demo-nadia','demo-dimas','demo-raka',
             'demo-sekar','demo-ayu','demo-intan','demo-fajar');

UPDATE employees SET role = 'manager' WHERE BINARY role IN ('hr','purchasing');
UPDATE employees e
JOIN tmp_account_manager_ids m ON m.id = e.id
SET e.role = 'manager'
WHERE BINARY e.role = 'employee';
COMMIT;

-- MySQL can replace this CHECK directly without dropping a referenced table.
ALTER TABLE `employees`
  DROP CHECK `employees_role`,
  ADD CONSTRAINT `employees_role` CHECK (BINARY `role` IN ('admin','manager','employee'));
DROP TEMPORARY TABLE tmp_account_manager_ids;

-- If the optional legacy import staging table already exists, extend it without
-- overwriting its review decisions or source snapshots. The refreshed import
-- procedure requires a reviewed target_work_unit_id before inserting new staff.
DROP PROCEDURE IF EXISTS upgrade_legacy_stage_110;
DELIMITER $$
CREATE PROCEDURE upgrade_legacy_stage_110()
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = DATABASE() AND table_name = 'legacy_employee_stage')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema = DATABASE() AND table_name = 'legacy_employee_stage'
                       AND column_name = 'target_work_unit_id') THEN
    ALTER TABLE legacy_employee_stage
      ADD COLUMN target_work_unit_id varchar(191) COLLATE utf8mb4_bin DEFAULT NULL;
  END IF;
END$$
DELIMITER ;
CALL upgrade_legacy_stage_110();
DROP PROCEDURE upgrade_legacy_stage_110;

-- Aggregate reconciliation only; administrator reviews actual unmapped rows in
-- the protected employee screen or authorized DBA session.
SELECT role, COUNT(*) AS employee_count FROM employees GROUP BY role;
SELECT COUNT(*) AS unmapped_employees FROM employees WHERE work_unit_id IS NULL;
SELECT COUNT(*) AS division_count FROM divisions;
SELECT COUNT(*) AS work_unit_count FROM work_units;

