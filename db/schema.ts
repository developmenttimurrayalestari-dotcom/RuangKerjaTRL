import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index, check, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// ISO date-only strings use Asia/Jakarta business dates. Money is integer IDR.
export const organization = sqliteTable("organization", {
  id: text("id").primaryKey(), ownerSubject: text("owner_subject").notNull(),
  bootstrapToken: text("bootstrap_token").notNull(), initialized: integer("initialized").notNull().default(0),
  companyName: text("company_name").notNull().default("Ruang Kerja"),
  collectiveLeavePolicy: text("collective_leave_policy").notNull().default("exclude"),
  defaultAnnualEntitlement: integer("default_annual_entitlement").notNull().default(12),
  workdays: text("workdays").notNull().default("1,2,3,4,5"), demo: integer("demo").notNull().default(1),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [check("organization_singleton", sql`${t.id} = 'main'`), check("organization_policy", sql`${t.collectiveLeavePolicy} IN ('exclude','deduct')`), check("organization_entitlement", sql`${t.defaultAnnualEntitlement} >= 0`)]);

export const divisions = sqliteTable("divisions", {
  id: text("id").primaryKey(), code: text("code").notNull(), name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0), active: integer("active").notNull().default(1),
}, t => [uniqueIndex("divisions_code_unique").on(t.code), uniqueIndex("divisions_name_unique").on(t.name), check("divisions_active", sql`${t.active} IN (0,1)`)]);

export const workUnits = sqliteTable("work_units", {
  id: text("id").primaryKey(), divisionId: text("division_id").notNull().references(() => divisions.id),
  code: text("code").notNull(), name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0), active: integer("active").notNull().default(1),
}, t => [uniqueIndex("work_units_code_unique").on(t.code), uniqueIndex("work_units_division_name_unique").on(t.divisionId,t.name), index("work_units_division_idx").on(t.divisionId), check("work_units_active", sql`${t.active} IN (0,1)`)]);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(), nip: text("nip").notNull(), name: text("name").notNull(),
  email: text("email").notNull(), authSubject: text("auth_subject"),
  department: text("department").notNull(), position: text("position").notNull(),
  workUnitId: text("work_unit_id").references(() => workUnits.id),
  managerId: text("manager_id").references((): AnySQLiteColumn => employees.id),
  role: text("role", { enum: ["admin","manager","employee"] }).notNull().default("employee"), workdays: text("workdays").notNull().default("1,2,3,4,5"),
  active: integer("active").notNull().default(1), joinDate: text("join_date").notNull(),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
// Keep the historical CHECK in the schema snapshot: rebuilding this referenced
// table would be unnecessary risk. Migration 0001 remaps legacy values and adds
// INSERT/UPDATE triggers that enforce exactly admin/manager/employee afterward.
}, t => [uniqueIndex("employees_nip_unique").on(t.nip), uniqueIndex("employees_email_unique").on(t.email), uniqueIndex("employees_subject_unique").on(t.authSubject), index("employees_manager_idx").on(t.managerId), index("employees_work_unit_idx").on(t.workUnitId), check("employees_role", sql`${t.role} IN ('admin','hr','manager','purchasing','employee')`), check("employees_active", sql`${t.active} IN (0,1)`), check("employees_no_self_manager", sql`${t.managerId} IS NULL OR ${t.managerId} <> ${t.id}`)]);

export const calendarYears = sqliteTable("calendar_years", {
  year: integer("year").primaryKey(), verified: integer("verified").notNull().default(0),
  sourceUrl: text("source_url").notNull(), verifiedAt: text("verified_at"), verifiedBy: text("verified_by").references(() => employees.id),
  revision: integer("revision").notNull().default(1),
}, t => [check("calendar_year_range", sql`${t.year} BETWEEN 2000 AND 2200`), check("calendar_verified", sql`${t.verified} IN (0,1)`)]);

export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey(), date: text("date").notNull(), name: text("name").notNull(),
  kind: text("kind").notNull(), sourceUrl: text("source_url").notNull(),
  year: integer("year").notNull().references(() => calendarYears.year), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("holidays_date_unique").on(t.date), index("holidays_year_idx").on(t.year), check("holidays_kind", sql`${t.kind} IN ('national','collective')`)]);

export const leaveBalances = sqliteTable("leave_balances", {
  id: text("id").primaryKey(), employeeId: text("employee_id").notNull().references(() => employees.id),
  year: integer("year").notNull(), entitlement: integer("entitlement").notNull().default(12),
  adjustment: integer("adjustment").notNull().default(0), used: integer("used").notNull().default(0),
  reserved: integer("reserved").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("leave_balances_employee_year").on(t.employeeId, t.year), check("leave_balances_nonnegative", sql`${t.entitlement} >= 0 AND ${t.used} >= 0 AND ${t.reserved} >= 0 AND ${t.entitlement} + ${t.adjustment} - ${t.used} - ${t.reserved} >= 0`)]);

export const leaveRequests = sqliteTable("leave_requests", {
  id: text("id").primaryKey(), number: text("number").notNull(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  type: text("type").notNull(), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), days: integer("days").notNull(),
  reason: text("reason").notNull(), status: text("status").notNull().default("pending"),
  approverId: text("approver_id").references(() => employees.id), decisionNote: text("decision_note").notNull().default(""),
  policySnapshot: text("policy_snapshot").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("leave_requests_number_unique").on(t.number), index("leave_employee_dates_idx").on(t.employeeId, t.startDate, t.endDate), check("leave_requests_type", sql`${t.type} IN ('annual','special')`), check("leave_requests_status", sql`${t.status} IN ('pending','approved','rejected','cancelled')`), check("leave_dates_and_days", sql`${t.startDate} <= ${t.endDate} AND ${t.days} > 0`), check("leave_no_self_approver", sql`${t.approverId} IS NULL OR ${t.approverId} <> ${t.employeeId}`)]);

export const leaveRequestDays = sqliteTable("leave_request_days", {
  id: text("id").primaryKey(), requestId: text("request_id").notNull().references(() => leaveRequests.id),
  date: text("date").notNull(), year: integer("year").notNull(), chargeable: integer("chargeable").notNull(),
  reason: text("reason").notNull(),
}, t => [uniqueIndex("leave_request_days_unique").on(t.requestId, t.date), check("leave_day_chargeable", sql`${t.chargeable} IN (0,1)`)]);

export const leaveLedger = sqliteTable("leave_ledger", {
  id: text("id").primaryKey(), eventKey: text("event_key").notNull(), employeeId: text("employee_id").notNull().references(() => employees.id),
  year: integer("year").notNull(), requestId: text("request_id").references(() => leaveRequests.id),
  event: text("event").notNull(), entitlementDelta: integer("entitlement_delta").notNull().default(0),
  adjustmentDelta: integer("adjustment_delta").notNull().default(0), usedDelta: integer("used_delta").notNull().default(0),
  reservedDelta: integer("reserved_delta").notNull().default(0), actorId: text("actor_id").notNull().references(() => employees.id), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("leave_ledger_event_key_unique").on(t.eventKey), index("leave_ledger_employee_year_idx").on(t.employeeId, t.year)]);

export const absenceRecords = sqliteTable("absence_records", {
  id: text("id").primaryKey(), employeeId: text("employee_id").notNull().references(() => employees.id), date: text("date").notNull(),
  type: text("type").notNull(), reason: text("reason").notNull(), createdBy: text("created_by").notNull().references(() => employees.id),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("absence_employee_date_unique").on(t.employeeId, t.date), check("absence_type", sql`${t.type} IN ('sick','unexcused')`)]);

export const purchaseRequests = sqliteTable("purchase_requests", {
  id: text("id").primaryKey(), number: text("number").notNull(), employeeId: text("employee_id").notNull().references(() => employees.id),
  title: text("title").notNull(), department: text("department").notNull(), priority: text("priority").notNull().default("normal"),
  neededBy: text("needed_by").notNull(), reason: text("reason").notNull(), total: integer("total").notNull(),
  status: text("status").notNull().default("pending_manager"), approverId: text("approver_id").references(() => employees.id),
  decisionNote: text("decision_note").notNull().default(""), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("purchase_number_unique").on(t.number), index("purchase_employee_status_idx").on(t.employeeId,t.status), check("purchase_status", sql`${t.status} IN ('pending_manager','pending_purchasing','approved','ordered','received','rejected','cancelled')`), check("purchase_priority", sql`${t.priority} IN ('normal','urgent')`), check("purchase_total", sql`${t.total} >= 0`), check("purchase_no_self_approver", sql`${t.approverId} IS NULL OR ${t.approverId} <> ${t.employeeId}`)]);

export const purchaseRequestItems = sqliteTable("purchase_request_items", {
  id: text("id").primaryKey(), requestId: text("request_id").notNull().references(() => purchaseRequests.id), name: text("name").notNull(),
  quantity: integer("quantity").notNull(), unit: text("unit").notNull(), unitPrice: integer("unit_price").notNull(), sortOrder: integer("sort_order").notNull(),
}, t => [index("purchase_items_request_idx").on(t.requestId), check("purchase_item_positive", sql`${t.quantity} > 0 AND ${t.unitPrice} >= 0`)]);

export const approvalEvents = sqliteTable("approval_events", {
  id: text("id").primaryKey(), entityType: text("entity_type").notNull(), entityId: text("entity_id").notNull(), stage: text("stage").notNull(),
  decision: text("decision").notNull(), actorId: text("actor_id").notNull().references(() => employees.id), note: text("note").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("approval_entity_idx").on(t.entityType,t.entityId)]);

export const importBatches = sqliteTable("import_batches", {
  id: text("id").primaryKey(), checksum: text("checksum").notNull(), type: text("type").notNull().default("leave_balances"),
  rowCount: integer("row_count").notNull(), actorId: text("actor_id").notNull().references(() => employees.id), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("import_checksum_unique").on(t.checksum)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), action: text("action").notNull(), actorId: text("actor_id").notNull().references(() => employees.id),
  subject: text("subject").notNull(), details: text("details").notNull().default("{}"), createdAt: text("created_at").notNull(),
}, t => [index("audit_created_idx").on(t.createdAt)]);

// Transaction-local assertions: a failing CHECK rolls the complete D1 batch back.
// Successful batches delete their assertion row before commit. No app state is kept here.
export const mutationGuards = sqliteTable("mutation_guards", {
  id: text("id").primaryKey(), valid: integer("valid").notNull(),
}, t => [check("mutation_precondition_failed", sql`${t.valid} = 1`)]);
