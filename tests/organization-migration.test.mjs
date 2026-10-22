import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestD1 } from './d1-fixture.mjs';

const initialMigration = fileURLToPath(new URL('../drizzle/0000_productive_shatterstar.sql', import.meta.url));
const upgradeSql = readFileSync(new URL('../drizzle/0001_account_levels_organization.sql', import.meta.url), 'utf8');
const registry = JSON.parse(readFileSync(new URL('../lib/data/organization-units.json', import.meta.url), 'utf8'));
const timestamp = '2026-10-19T04:05:06.000Z';

async function oldDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'ruangkerja-legacy-migration-'));
  const previous = process.env.TEST_MIGRATIONS_DIR;
  copyFileSync(initialMigration, join(directory, '0000_productive_shatterstar.sql'));
  process.env.TEST_MIGRATIONS_DIR = directory;
  try { return await createTestD1(); }
  finally {
    if (previous === undefined) delete process.env.TEST_MIGRATIONS_DIR;
    else process.env.TEST_MIGRATIONS_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
}

async function upgrade(database) {
  const statements = upgradeSql.split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean);
  await database.batch(statements.map(sql => database.prepare(sql)));
}

function employeeInsert(database, employee, hasOrganization = false) {
  const columns = 'id,nip,name,email,auth_subject,department,position,manager_id,role,workdays,active,join_date,created_at,updated_at';
  const values = [employee.id, `NIP-${employee.id}`, `Fixture ${employee.id}`, employee.email ?? `${employee.id}@example.invalid`,
    employee.authSubject ?? null, employee.department ?? 'Unit lama belum dipetakan', 'Fixture position', employee.managerId ?? null,
    employee.role ?? 'employee', '1,2,3,4,5', employee.active ?? 1, '2020-01-02', timestamp, timestamp];
  if (hasOrganization) values.push(employee.workUnitId ?? null);
  return database.prepare(`INSERT INTO employees (${columns}${hasOrganization ? ',work_unit_id' : ''}) VALUES (${values.map(() => '?').join(',')})`).bind(...values);
}

async function rows(database, sql) {
  return (await database.prepare(sql).all()).results.map(row => ({ ...row }));
}

test('fresh migration seeds exact organization master and enforces account roles and organization references', async () => {
  const database = await createTestD1();
  try {
    assert.deepEqual(await rows(database, 'SELECT id,code,name,sort_order AS sortOrder,active FROM divisions ORDER BY sort_order'),
      registry.divisions.map(division => ({ ...division, active: 1 })));
    assert.deepEqual(await rows(database, `SELECT u.id,u.division_id AS divisionId,u.code,u.name,u.sort_order AS sortOrder,u.active
      FROM work_units u JOIN divisions d ON d.id=u.division_id ORDER BY d.sort_order,u.sort_order`),
      registry.workUnits.map(unit => ({ ...unit, active: 1 })));
    assert.equal(registry.divisions.length, 2);
    assert.equal(registry.workUnits.length, 15);
    assert.deepEqual(registry.divisions.map(division => division.name), ['Divisi Produksi', 'Divisi Back Office']);
    assert.deepEqual(registry.workUnits.filter(unit => unit.divisionId === 'div-production').map(unit => unit.name),
      ['Surfacing', 'Warehouse LAB', 'Coating', 'Quality Control', 'Delivery']);
    assert.deepEqual(registry.workUnits.filter(unit => unit.divisionId === 'div-back-office').map(unit => unit.name),
      ['Admin Sales', 'Marketing', 'Sales', 'Customer Service', 'Accounting dan Tax', 'HR & General Affair', 'IT', 'Account Receiveable & Finance', 'Purchasing', 'Warehouse Goods']);
    assert.equal(registry.workUnits.find(unit => unit.code === 'PURCHASING')?.id, 'unit-purchasing');

    for (const role of ['admin', 'manager', 'employee']) {
      await employeeInsert(database, { id: `valid-${role}`, role, workUnitId: 'unit-purchasing' }, true).run();
    }
    // A legacy unknown unit remains representable until an administrator maps it.
    await employeeInsert(database, { id: 'legacy-unmapped' }, true).run();
    for (const role of ['hr', 'purchasing', 'superadmin', 'staff']) {
      await assert.rejects(employeeInsert(database, { id: `invalid-${role}`, role }, true).run(), /employees_role_current/);
      await assert.rejects(database.prepare('UPDATE employees SET role=? WHERE id=?').bind(role, 'valid-employee').run(), /employees_role_current/);
    }
    await assert.rejects(employeeInsert(database, { id: 'missing-unit', workUnitId: 'unit-missing' }, true).run(), /FOREIGN KEY constraint failed/);
    await assert.rejects(database.prepare("UPDATE employees SET work_unit_id='unit-missing' WHERE id='valid-employee'").run(), /FOREIGN KEY constraint failed/);
    await assert.rejects(database.prepare("DELETE FROM work_units WHERE id='unit-purchasing'").run(), /FOREIGN KEY constraint failed/);
    await assert.rejects(database.prepare("DELETE FROM divisions WHERE id='div-production'").run(), /FOREIGN KEY constraint failed/);
    await assert.rejects(database.prepare("INSERT INTO work_units (id,division_id,code,name) VALUES ('missing-division','division-missing','MISSING','Missing')").run(), /FOREIGN KEY constraint failed/);
    await assert.rejects(database.prepare("INSERT INTO work_units (id,division_id,code,name) VALUES ('duplicate-code','div-back-office','PURCHASING','Duplicate')").run(), /UNIQUE constraint failed/);
    await assert.rejects(database.prepare("INSERT INTO work_units (id,division_id,code,name) VALUES ('duplicate-name','div-back-office','DUPLICATE','Purchasing')").run(), /UNIQUE constraint failed/);
    await assert.rejects(database.prepare("UPDATE work_units SET active=2 WHERE id='unit-purchasing'").run(), /work_units_active/);
    await assert.rejects(database.prepare("UPDATE divisions SET active=2 WHERE id='div-production'").run(), /divisions_active/);
    assert.deepEqual(await rows(database, 'PRAGMA foreign_key_check'), []);
  } finally { await database.close(); }
});

test('populated 1.0.1 migration preserves identities, balances, history and pending assignments while mapping roles and units', async () => {
  const database = await oldDatabase();
  try {
    const employees = [
      { id: 'owner', role: 'admin', department: 'Manajemen', authSubject: 'fixture-owner-subject', email: 'owner@example.test' },
      { id: 'demo-ayu', role: 'hr', department: 'People & Culture', authSubject: 'fixture-hr-subject' },
      { id: 'demo-bima', role: 'manager', department: 'Operasional' },
      { id: 'demo-fajar', role: 'purchasing', department: 'Purchasing' },
      { id: 'demo-dimas', department: 'Gudang', managerId: 'demo-bima' },
      { id: 'demo-intan', department: 'People & Culture', managerId: 'demo-ayu' },
      { id: 'demo-nadia', department: 'Operasional', managerId: 'demo-bima' },
      { id: 'demo-raka', department: 'Teknologi', managerId: 'demo-bima' },
      { id: 'demo-sekar', department: 'Finance', managerId: 'demo-bima' },
      { id: 'active-report-manager', department: 'Surfacing' },
      { id: 'inactive-report-manager', department: 'Coating' },
      { id: 'pending-leave-manager', department: 'Quality Control', authSubject: 'fixture-pending-approver-subject' },
      { id: 'pending-purchase-manager', department: 'Warehouse Goods' },
      { id: 'pending-final-manager', department: 'Purchasing' },
      { id: 'historical-only-approver', department: 'Sales' },
      { id: 'real-finance', department: 'Finance', email: 'finance@example.test' },
      { id: 'real-warehouse', department: 'Gudang', email: 'warehouse@example.test' },
      { id: 'exact-unit', department: 'Account Receiveable & Finance', email: 'ar@example.test' },
      { id: 'real-it', department: 'Teknologi', email: 'it@example.test' },
      { id: 'real-hr', role: 'hr', department: 'Personalia lama', email: 'hr@example.test' },
      { id: 'real-purchasing', role: 'purchasing', department: 'Procurement lama', email: 'purchasing@example.test' },
      { id: 'active-report', department: 'Delivery', managerId: 'active-report-manager' },
      { id: 'inactive-report', department: 'Delivery', managerId: 'inactive-report-manager', active: 0 },
    ];
    await database.batch(employees.map(employee => employeeInsert(database, employee)));
    await database.batch([
      database.prepare("INSERT INTO organization (id,owner_subject,bootstrap_token,initialized,company_name,created_at,updated_at) VALUES ('main','fixture-owner-subject','fixture-token',1,'Fixture organization',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO calendar_years (year,verified,source_url,verified_at,verified_by) VALUES (2026,1,'https://example.invalid/calendar',?,'owner')").bind(timestamp),
      database.prepare("INSERT INTO holidays (id,date,name,kind,source_url,year,updated_at) VALUES ('holiday','2026-08-17','Hari Kemerdekaan','national','https://example.invalid/calendar',2026,?)").bind(timestamp),
      database.prepare("INSERT INTO leave_balances (id,employee_id,year,entitlement,adjustment,used,reserved,updated_at) VALUES ('balance','demo-nadia',2026,12,1,2,1,?)").bind(timestamp),
      database.prepare("INSERT INTO leave_requests (id,number,employee_id,type,start_date,end_date,days,reason,status,approver_id,policy_snapshot,created_at,updated_at) VALUES ('leave-pending','CT-PENDING','demo-nadia','annual','2026-11-02','2026-11-02',1,'Fixture pending','pending','pending-leave-manager','{\"excludeHolidays\":true}',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO leave_requests (id,number,employee_id,type,start_date,end_date,days,reason,status,approver_id,policy_snapshot,created_at,updated_at) VALUES ('leave-historical','CT-PAST','demo-nadia','annual','2026-10-01','2026-10-02',2,'Fixture history','approved','historical-only-approver','{\"excludeHolidays\":true}',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO leave_request_days (id,request_id,date,year,chargeable,reason) VALUES ('leave-day','leave-pending','2026-11-02',2026,1,'working_day')"),
      database.prepare("INSERT INTO leave_ledger (id,event_key,employee_id,year,request_id,event,reserved_delta,actor_id,created_at) VALUES ('ledger','reserve:leave-pending','demo-nadia',2026,'leave-pending','reserve',1,'demo-nadia',?)").bind(timestamp),
      database.prepare("INSERT INTO absence_records (id,employee_id,date,type,reason,created_by,created_at,updated_at) VALUES ('absence','demo-nadia','2026-09-28','sick','Fixture illness','demo-ayu',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO purchase_requests (id,number,employee_id,title,department,needed_by,reason,total,status,approver_id,created_at,updated_at) VALUES ('purchase-pending','PB-PENDING','demo-nadia','Fixture item','Departemen historis','2026-11-02','Fixture reason',250000,'pending_manager','pending-purchase-manager',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO purchase_requests (id,number,employee_id,title,department,needed_by,reason,total,status,approver_id,created_at,updated_at) VALUES ('purchase-final','PB-FINAL','demo-nadia','Fixture item 2','Departemen historis','2026-11-03','Fixture reason 2',300000,'pending_purchasing','pending-final-manager',?,?)").bind(timestamp, timestamp),
      database.prepare("INSERT INTO purchase_request_items (id,request_id,name,quantity,unit,unit_price,sort_order) VALUES ('item','purchase-pending','Fixture item',1,'pcs',250000,0)"),
      database.prepare("INSERT INTO approval_events (id,entity_type,entity_id,stage,decision,actor_id,note,created_at) VALUES ('approval','leave','leave-historical','manager','approve','historical-only-approver','Keputusan historis',?)").bind(timestamp),
      database.prepare("INSERT INTO import_batches (id,checksum,row_count,actor_id,created_at) VALUES ('import','fixture-checksum',1,'demo-ayu',?)").bind(timestamp),
      database.prepare("INSERT INTO audit_logs (id,action,actor_id,subject,details,created_at) VALUES ('audit','fixture.history','demo-ayu','balance','{\"preserve\":true}',?)").bind(timestamp),
      database.prepare("INSERT INTO mutation_guards (id,valid) VALUES ('fixture-guard',1)"),
    ]);

    const beforeEmployees = await rows(database, 'SELECT * FROM employees ORDER BY id');
    const tables = [...readFileSync(initialMigration, 'utf8').matchAll(/CREATE TABLE `([^`]+)`/g)]
      .map(match => match[1]).filter(name => name !== 'employees');
    const before = new Map();
    for (const table of tables) before.set(table, await rows(database, `SELECT * FROM ${table} ORDER BY ${table === 'calendar_years' ? 'year' : 'id'}`));

    await upgrade(database);

    const mappedUnits = {
      'demo-ayu': 'unit-hr-general-affair', 'demo-bima': 'unit-surfacing', 'demo-fajar': 'unit-purchasing',
      'demo-dimas': 'unit-warehouse-lab', 'demo-intan': 'unit-hr-general-affair', 'demo-nadia': 'unit-surfacing',
      'demo-raka': 'unit-it', 'demo-sekar': 'unit-ar-finance', 'active-report-manager': 'unit-surfacing',
      'inactive-report-manager': 'unit-coating', 'pending-leave-manager': 'unit-quality-control',
      'pending-purchase-manager': 'unit-warehouse-goods', 'pending-final-manager': 'unit-purchasing',
      'historical-only-approver': 'unit-sales', 'exact-unit': 'unit-ar-finance', 'real-it': 'unit-it',
      'real-hr': 'unit-hr-general-affair', 'real-purchasing': 'unit-purchasing', 'active-report': 'unit-delivery', 'inactive-report': 'unit-delivery',
    };
    const promoted = new Set(['demo-ayu','demo-fajar','real-hr','real-purchasing','active-report-manager','pending-leave-manager','pending-purchase-manager','pending-final-manager']);
    const expected = beforeEmployees.map(employee => ({
      ...employee, role: promoted.has(employee.id) ? 'manager' : employee.role, work_unit_id: mappedUnits[employee.id] ?? null,
    }));
    assert.deepEqual(await rows(database, 'SELECT * FROM employees ORDER BY id'), expected);
    for (const table of tables) {
      assert.deepEqual(await rows(database, `SELECT * FROM ${table} ORDER BY ${table === 'calendar_years' ? 'year' : 'id'}`), before.get(table), `${table} was changed by migration`);
    }
    assert.deepEqual(await rows(database, 'PRAGMA foreign_key_check'), []);
    await assert.rejects(database.prepare("UPDATE employees SET role='hr' WHERE id='demo-ayu'").run(), /employees_role_current/);
    await assert.rejects(database.prepare("UPDATE employees SET work_unit_id='unknown' WHERE id='owner'").run(), /FOREIGN KEY constraint failed/);
  } finally { await database.close(); }
});

test('demo unit inference never classifies real accounts just because their IDs match fixture IDs', async () => {
  const database = await oldDatabase();
  try {
    await database.batch([
      employeeInsert(database, { id: 'demo-bima', department: 'Operasional', email: 'bima@example.test' }),
      employeeInsert(database, { id: 'demo-dimas', department: 'Gudang', email: 'dimas@example.test' }),
      employeeInsert(database, { id: 'demo-sekar', department: 'Finance', email: 'sekar@example.test' }),
      employeeInsert(database, { id: 'other-example', department: 'Operasional', email: 'unrecognized@example.invalid' }),
    ]);
    await upgrade(database);
    assert.deepEqual((await rows(database, 'SELECT work_unit_id FROM employees')).map(row => row.work_unit_id), [null, null, null, null]);
  } finally { await database.close(); }
});
