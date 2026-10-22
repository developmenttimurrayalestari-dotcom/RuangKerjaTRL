import test,{beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {createTestD1} from './d1-fixture.mjs';
globalThis.__workspaceTestEnv={DB:null};
const {resolveViewer}=await import('../lib/server/bootstrap.ts');
const {getWorkspace,performAction}=await import('../lib/server/workspace.ts');
const route=await import('../app/api/workspace/route.ts');
const ownerUser={userId:'fictional-owner-subject',email:'owner@example.invalid',displayName:'Pemilik Contoh',fullName:'Pemilik Contoh'};
let owner,d1;
beforeEach(async()=>{d1=await createTestD1();globalThis.__workspaceTestEnv.DB=d1;globalThis.__workspaceTestHeaders=new Headers();owner=await resolveViewer(ownerUser);});
afterEach(async()=>{await d1?.close();});
async function sqlFirst(sql,...values){return d1.prepare(sql).bind(...values).first();}
async function person(id){return(await getWorkspace(owner)).employees.find(e=>e.id===id);}
async function balance(employeeId='demo-raka',year=2026){return(await getWorkspace(owner)).balances.find(b=>b.employeeId===employeeId&&b.year===year);}
async function createLeave(extra={}){return performAction(owner,'leave.create',{employeeId:'demo-raka',type:'annual',startDate:'2026-11-09',endDate:'2026-11-10',reason:'Kebutuhan keluarga fiktif untuk pengujian',...extra});}
const rejectsMessage=(fn,pattern)=>assert.rejects(fn,pattern);

test('private owner bootstrap is idempotent and creates only explicit fictional fixtures',async()=>{const first=await getWorkspace(owner);assert.equal(first.employees.length,9);assert.equal(first.employees.filter(e=>e.email.endsWith('@example.invalid')).length,9);assert.equal(first.holidays.length,51);assert.equal(first.calendarYears.filter(y=>y.verified).length,2);assert.equal(first.demo,true);assert.equal(first.leaveRequests.every(r=>r.details.length>0),true);assert.equal(first.leaveRequests.flatMap(r=>r.details).every(d=>typeof d.chargeable==='boolean'),true);const again=await resolveViewer(ownerUser);assert.equal(again.id,owner.id);assert.equal((await getWorkspace(owner)).employees.length,9);assert.equal((await sqlFirst("SELECT COUNT(*) n FROM organization")).n,1);});
test('subsequent identity cannot self-register as Admin; preprovisioned email binds stable subject once',async()=>{const newcomer={...ownerUser,userId:'new-subject',email:'new@example.invalid',displayName:'Karyawan Contoh'};await rejectsMessage(()=>resolveViewer(newcomer),/belum terdaftar/);const created=await performAction(owner,'employee.save',{nip:'00009',name:'Karyawan Contoh',email:newcomer.email,department:'Test',workUnitId:'unit-it',divisionId:'div-back-office',position:'Staff',managerId:owner.id,role:'employee',workdays:'1,2,3,4,5',active:true,joinDate:'1998-01-01'});const employee=await resolveViewer(newcomer);assert.equal(employee.id,created.id);assert.equal(employee.role,'employee');await performAction(owner,'employee.save',{...employee,email:'changed@example.invalid'});assert.equal((await resolveViewer(newcomer)).id,created.id);await rejectsMessage(()=>resolveViewer({...newcomer,userId:'different-subject',email:'changed@example.invalid'}),/belum terdaftar/);assert.equal((await sqlFirst("SELECT COUNT(*) n FROM audit_logs WHERE action='account.linked'")).n,1);});
test('employee state is scoped and forged employeeId or role escalation is rejected',async()=>{const employee=await person('demo-nadia');const state=await getWorkspace(employee);assert.equal(state.leaveRequests.every(r=>r.employeeId===employee.id),true);assert.equal(state.balances.every(b=>b.employeeId===employee.id),true);assert.equal(state.employees.some(e=>e.id==='demo-raka'),false);await rejectsMessage(()=>performAction(employee,'leave.create',{employeeId:'demo-raka',type:'annual',startDate:'2026-11-09',endDate:'2026-11-09',reason:'forged'}),/diri sendiri/);await rejectsMessage(()=>performAction(employee,'settings.save',{companyName:'forged'}),/Admin/);await rejectsMessage(()=>performAction(employee,'employee.delete',{id:'demo-raka'}),/Admin/);const hr=await person('demo-ayu');await rejectsMessage(()=>performAction(hr,'employee.save',{...employee,role:'admin'}),/Admin/);});
test('pending reservation, approval, cancellation refund, and ledger reconcile',async()=>{const before=await balance();const r=await createLeave();let b=await balance();assert.equal(b.used,before.used);assert.equal(b.reserved,before.reserved+2);assert.equal(b.available,before.available-2);await performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:'Disetujui'});b=await balance();assert.equal(b.used,before.used+2);assert.equal(b.reserved,before.reserved);await rejectsMessage(()=>performAction(owner,'leave.cancel',{id:r.id,note:''}),/wajib/);await performAction(owner,'leave.cancel',{id:r.id,note:'Rencana berubah'});assert.deepEqual(await balance(),before);const sum=(await sqlFirst('SELECT SUM(used_delta) used,SUM(reserved_delta) reserved FROM leave_ledger WHERE employee_id=? AND year=2026','demo-raka'));assert.equal(sum.used,before.used);assert.equal(sum.reserved,before.reserved);});
test('rejection requires reason and releases reservation only once',async()=>{const before=await balance();const r=await createLeave();await rejectsMessage(()=>performAction(owner,'leave.decide',{id:r.id,decision:'reject',note:''}),/wajib/);await performAction(owner,'leave.decide',{id:r.id,decision:'reject',note:'Tim membutuhkan pengganti'});assert.deepEqual(await balance(),before);await rejectsMessage(()=>performAction(owner,'leave.decide',{id:r.id,decision:'reject',note:'Ulang'}),/diproses/);});
test('cross-year approval deducts each year; special leave consumes zero entitlement',async()=>{const r=await createLeave({employeeId:'demo-bima',startDate:'2026-12-30',endDate:'2027-01-04'});assert.deepEqual(r.yearBreakdown,{'2026':2,'2027':1});await performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:''});assert.equal((await balance('demo-bima',2026)).used,2);assert.equal((await balance('demo-bima',2027)).used,1);const before=await balance();const special=await createLeave({type:'special'});assert.equal(special.deductibleDays,0);await performAction(owner,'leave.decide',{id:special.id,decision:'approve',note:''});assert.deepEqual(await balance(),before);});
test('concurrent overlapping submissions commit only one request',async()=>{const count=(await sqlFirst('SELECT COUNT(*) n FROM leave_requests')).n;const results=await Promise.allSettled([createLeave(),createLeave()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM leave_requests')).n,count+1);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM mutation_guards')).n,0);});
test('concurrent requests cannot reserve more than available balance',async()=>{await performAction(owner,'balance.import',{rows:[{nip:'EMP-004',year:2026,entitlement:3,adjustment:0}]});assert.equal((await balance()).available,1);const results=await Promise.allSettled([createLeave({startDate:'2026-11-09',endDate:'2026-11-09'}),createLeave({startDate:'2026-11-10',endDate:'2026-11-10'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await balance()).available,0);assert.equal((await balance()).reserved,3);});
test('concurrent double approval cannot double-debit or emit duplicate decision',async()=>{const r=await createLeave();const before=await balance();const results=await Promise.allSettled([performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:'Satu'}),performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:'Dua'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const after=await balance();assert.equal(after.used,before.used+2);assert.equal(after.reserved,before.reserved-2);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM approval_events WHERE entity_id=?',r.id)).n,1);});
test('self-approval is denied at service layer even with Admin role',async()=>{await performAction(owner,'employee.save',{...await person('demo-bima'),managerId:null});const changed={...owner,managerId:'demo-bima',workUnitId:'unit-it',divisionId:'div-back-office'};await performAction(owner,'employee.save',changed);owner=await resolveViewer(ownerUser);const r=await createLeave({employeeId:owner.id});await rejectsMessage(()=>performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:''}),/sendiri/);});
test('sick/unexcused attendance never debits leave and conflicts with approved/pending leave',async()=>{const before=await balance();const absent=await performAction(owner,'absence.save',{employeeId:'demo-raka',date:'2026-11-09',type:'sick',reason:'Sakit (data pengujian)'});assert.deepEqual(await balance(),before);await rejectsMessage(()=>createLeave(),/sakit\/alpa/);await performAction(owner,'absence.delete',{id:absent.id});const r=await createLeave();await rejectsMessage(()=>performAction(owner,'absence.save',{employeeId:'demo-raka',date:'2026-11-09',type:'unexcused',reason:'Uji'}),/cuti aktif/);assert.ok(r.id);});
test('CSV import rejects whole batch on invalid rows and is idempotent replacement',async()=>{const before=await balance();await rejectsMessage(()=>performAction(owner,'balance.import',{rows:[{nip:'EMP-004',year:2026,entitlement:15},{nip:'MISSING',year:2026,entitlement:12}]}),/Import dibatalkan/);assert.deepEqual(await balance(),before);await rejectsMessage(()=>performAction(owner,'balance.import',{rows:[{nip:'EMP-004',year:2026,entitlement:1}]}),/negatif/);const payload={rows:[{nip:'EMP-004',year:2026,entitlement:15,adjustment:-1}]};await performAction(owner,'balance.import',payload);const result=await performAction(owner,'balance.import',payload);assert.equal(result.alreadyImported,true);assert.equal((await balance()).entitlement,15);assert.equal((await balance()).available,12);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM import_batches')).n,1);});
test('calendar changes require re-verification and leave approved snapshots untouched',async()=>{const r=await createLeave({startDate:'2026-11-09',endDate:'2026-11-09'});await performAction(owner,'leave.decide',{id:r.id,decision:'approve',note:''});const before=await balance();await performAction(owner,'holiday.save',{date:'2026-11-09',name:'Libur contoh HR',kind:'national',sourceUrl:'https://example.go.id/skb-test'});await rejectsMessage(()=>performAction(owner,'leave.preview',{employeeId:'demo-bima',startDate:'2026-11-09',endDate:'2026-11-09',type:'annual'}),/belum diverifikasi/);assert.deepEqual(await balance(),before);await performAction(owner,'calendar.verify',{year:2026,sourceUrl:'https://example.go.id/skb-test'});const preview=await performAction(owner,'leave.preview',{employeeId:'demo-bima',startDate:'2026-11-09',endDate:'2026-11-09',type:'annual'});assert.equal(preview.days,0);assert.equal((await getWorkspace(owner)).leaveRequests.find(l=>l.id===r.id).days,1);await rejectsMessage(()=>performAction(owner,'calendar.sync',{year:2028}),/belum tersedia/);});
test('purchase requests persist exact integer totals and enforce complete two-stage flow',async()=>{const request=await performAction(owner,'purchase.save',{employeeId:'demo-nadia',title:'Monitor uji',priority:'normal',neededBy:new Date(Date.now()+7*86400000).toISOString().slice(0,10),reason:'Kebutuhan uji fiktif',items:[{name:'Monitor',quantity:2,unit:'unit',unitPrice:2650000}]});assert.equal(request.total,5300000);const purchaser=await person('demo-fajar'),manager=await person('demo-bima');await rejectsMessage(()=>performAction(purchaser,'purchase.decide',{id:request.id,decision:'approve',note:''}),/atasan/);await performAction(manager,'purchase.decide',{id:request.id,decision:'approve',note:''});await rejectsMessage(()=>performAction(manager,'purchase.decide',{id:request.id,decision:'approve',note:''}),/Purchasing/);await performAction(purchaser,'purchase.decide',{id:request.id,decision:'approve',note:''});await performAction(purchaser,'purchase.decide',{id:request.id,decision:'order',note:'PO eksternal uji'});await performAction(purchaser,'purchase.decide',{id:request.id,decision:'receive',note:'Barang lengkap'});const final=(await getWorkspace(owner)).purchaseRequests.find(p=>p.id===request.id);assert.equal(final.status,'received');assert.equal(final.items[0].unitPrice,2650000);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM approval_events WHERE entity_id=?',request.id)).n,4);});
test('employee delete preserves history and cannot deactivate active manager or last Admin',async()=>{await rejectsMessage(()=>performAction(owner,'employee.delete',{id:'demo-bima'}),/bawahan/);await rejectsMessage(()=>performAction(owner,'employee.delete',{id:owner.id}),/sendiri/);await performAction(owner,'employee.delete',{id:'demo-sekar'});assert.equal((await sqlFirst('SELECT active FROM employees WHERE id=?','demo-sekar')).active,0);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM leave_requests WHERE employee_id=?','demo-sekar')).n,1);});
test('API requires authentication, JSON, and same origin; bootstrap never occurs on anonymous API',async()=>{const anonymous=await route.GET();assert.equal(anonymous.status,401);const cross=await route.POST(new Request('https://test.example/api/workspace',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({action:'settings.save',payload:{companyName:'Spoof'}})}));assert.equal(cross.status,403);const opaque=await route.POST(new Request('https://test.example/api/workspace',{method:'POST',headers:{Origin:'null','Content-Type':'application/json'},body:'{}'}));assert.equal(opaque.status,403);const text=await route.POST(new Request('https://test.example/api/workspace',{method:'POST',headers:{'Content-Type':'text/plain'},body:'x'}));assert.equal(text.status,415);globalThis.__workspaceTestHeaders=new Headers({'oai-authenticated-user-id':ownerUser.userId,'oai-authenticated-user-email':ownerUser.email});const authorized=await route.GET();assert.equal(authorized.status,200);assert.equal(authorized.headers.get('Cache-Control'),'private, no-store, max-age=0');const body=await authorized.json();assert.equal(body.viewer.role,'admin');});
test('CSV F1 to F2 to F1 restores values and concurrent retry creates one effective batch',async()=>{const f1={rows:[{nip:'EMP-004',year:2026,entitlement:14,adjustment:0}]},f2={rows:[{nip:'EMP-004',year:2026,entitlement:15,adjustment:0}]};await performAction(owner,'balance.import',f1);await performAction(owner,'balance.import',f2);await performAction(owner,'balance.import',f1);assert.equal((await balance()).entitlement,14);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM import_batches')).n,3);assert.equal((await performAction(owner,'balance.import',f1)).unchanged,true);const next={rows:[{nip:'EMP-004',year:2026,entitlement:16,adjustment:0}]};const results=await Promise.allSettled([performAction(owner,'balance.import',next),performAction(owner,'balance.import',next)]);assert.ok(results.some(r=>r.status==='fulfilled'));assert.equal((await balance()).entitlement,16);assert.equal((await balance()).reserved,2);assert.equal((await sqlFirst('SELECT COUNT(*) n FROM import_batches')).n,4);});
test('Purchasing never sees requests rejected before manager approval',async()=>{const purchaser=await person('demo-fajar');assert.equal((await getWorkspace(purchaser)).purchaseRequests.some(p=>p.id==='demo-pr-01'),false);await performAction(owner,'purchase.decide',{id:'demo-pr-01',decision:'reject',note:'Belum diperlukan'});assert.equal((await getWorkspace(purchaser)).purchaseRequests.some(p=>p.id==='demo-pr-01'),false);await performAction(purchaser,'purchase.decide',{id:'demo-pr-02',decision:'reject',note:'Spesifikasi perlu diubah'});assert.equal((await getWorkspace(purchaser)).purchaseRequests.some(p=>p.id==='demo-pr-02'),true);});

test('authenticated GET initializes a completely empty database without HTTP 500', async () => {
  await d1.close();
  d1 = await createTestD1();
  globalThis.__workspaceTestEnv.DB = d1;
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM organization')).n, 0);
  // Anonymous requests must not claim the owner during the cold start.
  const anonymous = await route.GET();
  assert.equal(anonymous.status, 401);
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM organization')).n, 0);
  globalThis.__workspaceTestHeaders = new Headers({
    'oai-authenticated-user-id': ownerUser.userId,
    'oai-authenticated-user-email': ownerUser.email,
  });
  const response = await route.GET();
  assert.equal(response.status, 200, await response.clone().text());
  const workspace = await response.json();
  assert.equal(workspace.viewer.role, 'admin');
  assert.equal(workspace.employees.length, 9);
  assert.equal(workspace.holidays.length, 51);
  assert.equal(workspace.leaveRequests.length, 4);
  assert.equal(workspace.purchaseRequests.length, 4);
  assert.equal((await sqlFirst('SELECT initialized FROM organization')).initialized, 1);
});

test('simultaneous first logins create one complete owner workspace', async () => {
  await d1.close();
  d1 = await createTestD1();
  globalThis.__workspaceTestEnv.DB = d1;
  const viewers = await Promise.all([resolveViewer(ownerUser), resolveViewer(ownerUser)]);
  assert.equal(viewers[0].id, viewers[1].id);
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM organization')).n, 1);
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM employees')).n, 9);
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM holidays')).n, 51);
  assert.equal((await sqlFirst("SELECT COUNT(*) n FROM audit_logs WHERE action='workspace.initialized'")).n, 1);
  assert.equal((await sqlFirst('SELECT COUNT(*) n FROM leave_balances')).n, 18);
});

test('trusted bootstrap email blocks another first user without partial data', async () => {
  await d1.close();
  d1 = await createTestD1();
  globalThis.__workspaceTestEnv.DB = d1;
  globalThis.__workspaceTestEnv.WORKSPACE_BOOTSTRAP_EMAIL = ' OWNER@EXAMPLE.INVALID ';
  try {
    await assert.rejects(
      () => resolveViewer({...ownerUser, userId: 'different-first-user', email: 'someone@example.invalid'}),
      error => error.status === 403 && error.code === 'BOOTSTRAP_OWNER_REQUIRED',
    );
    assert.equal((await sqlFirst('SELECT COUNT(*) n FROM organization')).n, 0);
    assert.equal((await sqlFirst('SELECT COUNT(*) n FROM employees')).n, 0);
    const allowed = await resolveViewer({...ownerUser, email: 'Owner@Example.Invalid'});
    assert.equal(allowed.role, 'admin');
    assert.equal((await sqlFirst('SELECT COUNT(*) n FROM employees')).n, 9);
    // Once initialized, the regular employee provisioning rule still applies.
    const staff = await resolveViewer({userId: 'nadia-test-subject', email: 'nadia@example.invalid', displayName: 'Nadia', fullName: 'Nadia'});
    assert.equal(staff.id, 'demo-nadia');
    assert.equal(staff.role, 'employee');
  } finally {
    delete globalThis.__workspaceTestEnv.WORKSPACE_BOOTSTRAP_EMAIL;
  }
});


test('organization registry exposes both divisions and all 15 units with authoritative identity mapping',async()=>{
 const state=await getWorkspace(owner);
 assert.equal(state.divisions.length,2);
 assert.equal(state.workUnits.length,15);
 assert.equal(state.workUnits.filter(unit=>unit.divisionId==='div-production').length,5);
 assert.equal(state.workUnits.filter(unit=>unit.divisionId==='div-back-office').length,10);
 assert.equal(state.workUnits.find(unit=>unit.code==='AR_FINANCE').name,'Account Receiveable & Finance');
 assert.equal(state.viewer.workUnitId,null);
 assert.equal(state.viewer.divisionId,null);
 assert.deepEqual(state.permissions,{manageAdministration:true,approveRequests:true,processPurchasing:true,viewTeam:true});
 assert.equal(state.employees.every(employee=>['admin','manager','employee'].includes(employee.role)),true);
 const purchaser=await resolveViewer({userId:'purchaser-subject',email:'fajar@example.invalid',displayName:'Fajar',fullName:'Fajar'});
 assert.equal(purchaser.role,'manager');
 assert.equal(purchaser.workUnitId,'unit-purchasing');
 assert.equal(purchaser.workUnitCode,'PURCHASING');
 assert.equal(purchaser.divisionId,'div-back-office');
 assert.equal((await getWorkspace(purchaser)).permissions.processPurchasing,true);
 assert.equal((await person('demo-ayu')).role,'manager');
 assert.equal((await person('demo-bima')).workUnitCode,'SURFACING');
});

test('account save derives unit labels, rejects forged divisions and old roles, and requires an eligible manager',async()=>{
 const base={nip:'UNIT-001',name:'Uji Unit Kerja',email:'unit-test@example.invalid',department:'Forged department',position:'Staff',managerId:owner.id,role:'employee',workdays:'1,2,3,4,5',active:true,joinDate:'2026-01-01'};
 await assert.rejects(()=>performAction(owner,'employee.save',base),/Unit kerja/);
 await assert.rejects(()=>performAction(owner,'employee.save',{...base,workUnitId:'missing-unit'}),/unit kerja aktif/);
 await assert.rejects(()=>performAction(owner,'employee.save',{...base,workUnitId:'unit-it',divisionId:'div-production'}),/divisi yang dipilih/);
 for(const role of ['hr','purchasing','superadmin'])await assert.rejects(()=>performAction(owner,'employee.save',{...base,role,workUnitId:'unit-it'}),/Level akun/);
 await assert.rejects(()=>performAction(owner,'employee.save',{...base,workUnitId:'unit-it',managerId:'demo-raka'}),/Manager atau Administrator/);
 const saved=await performAction(owner,'employee.save',{...base,workUnitId:'unit-it',divisionId:'div-back-office',workUnitCode:'PURCHASING'});
 const employee=await person(saved.id);
 assert.equal(employee.department,'IT');
 assert.equal(employee.workUnitCode,'IT');
 assert.equal(employee.divisionName,'Divisi Back Office');
 assert.equal((await sqlFirst('SELECT department,work_unit_id FROM employees WHERE id=?',saved.id)).department,'IT');
 await d1.prepare('UPDATE work_units SET active=0 WHERE id=?').bind('unit-it').run();
 await assert.rejects(()=>performAction(owner,'employee.save',employee),/unit kerja aktif/);
});

test('all administration is restricted to Administrator across HR, Purchasing, other managers, and Staff',async()=>{
 const actions=['employee.save','employee.delete','absence.save','absence.delete','balance.preview','balance.import','holiday.save','holiday.delete','calendar.verify','calendar.sync','settings.save'];
 for(const id of ['demo-ayu','demo-fajar','demo-bima','demo-nadia']){
  const actor=await person(id);
  for(const action of actions)await assert.rejects(()=>performAction(actor,action,{}),error=>error.status===403&&/Admin/.test(error.message),`${id} must not perform ${action}`);
  await assert.rejects(()=>performAction(actor,'leave.preview',{employeeId:'demo-sekar'}),error=>error.status===403);
  await assert.rejects(()=>performAction(actor,'purchase.save',{employeeId:'demo-sekar'}),error=>error.status===403);
 }
});

test('Manager submits own requests and only decides assigned staff; manager team excludes unrelated employee data',async()=>{
 const manager=await person('demo-bima');
 const state=await getWorkspace(manager);
 assert.equal(state.permissions.approveRequests,true);
 assert.equal(state.permissions.manageAdministration,false);
 assert.equal(state.employees.some(e=>e.id==='demo-raka'),false);
 assert.equal(state.balances.every(b=>['demo-bima','demo-nadia','demo-dimas'].includes(b.employeeId)),true);
 await assert.rejects(()=>performAction(manager,'leave.decide',{id:'demo-leave-02',decision:'approve',note:''}),error=>error.status===403);
 await performAction(manager,'leave.decide',{id:'demo-leave-01',decision:'approve',note:'Atasan sesuai penunjukan'});
 const leave=await performAction(manager,'leave.create',{startDate:'2026-11-09',endDate:'2026-11-09',type:'annual',reason:'Pengajuan manager sendiri'});
 const purchase=await performAction(manager,'purchase.save',{title:'Kebutuhan manager',neededBy:'2026-11-09',reason:'Uji pengajuan sendiri',items:[{name:'Keyboard',quantity:1,unit:'unit',unitPrice:300000}]});
 await assert.rejects(()=>performAction(manager,'leave.decide',{id:leave.id,decision:'approve',note:''}),/sendiri/);
 await assert.rejects(()=>performAction(manager,'purchase.decide',{id:purchase.id,decision:'approve',note:''}),/sendiri/);
 await performAction(owner,'leave.decide',{id:leave.id,decision:'approve',note:''});
 await performAction(owner,'purchase.decide',{id:purchase.id,decision:'approve',note:''});
});

test('Staff visibility and approval remain restricted even with stale designated approver and report relations',async()=>{
 const staff=await person('demo-raka');
 await d1.prepare('UPDATE leave_requests SET approver_id=? WHERE id=?').bind(staff.id,'demo-leave-01').run();
 await d1.prepare('UPDATE purchase_requests SET approver_id=? WHERE id=?').bind(staff.id,'demo-pr-01').run();
 await d1.prepare('UPDATE employees SET manager_id=? WHERE id=?').bind(staff.id,'demo-dimas').run();
 const state=await getWorkspace(staff);
 assert.deepEqual(state.permissions,{manageAdministration:false,approveRequests:false,processPurchasing:false,viewTeam:false});
 assert.equal(state.leaveRequests.every(request=>request.employeeId===staff.id),true);
 assert.equal(state.purchaseRequests.every(request=>request.employeeId===staff.id),true);
 assert.equal(state.employees.some(employee=>employee.id==='demo-dimas'),false);
 await assert.rejects(()=>performAction(staff,'leave.decide',{id:'demo-leave-01',decision:'approve',note:''}),error=>error.status===403);
 await assert.rejects(()=>performAction(staff,'purchase.decide',{id:'demo-pr-01',decision:'approve',note:''}),error=>error.status===403);
 const leave=await performAction(staff,'leave.create',{startDate:'2026-11-09',endDate:'2026-11-09',type:'annual',reason:'Pengajuan staff sendiri'});
 assert.ok(leave.id);
});

test('Staff in Purchasing has no queue access or stage-two authority',async()=>{
 await performAction(owner,'employee.save',{...await person('demo-raka'),workUnitId:'unit-purchasing',divisionId:'div-back-office'});
 const staff=await person('demo-raka');
 assert.equal(staff.workUnitCode,'PURCHASING');
 const state=await getWorkspace(staff);
 assert.equal(state.permissions.processPurchasing,false);
 assert.equal(state.purchaseRequests.every(request=>request.employeeId===staff.id),true);
 await assert.rejects(()=>performAction(staff,'purchase.decide',{id:'demo-pr-03',decision:'receive',note:''}),error=>error.status===403);
});

test('Purchasing authority is revoked atomically after unit reassignment or unit deactivation',async()=>{
 const purchaser=await person('demo-fajar');
 const before=(await sqlFirst('SELECT COUNT(*) n FROM approval_events WHERE entity_id=?','demo-pr-02')).n;
 await performAction(owner,'employee.save',{...purchaser,workUnitId:'unit-it',divisionId:'div-back-office'});
 await assert.rejects(()=>performAction(purchaser,'purchase.decide',{id:'demo-pr-02',decision:'approve',note:'Stale actor snapshot'}),error=>error.status===409);
 const reassigned=await person(purchaser.id);
 assert.equal((await getWorkspace(reassigned)).permissions.processPurchasing,false);
 await assert.rejects(()=>performAction(reassigned,'purchase.decide',{id:'demo-pr-02',decision:'approve',note:''}),error=>error.status===403);
 await performAction(owner,'employee.save',{...reassigned,workUnitId:'unit-purchasing',divisionId:'div-back-office'});
 const current=await person(purchaser.id);
 await d1.prepare('UPDATE work_units SET active=0 WHERE id=?').bind('unit-purchasing').run();
 await assert.rejects(()=>performAction(current,'purchase.decide',{id:'demo-pr-02',decision:'approve',note:'Stale active unit'}),error=>error.status===409);
 assert.equal((await person(purchaser.id)).workUnitCode,null);
 assert.equal((await sqlFirst('SELECT status FROM purchase_requests WHERE id=?','demo-pr-02')).status,'pending_purchasing');
 assert.equal((await sqlFirst('SELECT COUNT(*) n FROM approval_events WHERE entity_id=?','demo-pr-02')).n,before);
 assert.equal((await sqlFirst('SELECT COUNT(*) n FROM mutation_guards')).n,0);
});

test('demotion and deactivation cannot strand active reports or pending snapshotted approvals',async()=>{
 const manager=await person('demo-bima');
 await assert.rejects(()=>performAction(owner,'employee.save',{...manager,role:'employee'}),/bawahan aktif/);
 for(const id of ['demo-nadia','demo-dimas'])await performAction(owner,'employee.save',{...await person(id),managerId:owner.id});
 await assert.rejects(()=>performAction(owner,'employee.save',{...manager,role:'employee'}),/menunggu persetujuan/);
 await assert.rejects(()=>performAction(owner,'employee.delete',{id:manager.id}),/menunggu persetujuan/);
 const managerState=await getWorkspace(manager);
 assert.equal(managerState.leaveRequests.some(request=>request.id==='demo-leave-01'),true);
 assert.equal(managerState.purchaseRequests.some(request=>request.id==='demo-pr-01'),true);
 await performAction(manager,'leave.decide',{id:'demo-leave-01',decision:'reject',note:'Penataan atasan'});
 await performAction(manager,'leave.decide',{id:'demo-leave-04',decision:'reject',note:'Penataan atasan'});
 await performAction(manager,'purchase.decide',{id:'demo-pr-01',decision:'reject',note:'Penataan atasan'});
 await performAction(owner,'employee.save',{...manager,role:'employee'});
 const demoted=await person(manager.id);
 assert.equal(demoted.role,'employee');
 assert.equal((await getWorkspace(demoted)).leaveRequests.every(request=>request.employeeId===demoted.id),true);
});

test('identity linking rejects a stale email match after concurrent administrator reassignment',async()=>{
 const originalBatch=d1.batch.bind(d1);
 let reassigned=false;
 // Force the administrator's email change after the candidate SELECT, directly
 // before the linking transaction, on both SQLite and real D1 fixture adapters.
 d1.batch=async statements=>{
  if(!reassigned){
   reassigned=true;
   await d1.prepare('UPDATE employees SET email=? WHERE id=? AND auth_subject IS NULL').bind('replacement@example.invalid','demo-raka').run();
  }
  return originalBatch(statements);
 };
 try{
  await assert.rejects(
   ()=>resolveViewer({userId:'stale-email-subject',email:'raka@example.invalid',displayName:'Stale identity',fullName:'Stale identity'}),
   error=>error.status===403&&error.code==='NOT_PROVISIONED',
  );
 }finally{d1.batch=originalBatch;}
 assert.equal(reassigned,true);
 const employee=await sqlFirst('SELECT email,auth_subject FROM employees WHERE id=?','demo-raka');
 assert.equal(employee.email,'replacement@example.invalid');
 assert.equal(employee.auth_subject,null);
 assert.equal((await sqlFirst("SELECT COUNT(*) n FROM audit_logs WHERE action='account.linked'")).n,0);
 const legitimate=await resolveViewer({userId:'replacement-subject',email:'replacement@example.invalid',displayName:'Replacement identity',fullName:'Replacement identity'});
 assert.equal(legitimate.id,'demo-raka');
 assert.equal((await sqlFirst('SELECT auth_subject FROM employees WHERE id=?','demo-raka')).auth_subject,'replacement-subject');
 assert.equal((await sqlFirst("SELECT COUNT(*) n FROM audit_logs WHERE action='account.linked'")).n,1);
});
