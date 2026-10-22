-- Ruang Kerja 1.1.0 — target schema MySQL 8.0.16+ / InnoDB / utf8mb4.
-- Sumber kontrak runtime: db/schema.ts (Cloudflare D1 / SQLite / Drizzle).
-- File ini BUKAN migration D1 dan tidak menghubungkan aplikasi hosted ke MySQL.
-- Gunakan database target baru. Database sumber gamstrlv2 tidak diubah.
-- IF NOT EXISTS aman untuk pengulangan pada schema yang sama; bukan auto-upgrade.
-- Untuk target 1.0.1 yang sudah berisi data, pakai mysql8-upgrade-1.1.0.sql.
-- Tanggal bisnis: DATE, zona Asia/Jakarta. Timestamp: DATETIME(3), UTC.
-- JSON native perlu serialisasi kompatibel pada adapter on-premise.
-- ID/NIP/email/nomor/ref unik memakai collation binary, case-sensitive.
-- Normalisasi spasi/email tetap di server; aturan padding MySQL berbeda dari SQLite.
-- CHECK enum memakai BINARY agar huruf besar/spasi tidak lolos berbeda dari D1.
-- CHECK wajib benar-benar ditegakkan: minimum MySQL 8.0.16.

CREATE DATABASE IF NOT EXISTS `gamstrlv2_next`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `gamstrlv2_next`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `organization` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `owner_subject` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `bootstrap_token` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `initialized` tinyint NOT NULL DEFAULT 0,
  `company_name` text NOT NULL DEFAULT ('Ruang Kerja'),
  `collective_leave_policy` varchar(16) NOT NULL DEFAULT 'exclude',
  `default_annual_entitlement` int NOT NULL DEFAULT 12,
  `workdays` varchar(32) NOT NULL DEFAULT '1,2,3,4,5',
  `demo` tinyint NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `organization_singleton` CHECK (BINARY `id` = 'main'),
  CONSTRAINT `organization_policy` CHECK (BINARY `collective_leave_policy` IN ('exclude','deduct')),
  CONSTRAINT `organization_entitlement` CHECK (`default_annual_entitlement` >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `divisions` (
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

CREATE TABLE IF NOT EXISTS `work_units` (
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
  ('div-back-office', 'BACK_OFFICE', 'Divisi Back Office', 2, 1)
ON DUPLICATE KEY UPDATE id = divisions.id;
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
  ('unit-warehouse-goods', 'div-back-office', 'WAREHOUSE_GOODS', 'Warehouse Goods', 10, 1)
ON DUPLICATE KEY UPDATE id = work_units.id;

CREATE TABLE IF NOT EXISTS `employees` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `nip` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `name` text NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL,
  `auth_subject` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `department` text NOT NULL,
  `work_unit_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `position` text NOT NULL,
  `manager_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `role` varchar(16) NOT NULL DEFAULT 'employee',
  `workdays` varchar(32) NOT NULL DEFAULT '1,2,3,4,5',
  `active` tinyint NOT NULL DEFAULT 1,
  `join_date` date NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `employees_nip_unique` (`nip`),
  UNIQUE KEY `employees_email_unique` (`email`),
  UNIQUE KEY `employees_subject_unique` (`auth_subject`),
  KEY `employees_manager_idx` (`manager_id`),
  KEY `employees_work_unit_idx` (`work_unit_id`),
  CONSTRAINT `employees_manager_fk` FOREIGN KEY (`manager_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `employees_work_unit_fk` FOREIGN KEY (`work_unit_id`) REFERENCES `work_units` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `employees_role` CHECK (BINARY `role` IN ('admin','manager','employee')),
  CONSTRAINT `employees_active` CHECK (`active` IN (0,1)),
  CONSTRAINT `employees_no_self_manager` CHECK (`manager_id` IS NULL OR `manager_id` <> `id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `calendar_years` (
  `year` int NOT NULL,
  `verified` tinyint NOT NULL DEFAULT 0,
  `source_url` text NOT NULL,
  `verified_at` datetime(3) DEFAULT NULL,
  `verified_by` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `revision` int NOT NULL DEFAULT 1,
  PRIMARY KEY (`year`),
  CONSTRAINT `calendar_verified_by_fk` FOREIGN KEY (`verified_by`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `calendar_year_range` CHECK (`year` BETWEEN 2000 AND 2200),
  CONSTRAINT `calendar_verified` CHECK (`verified` IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `holidays` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `date` date NOT NULL,
  `name` text NOT NULL,
  `kind` varchar(16) NOT NULL,
  `source_url` text NOT NULL,
  `year` int NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `holidays_date_unique` (`date`),
  KEY `holidays_year_idx` (`year`),
  CONSTRAINT `holidays_year_fk` FOREIGN KEY (`year`) REFERENCES `calendar_years` (`year`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `holidays_kind` CHECK (BINARY `kind` IN ('national','collective'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `leave_balances` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `year` int NOT NULL,
  `entitlement` int NOT NULL DEFAULT 12,
  `adjustment` int NOT NULL DEFAULT 0,
  `used` int NOT NULL DEFAULT 0,
  `reserved` int NOT NULL DEFAULT 0,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leave_balances_employee_year` (`employee_id`, `year`),
  CONSTRAINT `leave_balances_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_balances_nonnegative` CHECK (`entitlement` >= 0 AND `used` >= 0 AND `reserved` >= 0 AND `entitlement` + `adjustment` - `used` - `reserved` >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `number` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `type` varchar(16) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days` int NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `approver_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `decision_note` text NOT NULL DEFAULT (''),
  `policy_snapshot` json NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leave_requests_number_unique` (`number`),
  KEY `leave_employee_dates_idx` (`employee_id`, `start_date`, `end_date`),
  CONSTRAINT `leave_request_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_request_approver_fk` FOREIGN KEY (`approver_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_requests_type` CHECK (BINARY `type` IN ('annual','special')),
  CONSTRAINT `leave_requests_status` CHECK (BINARY `status` IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT `leave_dates_and_days` CHECK (`start_date` <= `end_date` AND `days` > 0),
  CONSTRAINT `leave_no_self_approver` CHECK (`approver_id` IS NULL OR `approver_id` <> `employee_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `leave_request_days` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `request_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `date` date NOT NULL,
  `year` int NOT NULL,
  `chargeable` tinyint NOT NULL,
  `reason` text NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leave_request_days_unique` (`request_id`, `date`),
  CONSTRAINT `leave_day_request_fk` FOREIGN KEY (`request_id`) REFERENCES `leave_requests` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_day_chargeable` CHECK (`chargeable` IN (0,1))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `leave_ledger` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `event_key` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `year` int NOT NULL,
  `request_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `event` varchar(64) NOT NULL,
  `entitlement_delta` int NOT NULL DEFAULT 0,
  `adjustment_delta` int NOT NULL DEFAULT 0,
  `used_delta` int NOT NULL DEFAULT 0,
  `reserved_delta` int NOT NULL DEFAULT 0,
  `actor_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `leave_ledger_event_key_unique` (`event_key`),
  KEY `leave_ledger_employee_year_idx` (`employee_id`, `year`),
  CONSTRAINT `leave_ledger_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_ledger_request_fk` FOREIGN KEY (`request_id`) REFERENCES `leave_requests` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `leave_ledger_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `absence_records` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `date` date NOT NULL,
  `type` varchar(16) NOT NULL,
  `reason` text NOT NULL,
  `created_by` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `absence_employee_date_unique` (`employee_id`, `date`),
  CONSTRAINT `absence_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `absence_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `absence_type` CHECK (BINARY `type` IN ('sick','unexcused'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `purchase_requests` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `number` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `title` text NOT NULL,
  `department` text NOT NULL,
  `priority` varchar(16) NOT NULL DEFAULT 'normal',
  `needed_by` date NOT NULL,
  `reason` text NOT NULL,
  `total` bigint NOT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'pending_manager',
  `approver_id` varchar(191) COLLATE utf8mb4_bin DEFAULT NULL,
  `decision_note` text NOT NULL DEFAULT (''),
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_number_unique` (`number`),
  KEY `purchase_employee_status_idx` (`employee_id`, `status`),
  CONSTRAINT `purchase_employee_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `purchase_approver_fk` FOREIGN KEY (`approver_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `purchase_status` CHECK (BINARY `status` IN ('pending_manager','pending_purchasing','approved','ordered','received','rejected','cancelled')),
  CONSTRAINT `purchase_priority` CHECK (BINARY `priority` IN ('normal','urgent')),
  CONSTRAINT `purchase_total` CHECK (`total` >= 0),
  CONSTRAINT `purchase_no_self_approver` CHECK (`approver_id` IS NULL OR `approver_id` <> `employee_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `purchase_request_items` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `request_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `name` text NOT NULL,
  `quantity` int NOT NULL,
  `unit` text NOT NULL,
  `unit_price` bigint NOT NULL,
  `sort_order` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_items_request_idx` (`request_id`),
  CONSTRAINT `purchase_item_request_fk` FOREIGN KEY (`request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `purchase_item_positive` CHECK (`quantity` > 0 AND `unit_price` >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `approval_events` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `entity_type` varchar(32) COLLATE utf8mb4_bin NOT NULL,
  `entity_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `stage` varchar(32) NOT NULL,
  `decision` varchar(32) NOT NULL,
  `actor_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `note` text NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `approval_entity_idx` (`entity_type`, `entity_id`),
  CONSTRAINT `approval_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
  -- entity_id bersifat polymorphic; validasi entity wajib di service layer.
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `import_batches` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `checksum` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `type` varchar(32) NOT NULL DEFAULT 'leave_balances',
  `row_count` int NOT NULL,
  `actor_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `import_checksum_unique` (`checksum`),
  CONSTRAINT `import_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `action` varchar(64) NOT NULL,
  `actor_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `subject` text NOT NULL,
  `details` json NOT NULL DEFAULT (JSON_OBJECT()),
  `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_created_idx` (`created_at`),
  CONSTRAINT `audit_actor_fk` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;

-- Tabel internal guard transaksi, bukan data administrasi pengguna.
-- Adapter MySQL harus memakai transaksi eksplisit dan kunci baris yang sesuai.
CREATE TABLE IF NOT EXISTS `mutation_guards` (
  `id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `valid` tinyint NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `mutation_precondition_failed` CHECK (`valid` = 1)
) ENGINE=InnoDB;

-- Tidak ada akun, password, data karyawan, saldo, atau transaksi contoh di file ini.
-- Jangan menjalankan seed demo ke database operasional.
