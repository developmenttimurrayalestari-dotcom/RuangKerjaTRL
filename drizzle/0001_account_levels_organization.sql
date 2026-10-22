CREATE TABLE `divisions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "divisions_active" CHECK("divisions"."active" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `divisions_code_unique` ON `divisions` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `divisions_name_unique` ON `divisions` (`name`);--> statement-breakpoint
CREATE TABLE `work_units` (
	`id` text PRIMARY KEY NOT NULL,
	`division_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`division_id`) REFERENCES `divisions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "work_units_active" CHECK("work_units"."active" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_units_code_unique` ON `work_units` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_units_division_name_unique` ON `work_units` (`division_id`,`name`);--> statement-breakpoint
CREATE INDEX `work_units_division_idx` ON `work_units` (`division_id`);--> statement-breakpoint
ALTER TABLE `employees` ADD `work_unit_id` text REFERENCES work_units(id);--> statement-breakpoint
CREATE INDEX `employees_work_unit_idx` ON `employees` (`work_unit_id`);
--> statement-breakpoint
-- Canonical organization master for release 1.1.0. IDs and codes are stable API keys.
-- Bounded VALUES statements remain compatible with Cloudflare D1.
INSERT INTO divisions (id, code, name, sort_order, active) VALUES
  ('div-production', 'PRODUCTION', 'Divisi Produksi', 1, 1),
  ('div-back-office', 'BACK_OFFICE', 'Divisi Back Office', 2, 1);
--> statement-breakpoint
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
--> statement-breakpoint
-- Legacy department text is retained for review and historical display.
-- Recognize exact master names and narrowly defined aliases. Generic labels such
-- as Manajemen, Operasional, Gudang and Finance remain unmapped for real accounts.
UPDATE employees
SET work_unit_id = CASE
  WHEN role = 'purchasing' THEN 'unit-purchasing'
  WHEN role = 'hr' THEN 'unit-hr-general-affair'
  ELSE (
    SELECT id FROM work_units
    WHERE lower(name) = lower(trim(employees.department))
      OR (code = 'HR_GENERAL_AFFAIR' AND lower(trim(employees.department)) = 'people & culture')
      OR (code = 'IT' AND lower(trim(employees.department)) = 'teknologi')
      OR (code = 'AR_FINANCE' AND lower(trim(employees.department)) = 'account receivable & finance')
    LIMIT 1
  )
END;
--> statement-breakpoint
-- Only known fictional bootstrap identities receive inferred mappings for
-- ambiguous demo department names. Matching IDs alone never reclassify real staff.
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
WHERE lower(email) LIKE '%@example.invalid'
  AND id IN ('demo-bima', 'demo-nadia', 'demo-dimas', 'demo-raka',
             'demo-sekar', 'demo-ayu', 'demo-intan', 'demo-fajar');
--> statement-breakpoint
-- Consolidate historical capability roles into the new three account levels.
UPDATE employees SET role = 'manager' WHERE role IN ('hr', 'purchasing');
--> statement-breakpoint
-- Retain approval capability for existing assignments without changing
-- relationships, authentication bindings, account status or request history.
UPDATE employees
SET role = 'manager'
WHERE role = 'employee'
  AND (
    EXISTS (SELECT 1 FROM employees report WHERE report.manager_id = employees.id AND report.active = 1)
    OR EXISTS (SELECT 1 FROM leave_requests request WHERE request.approver_id = employees.id AND request.status = 'pending')
    OR EXISTS (SELECT 1 FROM purchase_requests request WHERE request.approver_id = employees.id AND request.status IN ('pending_manager', 'pending_purchasing'))
  );
--> statement-breakpoint
-- The original employees CHECK remains in place to avoid reconstructing a table
-- referenced by employee, request, ledger and audit foreign keys. These triggers
-- enforce the current strict three-role contract for all subsequent writes.
CREATE TRIGGER employees_role_insert
BEFORE INSERT ON employees
FOR EACH ROW WHEN NEW.role NOT IN ('admin', 'manager', 'employee')
BEGIN
  SELECT RAISE(ABORT, 'employees_role_current: admin, manager or employee required');
END;
--> statement-breakpoint
CREATE TRIGGER employees_role_update
BEFORE UPDATE OF role ON employees
FOR EACH ROW WHEN NEW.role NOT IN ('admin', 'manager', 'employee')
BEGIN
  SELECT RAISE(ABORT, 'employees_role_current: admin, manager or employee required');
END;
