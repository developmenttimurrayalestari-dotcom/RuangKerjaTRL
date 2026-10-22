CREATE TABLE `absence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "absence_type" CHECK("absence_records"."type" IN ('sick','unexcused'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `absence_employee_date_unique` ON `absence_records` (`employee_id`,`date`);--> statement-breakpoint
CREATE TABLE `approval_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`stage` text NOT NULL,
	`decision` text NOT NULL,
	`actor_id` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approval_entity_idx` ON `approval_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_id` text NOT NULL,
	`subject` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `calendar_years` (
	`year` integer PRIMARY KEY NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`source_url` text NOT NULL,
	`verified_at` text,
	`verified_by` text,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`verified_by`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "calendar_year_range" CHECK("calendar_years"."year" BETWEEN 2000 AND 2200),
	CONSTRAINT "calendar_verified" CHECK("calendar_years"."verified" IN (0,1))
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`nip` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`auth_subject` text,
	`department` text NOT NULL,
	`position` text NOT NULL,
	`manager_id` text,
	`role` text DEFAULT 'employee' NOT NULL,
	`workdays` text DEFAULT '1,2,3,4,5' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`join_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`manager_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "employees_role" CHECK("employees"."role" IN ('admin','hr','manager','purchasing','employee')),
	CONSTRAINT "employees_active" CHECK("employees"."active" IN (0,1)),
	CONSTRAINT "employees_no_self_manager" CHECK("employees"."manager_id" IS NULL OR "employees"."manager_id" <> "employees"."id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_nip_unique` ON `employees` (`nip`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_subject_unique` ON `employees` (`auth_subject`);--> statement-breakpoint
CREATE INDEX `employees_manager_idx` ON `employees` (`manager_id`);--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`source_url` text NOT NULL,
	`year` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`year`) REFERENCES `calendar_years`(`year`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "holidays_kind" CHECK("holidays"."kind" IN ('national','collective'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `holidays_date_unique` ON `holidays` (`date`);--> statement-breakpoint
CREATE INDEX `holidays_year_idx` ON `holidays` (`year`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`checksum` text NOT NULL,
	`type` text DEFAULT 'leave_balances' NOT NULL,
	`row_count` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_checksum_unique` ON `import_batches` (`checksum`);--> statement-breakpoint
CREATE TABLE `leave_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`year` integer NOT NULL,
	`entitlement` integer DEFAULT 12 NOT NULL,
	`adjustment` integer DEFAULT 0 NOT NULL,
	`used` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leave_balances_nonnegative" CHECK("leave_balances"."entitlement" >= 0 AND "leave_balances"."used" >= 0 AND "leave_balances"."reserved" >= 0 AND "leave_balances"."entitlement" + "leave_balances"."adjustment" - "leave_balances"."used" - "leave_balances"."reserved" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_balances_employee_year` ON `leave_balances` (`employee_id`,`year`);--> statement-breakpoint
CREATE TABLE `leave_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`event_key` text NOT NULL,
	`employee_id` text NOT NULL,
	`year` integer NOT NULL,
	`request_id` text,
	`event` text NOT NULL,
	`entitlement_delta` integer DEFAULT 0 NOT NULL,
	`adjustment_delta` integer DEFAULT 0 NOT NULL,
	`used_delta` integer DEFAULT 0 NOT NULL,
	`reserved_delta` integer DEFAULT 0 NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`request_id`) REFERENCES `leave_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_ledger_event_key_unique` ON `leave_ledger` (`event_key`);--> statement-breakpoint
CREATE INDEX `leave_ledger_employee_year_idx` ON `leave_ledger` (`employee_id`,`year`);--> statement-breakpoint
CREATE TABLE `leave_request_days` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`date` text NOT NULL,
	`year` integer NOT NULL,
	`chargeable` integer NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `leave_requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leave_day_chargeable" CHECK("leave_request_days"."chargeable" IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_request_days_unique` ON `leave_request_days` (`request_id`,`date`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`employee_id` text NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approver_id` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`policy_snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leave_requests_type" CHECK("leave_requests"."type" IN ('annual','special')),
	CONSTRAINT "leave_requests_status" CHECK("leave_requests"."status" IN ('pending','approved','rejected','cancelled')),
	CONSTRAINT "leave_dates_and_days" CHECK("leave_requests"."start_date" <= "leave_requests"."end_date" AND "leave_requests"."days" > 0),
	CONSTRAINT "leave_no_self_approver" CHECK("leave_requests"."approver_id" IS NULL OR "leave_requests"."approver_id" <> "leave_requests"."employee_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leave_requests_number_unique` ON `leave_requests` (`number`);--> statement-breakpoint
CREATE INDEX `leave_employee_dates_idx` ON `leave_requests` (`employee_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `mutation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "mutation_precondition_failed" CHECK("mutation_guards"."valid" = 1)
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_subject` text NOT NULL,
	`bootstrap_token` text NOT NULL,
	`initialized` integer DEFAULT 0 NOT NULL,
	`company_name` text DEFAULT 'Ruang Kerja' NOT NULL,
	`collective_leave_policy` text DEFAULT 'exclude' NOT NULL,
	`default_annual_entitlement` integer DEFAULT 12 NOT NULL,
	`workdays` text DEFAULT '1,2,3,4,5' NOT NULL,
	`demo` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "organization_singleton" CHECK("organization"."id" = 'main'),
	CONSTRAINT "organization_policy" CHECK("organization"."collective_leave_policy" IN ('exclude','deduct')),
	CONSTRAINT "organization_entitlement" CHECK("organization"."default_annual_entitlement" >= 0)
);
--> statement-breakpoint
CREATE TABLE `purchase_request_items` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit` text NOT NULL,
	`unit_price` integer NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `purchase_requests`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_item_positive" CHECK("purchase_request_items"."quantity" > 0 AND "purchase_request_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `purchase_items_request_idx` ON `purchase_request_items` (`request_id`);--> statement-breakpoint
CREATE TABLE `purchase_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`employee_id` text NOT NULL,
	`title` text NOT NULL,
	`department` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`needed_by` text NOT NULL,
	`reason` text NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'pending_manager' NOT NULL,
	`approver_id` text,
	`decision_note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approver_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "purchase_status" CHECK("purchase_requests"."status" IN ('pending_manager','pending_purchasing','approved','ordered','received','rejected','cancelled')),
	CONSTRAINT "purchase_priority" CHECK("purchase_requests"."priority" IN ('normal','urgent')),
	CONSTRAINT "purchase_total" CHECK("purchase_requests"."total" >= 0),
	CONSTRAINT "purchase_no_self_approver" CHECK("purchase_requests"."approver_id" IS NULL OR "purchase_requests"."approver_id" <> "purchase_requests"."employee_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_number_unique` ON `purchase_requests` (`number`);--> statement-breakpoint
CREATE INDEX `purchase_employee_status_idx` ON `purchase_requests` (`employee_id`,`status`);