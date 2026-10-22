import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateLeave,dateValue,rangesOverlap,validateBalanceImport,validatePurchaseItems,assertNoManagerCycle,leaveDecisionStatus,purchaseDecisionStatus,permissionsFor,canProcessPurchasing,canActFor} from '../lib/domain.ts';
const bundle=JSON.parse(readFileSync(new URL('../lib/data/holidays-verified.json',import.meta.url),'utf8'));
const holidays=bundle.holidays.map(h=>({...h,year:Number(h.date.slice(0,4)),kind:h.kind==='national_holiday'?'national':'collective',sourceUrl:'https://example.go.id/'}));
const input={startDate:'2026-12-23',endDate:'2026-12-28',type:'annual',workdays:'1,2,3,4,5',collectiveLeavePolicy:'exclude',holidays,verifiedYears:[2026,2027]};
const employee={id:'e1',name:'Test Employee',nip:'0001',email:'e1@example.invalid',role:'employee',active:true,department:'Test',position:'Staff',managerId:'m1',workdays:'1,2,3,4,5',joinDate:'1998-01-01',workUnitId:null,workUnitName:null,workUnitCode:null,divisionId:null,divisionName:null};
const manager={...employee,id:'m1',role:'manager'},admin={...employee,id:'a1',role:'admin'},purchasing={...employee,id:'p1',role:'manager',workUnitId:'unit-purchasing',workUnitCode:'PURCHASING'};
test('national holiday and weekend never debit annual leave; excluded collective is separate',()=>{const c=calculateLeave(input);assert.equal(c.days,2);assert.equal(c.details.find(d=>d.date==='2026-12-25').chargeable,false);assert.equal(c.details.find(d=>d.date==='2026-12-26').chargeable,false);assert.equal(c.details.find(d=>d.date==='2026-12-24').chargeable,false);});
test('Saturday workers correctly consume Saturday and national holiday still excluded',()=>{const c=calculateLeave({...input,workdays:'1,2,3,4,5,6'});assert.equal(c.days,3);assert.equal(c.details.find(d=>d.date==='2026-12-26').chargeable,true);});
test('collective deduct applies only eligible workdays within the individual request',()=>{assert.equal(calculateLeave({...input,collectiveLeavePolicy:'deduct'}).days,3);assert.equal(calculateLeave({...input,collectiveLeavePolicy:'deduct',workdays:'1,2,3,4,5,6'}).days,4);});
test('cross-year allocation snapshots exact days by year',()=>{const c=calculateLeave({...input,startDate:'2026-12-30',endDate:'2027-01-04'});assert.deepEqual(c.yearBreakdown,{'2026':2,'2027':1});assert.equal(c.days,3);});
test('future year without verified coverage is blocked even if holiday list exists',()=>{assert.throws(()=>calculateLeave({...input,verifiedYears:[]}),/belum diverifikasi/);assert.throws(()=>calculateLeave({...input,startDate:'2027-12-31',endDate:'2028-01-02'}),/2028/);});
test('special leave counts working days but never debits entitlement',()=>{const c=calculateLeave({...input,type:'special'});assert.equal(c.days,2);assert.equal(c.deductibleDays,0);});
test('date validation catches impossible leap date and accepts pre-2000 employment',()=>{assert.throws(()=>dateValue('2026-02-29'),/tidak valid/);assert.equal(dateValue('2000-02-29'),'2000-02-29');assert.equal(dateValue('1998-01-01'),'1998-01-01');assert.throws(()=>calculateLeave({...input,startDate:'2026-12-28',endDate:'2026-12-23'}),/sebelum/);});
test('overlap includes shared endpoints but not adjacent days',()=>{assert.equal(rangesOverlap('2026-10-01','2026-10-03','2026-10-03','2026-10-04'),true);assert.equal(rangesOverlap('2026-10-01','2026-10-03','2026-10-04','2026-10-05'),false);});
test('CSV preview rejects duplicate NIP/year and deficit including reservations',()=>{const balances=[{employeeId:'e1',year:2026,entitlement:12,adjustment:0,used:5,reserved:4,available:3}];const p=validateBalanceImport([{nip:'0001',year:2026,entitlement:12},{nip:'0001',year:2026,entitlement:12}], [employee],balances);assert.equal(p.valid,false);assert.match(p.errors[0].message,/Duplikat/);assert.equal(validateBalanceImport([{nip:'0001',year:2026,entitlement:8}],[employee],balances).valid,false);const ok=validateBalanceImport([{nip:'0001',year:2026,entitlement:13,adjustment:-1}],[employee],balances);assert.equal(ok.rows[0].available,3);});
test('money rejects fractional quantity, negative price, and unsafe totals',()=>{assert.equal(validatePurchaseItems([{name:'Test',quantity:2,unit:'unit',unitPrice:2650000}]).total,5300000);assert.throws(()=>validatePurchaseItems([{name:'Test',quantity:1.5,unit:'unit',unitPrice:10}]),/bulat/);assert.throws(()=>validatePurchaseItems([{name:'Test',quantity:1,unit:'unit',unitPrice:-10}]),/antara/);assert.throws(()=>validatePurchaseItems([null]),/tidak valid/);assert.throws(()=>validatePurchaseItems([{name:'Test',quantity:1000000,unit:'unit',unitPrice:1000000000000}]),/batas/);});
test('manager hierarchy rejects cycles and inactive manager',()=>{assert.throws(()=>assertNoManagerCycle('e1','m1',[employee,{...manager,managerId:'e1'}]),/siklus/);assert.throws(()=>assertNoManagerCycle('e1','m1',[employee,{...manager,active:false}]),/aktif/);});
test('leave permission forbids self-approval even for Admin and requires rejection reason',()=>{const r={employeeId:'e1',approverId:'m1',status:'pending'};assert.equal(leaveDecisionStatus(manager,r,'approve',''),'approved');assert.equal(leaveDecisionStatus(admin,r,'approve',''),'approved');assert.throws(()=>leaveDecisionStatus({...employee,role:'admin'},r,'approve',''),/sendiri/);assert.throws(()=>leaveDecisionStatus(manager,r,'reject',''),/wajib/);assert.throws(()=>leaveDecisionStatus(manager,{...r,status:'approved'},'approve',''),/diproses/);});
test('purchase approval requires manager then Purchasing; no replay or own processing',()=>{const r={employeeId:'e1',approverId:'m1',status:'pending_manager'};assert.equal(purchaseDecisionStatus(manager,r,'approve',''),'pending_purchasing');assert.throws(()=>purchaseDecisionStatus(purchasing,r,'approve',''),/atasan/);assert.equal(purchaseDecisionStatus(purchasing,{...r,status:'pending_purchasing'},'approve',''),'approved');assert.equal(purchaseDecisionStatus(purchasing,{...r,status:'approved'},'order',''),'ordered');assert.equal(purchaseDecisionStatus(purchasing,{...r,status:'ordered'},'receive',''),'received');assert.throws(()=>purchaseDecisionStatus(purchasing,{...r,status:'received'},'receive',''),/final/);assert.throws(()=>purchaseDecisionStatus({...employee,role:'admin'},r,'approve',''),/sendiri/);});


test('three account levels have separate administration, team, and Purchasing capabilities',()=>{
 assert.deepEqual(permissionsFor(admin),{manageAdministration:true,approveRequests:true,processPurchasing:true,viewTeam:true});
 assert.deepEqual(permissionsFor(manager),{manageAdministration:false,approveRequests:true,processPurchasing:false,viewTeam:true});
 assert.deepEqual(permissionsFor(employee),{manageAdministration:false,approveRequests:false,processPurchasing:false,viewTeam:false});
 assert.equal(canProcessPurchasing(purchasing),true);
 assert.equal(canProcessPurchasing({...purchasing,role:'employee'}),false);
 assert.equal(canProcessPurchasing({...purchasing,workUnitCode:'IT'}),false);
 assert.equal(canActFor(manager,'e1'),false);
 assert.equal(canActFor(admin,'e1'),true);
 assert.equal(canActFor(employee,'e1'),true);
});
test('Staff cannot approve even if assigned as snapshot approver or placed in Purchasing',()=>{
 const staffApprover={...employee,id:'staff-approver',workUnitCode:'PURCHASING'};
 const request={employeeId:'e1',approverId:staffApprover.id,status:'pending'};
 assert.throws(()=>leaveDecisionStatus(staffApprover,request,'approve',''),/atasan/);
 assert.throws(()=>purchaseDecisionStatus(staffApprover,{...request,status:'pending_manager'},'approve',''),/atasan/);
 assert.throws(()=>purchaseDecisionStatus(staffApprover,{...request,status:'pending_purchasing'},'approve',''),/Purchasing/);
 assert.throws(()=>assertNoManagerCycle('new-employee',staffApprover.id,[{...staffApprover,managerId:null}]),/Manager atau Administrator/);
});
