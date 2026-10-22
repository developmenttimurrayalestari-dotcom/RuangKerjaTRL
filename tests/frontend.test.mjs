import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseCsv,dateLabel} from '../app/components/utils.ts';
import {canOpenScreen,canApproveRequests,canApproveLeave,canApprovePurchase,canProcessPurchase} from '../app/components/access.ts';
test('CSV mempertahankan nol di depan NIP dan BOM',()=>{assert.deepEqual(parseCsv('\uFEFFnip,year,entitlement,adjustment\r\n00123,2026,12,0'),[{nip:'00123',year:2026,entitlement:12,adjustment:0}]);});
test('CSV menolak hak kosong supaya tidak berubah menjadi nol',()=>{assert.throws(()=>parseCsv('nip,year,entitlement\n001,2026,'),/wajib diisi/);});
test('CSV nol eksplisit sah untuk hak kosong',()=>{assert.equal(parseCsv('nip,year,entitlement\n001,2026,0')[0].entitlement,0);});
test('CSV menolak header duplikat',()=>{assert.throws(()=>parseCsv('nip,year,entitlement,nip\n1,2026,12,1'),/berulang/);});
test('CSV mendukung separator titik koma dari Excel lokal',()=>{assert.equal(parseCsv('nip;year;entitlement;adjustment\n001;2026;12;-1')[0].adjustment,-1);});
test('CSV quoted commas dan newline tidak merusak row',()=>{assert.equal(parseCsv('nip,year,entitlement,note\n001,2026,12,"a,b\nc"')[0].nip,'001');});
test('CSV menolak kuota batch lebih dari 100',()=>{assert.throws(()=>parseCsv('nip,year,entitlement\n'+Array.from({length:101},(_,i)=>`${i},2026,12`).join('\n')),/100/);});
test('Waktu audit ditampilkan menurut tanggal Jakarta, tanggal bisnis tetap',()=>{assert.equal(dateLabel('2026-10-19T18:30:00.000Z',true),'20 Oktober 2026');assert.equal(dateLabel('2026-10-19',true),'19 Oktober 2026');});

const administrativeScreens=['employees','accounts','balances','attendance','reports','settings'];
const allPermissions={manageAdministration:true,approveRequests:true,processPurchasing:true,viewTeam:true};
function accessState(role,workUnitCode='IT',overrides={}){
 const viewer={id:`viewer-${role}-${workUnitCode}`,role,workUnitCode};
 return{
  viewer,
  permissions:{manageAdministration:role==='admin',approveRequests:role!=='employee',processPurchasing:role==='admin'||(role==='manager'&&workUnitCode==='PURCHASING'),viewTeam:role!=='employee',...overrides},
  employees:[{id:'requester',managerId:viewer.id}],
 };
}
const pendingLeave={id:'leave-access',employeeId:'requester',approverId:'saved-manager',status:'pending'};
const pendingPurchase={id:'purchase-access',employeeId:'requester',approverId:'saved-manager',status:'pending_manager'};

test('navigation and direct administrative links are restricted to Administrator',()=>{
 for(const role of ['admin','manager','employee']){
  const data=accessState(role);
  for(const screen of administrativeScreens)assert.equal(canOpenScreen(data,screen),role==='admin',`${role}: ${screen}`);
  for(const screen of ['overview','leave','purchases','calendar'])assert.equal(canOpenScreen(data,screen),true,`${role}: ${screen}`);
  assert.equal(canOpenScreen(data,'approvals'),role!=='employee');
 }
 for(const screen of [...administrativeScreens,'approvals'])assert.equal(canOpenScreen(null,screen),false,`no identity: ${screen}`);
});

test('forged or stale administration flags cannot open account and administrative deep links',()=>{
 for(const role of ['employee','manager']){
  const data=accessState(role,'PURCHASING',allPermissions);
  for(const screen of administrativeScreens)assert.equal(canOpenScreen(data,screen),false,`${role}: ${screen}`);
 }
 for(const screen of administrativeScreens)assert.equal(canOpenScreen(accessState('admin','IT',{manageAdministration:false}),screen),false);
});

test('Staff cannot see approval actions even with a saved approver relation and forged permission flags',()=>{
 const staff=accessState('employee','PURCHASING',allPermissions);
 assert.equal(canApproveRequests(staff),false);
 assert.equal(canOpenScreen(staff,'approvals'),false);
 assert.equal(canApproveLeave(staff,{...pendingLeave,approverId:staff.viewer.id}),false);
 assert.equal(canApprovePurchase(staff,{...pendingPurchase,approverId:staff.viewer.id}),false);
 assert.equal(canApprovePurchase(staff,{...pendingPurchase,status:'pending_purchasing'}),false);
 assert.equal(canProcessPurchase(staff,{...pendingPurchase,status:'ordered'}),false);
});

test('Manager approval uses the saved approver and never falls back to the employee current manager',()=>{
 const manager=accessState('manager');
 assert.equal(canApproveLeave(manager,{...pendingLeave,approverId:manager.viewer.id}),true);
 assert.equal(canApprovePurchase(manager,{...pendingPurchase,approverId:manager.viewer.id}),true);
 // This viewer is the employee's new manager, while the submitted request keeps
 // its original approver or an unassigned snapshot. Neither grants approval.
 for(const approverId of ['saved-manager',null,undefined]){
  assert.equal(canApproveLeave(manager,{...pendingLeave,approverId}),false);
  assert.equal(canApprovePurchase(manager,{...pendingPurchase,approverId}),false);
 }
 const admin=accessState('admin');
 assert.equal(canApproveLeave(admin,pendingLeave),true);
 assert.equal(canApprovePurchase(admin,pendingPurchase),true);
});

test('every role is blocked from approving or processing its own requests',()=>{
 for(const data of [accessState('admin'),accessState('manager'),accessState('manager','PURCHASING'),accessState('employee','PURCHASING',allPermissions)]){
  const own={employeeId:data.viewer.id,approverId:data.viewer.id};
  assert.equal(canApproveLeave(data,{...pendingLeave,...own}),false);
  for(const status of ['pending_manager','pending_purchasing','approved','ordered']){
   const purchase={...pendingPurchase,...own,status};
   assert.equal(canApprovePurchase(data,purchase),false);
   assert.equal(canProcessPurchase(data,purchase),false);
  }
 }
});

test('Purchasing processing requires Manager in Purchasing or Administrator and follows active stages',()=>{
 const purchaser=accessState('manager','PURCHASING'),admin=accessState('admin');
 for(const data of [purchaser,admin]){
  for(const status of ['pending_purchasing','approved','ordered'])assert.equal(canProcessPurchase(data,{...pendingPurchase,status}),true,`${data.viewer.role}: ${status}`);
  for(const status of ['pending_manager','received','rejected','cancelled'])assert.equal(canProcessPurchase(data,{...pendingPurchase,status}),false,`${data.viewer.role}: ${status}`);
  assert.equal(canApprovePurchase(data,{...pendingPurchase,status:'pending_purchasing'}),true);
 }
 assert.equal(canApprovePurchase(purchaser,pendingPurchase),false);
 assert.equal(canApprovePurchase(purchaser,{...pendingPurchase,approverId:purchaser.viewer.id}),true);
 for(const data of [accessState('employee','PURCHASING',allPermissions),accessState('manager','IT',allPermissions),accessState('manager',null,allPermissions)]){
  for(const status of ['pending_purchasing','approved','ordered']){
   assert.equal(canProcessPurchase(data,{...pendingPurchase,status}),false);
   assert.equal(canApprovePurchase(data,{...pendingPurchase,status}),false);
  }
 }
});

test('completed and cancelled requests do not offer another approval action',()=>{
 for(const data of [accessState('admin'),accessState('manager'),accessState('manager','PURCHASING')]){
  for(const status of ['approved','rejected','cancelled'])assert.equal(canApproveLeave(data,{...pendingLeave,status,approverId:data.viewer.id}),false);
  for(const status of ['approved','ordered','received','rejected','cancelled'])assert.equal(canApprovePurchase(data,{...pendingPurchase,status,approverId:data.viewer.id}),false);
 }
});

test('revoked server permission flags hide manager approval and Purchasing controls',()=>{
 const manager=accessState('manager','IT',{approveRequests:false});
 assert.equal(canOpenScreen(manager,'approvals'),false);
 assert.equal(canApproveLeave(manager,{...pendingLeave,approverId:manager.viewer.id}),false);
 assert.equal(canApprovePurchase(manager,{...pendingPurchase,approverId:manager.viewer.id}),false);
 const purchaser=accessState('manager','PURCHASING',{processPurchasing:false});
 assert.equal(canApprovePurchase(purchaser,{...pendingPurchase,status:'pending_purchasing'}),false);
 assert.equal(canProcessPurchase(purchaser,{...pendingPurchase,status:'ordered'}),false);
});
