import { AppError, assert, textValue, integerValue, dateValue, jakartaToday, normalizeWorkdays, calculateLeave, permissionsFor, canActFor, leaveDecisionStatus, purchaseDecisionStatus, validatePurchaseItems, validateBalanceImport, assertNoManagerCycle, type Employee, type Holiday, type Balance, type LeaveStatus, type PurchaseStatus, type LeaveType, type Role, type Division, type WorkUnit } from '../domain';
import { query, one, statement, insert, insertRows, commit, camelRow, allEmployees, uid, type Guard } from './db';
import { officialHolidays, officialSource } from './bootstrap';

type Payload=Record<string,unknown>;
type Settings={companyName:string;collectiveLeavePolicy:'exclude'|'deduct';defaultAnnualEntitlement:number;workdays:string;updatedAt:string;demo:number};
type CalendarYear={year:number;verified:number;sourceUrl:string;revision:number};
type Leave={id:string;number:string;employeeId:string;type:LeaveType;startDate:string;endDate:string;days:number;reason:string;status:LeaveStatus;approverId:string|null;createdAt:string;decisionNote:string};
type Purchase={id:string;number:string;employeeId:string;title:string;department:string;priority:string;neededBy:string;reason:string;total:number;status:PurchaseStatus;approverId:string|null;createdAt:string;decisionNote:string};
export async function settings():Promise<Settings>{const row=await one("SELECT company_name,collective_leave_policy,default_annual_entitlement,workdays,updated_at,demo FROM organization WHERE id='main'");assert(row,'Workspace belum diinisialisasi.',503);return camelRow<Settings>(row);}
async function calendar():Promise<{holidays:Holiday[];years:CalendarYear[]}>{const [h,y]=await Promise.all([query('SELECT id,date,name,kind,source_url,year FROM holidays ORDER BY date'),query('SELECT year,verified,source_url,revision FROM calendar_years ORDER BY year')]);return{holidays:h.map(x=>camelRow<Holiday>(x)),years:y.map(x=>camelRow<CalendarYear>(x))};}
async function allBalances():Promise<Balance[]>{return(await query('SELECT employee_id,year,entitlement,adjustment,used,reserved,entitlement+adjustment-used-reserved AS available FROM leave_balances')).map(x=>camelRow<Balance>(x));}
async function employeeById(id:string):Promise<Employee>{const all=await allEmployees();const found=all.find(e=>e.id===id);assert(found,'Karyawan tidak ditemukan.',404);return found;}
function requireAdmin(actor:Employee){assert(actor.role==='admin','Fitur ini hanya tersedia untuk Admin.',403);}
function requiredId(p:Payload):string{return textValue(p.id,'ID',100);}
function yearValue(value:unknown):number{return integerValue(value,'Tahun',2000,2200);}
function sourceUrl(value:unknown):string {const s=textValue(value,'URL sumber',1500);try{const u=new URL(s);assert(u.protocol==='https:','Sumber kalender harus berupa URL HTTPS.');return u.href;}catch(e){if(e instanceof AppError)throw e;throw new AppError('URL sumber kalender tidak valid.');}}
function ledger(actor:Employee,event:string,eventKey:string,employeeId:string,year:number,requestId:string|null,usedDelta=0,reservedDelta=0,entitlementDelta=0,adjustmentDelta=0){return insert('leave_ledger',{id:uid(),event_key:eventKey,employee_id:employeeId,year,request_id:requestId,event,entitlement_delta:entitlementDelta,adjustment_delta:adjustmentDelta,used_delta:usedDelta,reserved_delta:reservedDelta,actor_id:actor.id,created_at:new Date().toISOString()});}
function approval(actor:Employee,entityType:string,entityId:string,stage:string,decision:string,note:string){return insert('approval_events',{id:uid(),entity_type:entityType,entity_id:entityId,stage,decision,actor_id:actor.id,note,created_at:new Date().toISOString()});}

export async function getWorkspace(actor:Employee){
 const [employees,balances,leaveRows,purchaseRows,itemRows,absenceRows,cal,config,audits,events,dayRows,divisionRows,unitRows]=await Promise.all([
  allEmployees(),allBalances(),query('SELECT * FROM leave_requests ORDER BY created_at DESC'),
  query('SELECT * FROM purchase_requests ORDER BY created_at DESC'),query('SELECT * FROM purchase_request_items ORDER BY sort_order'),
  query('SELECT * FROM absence_records ORDER BY date DESC'),calendar(),settings(),
  query('SELECT a.id,a.action,a.actor_id,e.name AS actor_name,a.subject,a.created_at FROM audit_logs a JOIN employees e ON e.id=a.actor_id ORDER BY a.created_at DESC LIMIT 150'),
  query('SELECT a.*,e.name AS actor_name FROM approval_events a JOIN employees e ON e.id=a.actor_id ORDER BY a.created_at DESC'),
  query('SELECT request_id,date,year,chargeable,reason FROM leave_request_days ORDER BY date'),
  query('SELECT id,code,name,sort_order,active FROM divisions ORDER BY sort_order,name'),
  query('SELECT id,code,name,division_id,sort_order,active FROM work_units ORDER BY sort_order,name'),
 ]);
 const permissions=permissionsFor(actor);
 const visiblePeople=new Set(employees.filter(e=>permissions.manageAdministration||e.id===actor.id||(actor.role==='manager'&&e.managerId===actor.id)).map(e=>e.id));
 const designated=(request:{approverId:string|null})=>actor.role==='manager'&&request.approverId===actor.id;
 const leaves=leaveRows.map(x=>camelRow<Leave>(x)).filter(l=>permissions.manageAdministration||visiblePeople.has(l.employeeId)||designated(l));
 const passedManager=new Set(events.filter(e=>e.entity_type==='purchase'&&e.stage==='pending_manager'&&e.decision==='approve').map(e=>String(e.entity_id)));
 const purchases=purchaseRows.map(x=>camelRow<Purchase>(x)).filter(p=>permissions.manageAdministration||visiblePeople.has(p.employeeId)||designated(p)||(permissions.processPurchasing&&passedManager.has(p.id)&&['pending_purchasing','approved','ordered','received','rejected','cancelled'].includes(p.status)));
 const directoryIds=new Set([...visiblePeople,...leaves.flatMap(l=>[l.employeeId,l.approverId]),...purchases.flatMap(p=>[p.employeeId,p.approverId]),actor.managerId].filter(Boolean));
 const visibleEmployees=employees.filter(e=>directoryIds.has(e.id)).map(e=>visiblePeople.has(e.id)?e:{...e,email:'',nip:'',joinDate:''});
 const leaveIds=new Set(leaves.map(l=>l.id)),purchaseIds=new Set(purchases.map(p=>p.id));
 const divisions=divisionRows.map(row=>{const division=camelRow<Division>(row);return{...division,active:Boolean(division.active)};});
 const workUnits=unitRows.map(row=>{const unit=camelRow<WorkUnit>(row);return{...unit,active:Boolean(unit.active)};});
 return{
  viewer:{id:actor.id,name:actor.name,email:actor.email,role:actor.role,workUnitId:actor.workUnitId,workUnitName:actor.workUnitName,workUnitCode:actor.workUnitCode,divisionId:actor.divisionId,divisionName:actor.divisionName},
  permissions,divisions,workUnits,employees:visibleEmployees,
  leaveRequests:leaves.map(({...l})=>{delete (l as unknown as Payload).policySnapshot;return {...l,details:dayRows.filter(d=>d.request_id===l.id).map(d=>({date:d.date,year:d.year,chargeable:Boolean(d.chargeable),reason:d.reason}))};}),
  balances:balances.filter(b=>visiblePeople.has(b.employeeId)),
  absenceRecords:absenceRows.map(x=>camelRow<{employeeId:string}>(x)).filter(a=>visiblePeople.has(a.employeeId)),
  purchaseRequests:purchases.map(p=>({...p,items:itemRows.filter(i=>i.request_id===p.id).map(i=>camelRow(i))})),
  holidays:cal.holidays,calendarYears:cal.years.map(y=>({...y,verified:Boolean(y.verified)})),
  settings:{companyName:config.companyName,collectiveLeavePolicy:config.collectiveLeavePolicy,defaultAnnualEntitlement:config.defaultAnnualEntitlement,workdays:config.workdays},
  auditLogs:audits.filter(a=>permissions.manageAdministration||a.actor_id===actor.id).map(x=>camelRow(x)),
  approvalEvents:events.filter(e=>e.entity_type==='leave'?leaveIds.has(String(e.entity_id)):purchaseIds.has(String(e.entity_id))).map(x=>camelRow(x)),demo:Boolean(config.demo),
 };
}

const pendingApprovalsSql="NOT EXISTS(SELECT 1 FROM leave_requests WHERE approver_id=? AND status='pending') AND NOT EXISTS(SELECT 1 FROM purchase_requests WHERE approver_id=? AND status='pending_manager')";
async function assertNoAssignedResponsibilities(id:string):Promise<void>{
 const [report,pending]=await Promise.all([
  one('SELECT id FROM employees WHERE manager_id=? AND active=1 LIMIT 1',[id]),
  one<{clear:number}>(`SELECT CASE WHEN (${pendingApprovalsSql}) THEN 1 ELSE 0 END AS clear`,[id,id]),
 ]);
 assert(!report,'Alihkan bawahan aktif ke atasan lain sebelum menonaktifkan atau menurunkan level atasan.');
 assert(pending?.clear===1,'Selesaikan pengajuan yang masih menunggu persetujuan atasan ini sebelum menonaktifkan atau menurunkan levelnya.');
}
function responsibilityGuards(id:string):Guard[]{return[
 {sql:'NOT EXISTS(SELECT 1 FROM employees WHERE manager_id=? AND active=1)',values:[id]},
 {sql:pendingApprovalsSql,values:[id,id]},
 ];}
async function employeeSave(actor:Employee,p:Payload){
 requireAdmin(actor);
 const [employees,config]=await Promise.all([allEmployees(),settings()]);
 const id=p.id?textValue(p.id,'ID',100):uid(),old=employees.find(e=>e.id===id);
 assert(!p.id||old,'Karyawan tidak ditemukan.',404);
 const name=textValue(p.name,'Nama karyawan',150),nip=textValue(p.nip,'NIP',50),email=textValue(p.email,'Email',254).toLowerCase();
 assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Alamat email tidak valid.');
 assert(!employees.some(e=>e.id!==id&&(e.nip===nip||e.email===email)),'NIP atau email sudah digunakan karyawan lain.',409);
 const role=textValue(p.role??old?.role??'employee','Level akun',30) as Role;
 assert(['admin','manager','employee'].includes(role),'Level akun harus Administrator, Manager, atau Staff.');
 const active=p.active==null?(old?.active??true):p.active;
 assert(typeof active==='boolean','Status aktif harus berupa boolean.');
 assert(actor.id!==id||(active&&role===actor.role),'Peran atau status akun Anda sendiri tidak dapat diubah dari sesi ini.');
 const workUnitId=textValue(p.workUnitId??old?.workUnitId,'Unit kerja',100);
 const unit=await one<{id:string;name:string;division_id:string}>('SELECT u.id,u.name,u.division_id FROM work_units u JOIN divisions d ON d.id=u.division_id WHERE u.id=? AND u.active=1 AND d.active=1',[workUnitId]);
 assert(unit,'Pilih unit kerja aktif yang terdaftar pada divisi aktif.');
 if(p.divisionId!==undefined)assert(textValue(p.divisionId,'Divisi',100)===unit.division_id,'Unit kerja tidak termasuk dalam divisi yang dipilih.');
 const managerId=p.managerId?textValue(p.managerId,'Atasan',100):null;
 assertNoManagerCycle(id,managerId,employees);
 const department=unit.name,position=textValue(p.position,'Jabatan',100),workdays=normalizeWorkdays(p.workdays??config.workdays),joinDate=dateValue(p.joinDate,'Tanggal masuk');
 if(!active||role==='employee')await assertNoAssignedResponsibilities(id);
 const now=new Date().toISOString(),stmts:D1PreparedStatement[]=[],guards:Guard[]=[
  {sql:'EXISTS(SELECT 1 FROM work_units u JOIN divisions d ON d.id=u.division_id WHERE u.id=? AND u.division_id=? AND u.active=1 AND d.active=1)',values:[workUnitId,unit.division_id]},
 ];
 if(old){
  stmts.push(statement('UPDATE employees SET nip=?,name=?,email=?,department=?,position=?,manager_id=?,role=?,workdays=?,active=?,join_date=?,work_unit_id=?,updated_at=? WHERE id=?',[nip,name,email,department,position,managerId,role,workdays,active?1:0,joinDate,workUnitId,now,id]));
  guards.push({sql:"EXISTS(SELECT 1 FROM employees WHERE id=? AND role=? AND active=? AND COALESCE(work_unit_id,'')=?)",values:[id,old.role,old.active?1:0,old.workUnitId??'']});
  if(old.role==='admin'&&(role!=='admin'||!active))guards.push({sql:"(SELECT COUNT(*) FROM employees WHERE role='admin' AND active=1 AND id<>?)>=1",values:[id]});
 }else{
  stmts.push(insert('employees',{id,nip,name,email,auth_subject:null,department,position,manager_id:managerId,role,workdays,active:active?1:0,join_date:joinDate,work_unit_id:workUnitId,created_at:now,updated_at:now}));
  const years=(await calendar()).years.filter(y=>y.verified).map(y=>y.year);
  for(const year of years)stmts.push(insert('leave_balances',{id:uid(),employee_id:id,year,entitlement:config.defaultAnnualEntitlement,adjustment:0,used:0,reserved:0,updated_at:now}),ledger(actor,'initial_grant',`grant:${id}:${year}`,id,year,null,0,0,config.defaultAnnualEntitlement));
 }
 if(managerId)guards.push(
  {sql:"EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND role IN ('admin','manager'))",values:[managerId]},
  {sql:"NOT EXISTS(WITH RECURSIVE ancestors(id,manager_id,role,active) AS (SELECT id,manager_id,role,active FROM employees WHERE id=? UNION SELECT e.id,e.manager_id,e.role,e.active FROM employees e JOIN ancestors a ON e.id=a.manager_id) SELECT 1 FROM ancestors WHERE id=? OR active<>1 OR role NOT IN ('admin','manager'))",values:[managerId,id]},
 );
 if(!active||role==='employee')guards.push(...responsibilityGuards(id));
 await commit(actor,old?'employee.updated':'employee.created',name,stmts,guards,{employeeId:id,role,active,workUnitId,divisionId:unit.division_id});
 return{ok:true,id};
}
async function employeeDelete(actor:Employee,p:Payload){
 requireAdmin(actor);
 const id=requiredId(p),target=await employeeById(id);
 assert(id!==actor.id,'Akun Anda sendiri tidak dapat dinonaktifkan.');
 await assertNoAssignedResponsibilities(id);
 await commit(actor,'employee.deactivated',target.name,[statement('UPDATE employees SET active=0,updated_at=? WHERE id=?',[new Date().toISOString(),id])],[
  {sql:'EXISTS(SELECT 1 FROM employees WHERE id=? AND role=? AND active=?)',values:[id,target.role,target.active?1:0]},
  ...responsibilityGuards(id),
  {sql:"? <> 'admin' OR (SELECT COUNT(*) FROM employees WHERE role='admin' AND active=1 AND id<>?)>=1",values:[target.role,id]},
 ]);
 return{ok:true};
}

async function previewLeave(actor:Employee,p:Payload){const employeeId=textValue(p.employeeId??actor.id,'Karyawan',100);assert(canActFor(actor,employeeId),'Anda hanya dapat mengajukan cuti untuk diri sendiri.',403);const [target,cal,config]=await Promise.all([employeeById(employeeId),calendar(),settings()]);assert(target.active,'Karyawan tidak aktif.');const startDate=dateValue(p.startDate,'Tanggal mulai'),endDate=dateValue(p.endDate,'Tanggal akhir'),type=(p.type??'annual') as LeaveType;assert(type==='annual'||type==='special','Jenis cuti tidak valid.');assert(startDate>=target.joinDate,'Cuti tidak boleh sebelum tanggal masuk karyawan.');const result=calculateLeave({startDate,endDate,type,workdays:target.workdays,collectiveLeavePolicy:config.collectiveLeavePolicy,holidays:cal.holidays,verifiedYears:cal.years.filter(y=>y.verified).map(y=>y.year)});return{result,target,cal,config,startDate,endDate,type};}
async function leaveCreate(actor:Employee,p:Payload){
 const {result,target,cal,config,startDate,endDate,type}=await previewLeave(actor,p);assert(result.days>0,'Rentang ini tidak memiliki hari kerja yang dapat diajukan.');assert((actor.role==='admin')||startDate>=jakartaToday(),'Pengajuan tanggal lampau hanya dapat dicatat Administrator.');assert(target.managerId,'Atasan belum ditetapkan. Minta Administrator melengkapi atasan pada data karyawan.');assert(target.managerId!==target.id,'Atasan tidak boleh orang yang sama.');const manager=await employeeById(target.managerId);assert(manager.active&&(manager.role==='manager'||manager.role==='admin'),'Atasan harus aktif dan memiliki level Manager atau Administrator. Minta Administrator melengkapi atasan.');
 const overlap=await one("SELECT id FROM leave_requests WHERE employee_id=? AND status IN ('pending','approved') AND start_date<=? AND end_date>=? LIMIT 1",[target.id,endDate,startDate]);assert(!overlap,'Tanggal beririsan dengan pengajuan cuti aktif lainnya.',409,'LEAVE_OVERLAP');const absence=await one('SELECT id FROM absence_records WHERE employee_id=? AND date BETWEEN ? AND ? LIMIT 1',[target.id,startDate,endDate]);assert(!absence,'Tanggal beririsan dengan catatan sakit/alpa. Koreksi catatan sebelum mengajukan cuti.',409);
 const balances=await allBalances();if(type==='annual'){for(const [year,days]of Object.entries(result.yearBreakdown)){const b=balances.find(b=>b.employeeId===target.id&&b.year===Number(year));assert(b,`Saldo tahun ${year} belum tersedia. Minta Administrator mengimport hak cuti.`,409);assert(b.available>=days,`Saldo ${year} tidak cukup: tersedia ${b.available} hari, pengajuan ${days} hari.`,409,'INSUFFICIENT_BALANCE');}}
 const id=uid(),now=new Date().toISOString(),number=`CT-${startDate.slice(0,4)}-${id.slice(0,8).toUpperCase()}`,reason=textValue(p.reason,'Alasan cuti',2000);
 const snapshots=Object.fromEntries(cal.years.filter(y=>result.details.some(d=>d.year===y.year)).map(y=>[y.year,y.revision]));
 const stmts=[insert('leave_requests',{id,number,employee_id:target.id,type,start_date:startDate,end_date:endDate,days:result.days,reason,status:'pending',approver_id:target.managerId,decision_note:'',policy_snapshot:JSON.stringify({collectiveLeavePolicy:config.collectiveLeavePolicy,workdays:target.workdays,calendarRevisions:snapshots}),created_at:now,updated_at:now}),...insertRows('leave_request_days',['id','request_id','date','year','chargeable','reason'],result.details.map(d=>[uid(),id,d.date,d.year,d.chargeable?1:0,d.reason]))];
 const guards:Guard[]=[{sql:"NOT EXISTS(SELECT 1 FROM leave_requests WHERE employee_id=? AND status IN ('pending','approved') AND start_date<=? AND end_date>=?)",values:[target.id,endDate,startDate]},{sql:'NOT EXISTS(SELECT 1 FROM absence_records WHERE employee_id=? AND date BETWEEN ? AND ?)',values:[target.id,startDate,endDate]},{sql:'EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND workdays=? AND manager_id=?)',values:[target.id,target.workdays,target.managerId]},{sql:"EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND role IN ('admin','manager'))",values:[target.managerId]},{sql:"EXISTS(SELECT 1 FROM organization WHERE id='main' AND updated_at=?)",values:[config.updatedAt]}];
 for(const year of new Set(result.details.map(d=>d.year))){const y=cal.years.find(y=>y.year===year)!;guards.push({sql:'EXISTS(SELECT 1 FROM calendar_years WHERE year=? AND verified=1 AND revision=?)',values:[year,y.revision]});}
 if(type==='annual'){for(const[y,days]of Object.entries(result.yearBreakdown)){const year=Number(y);guards.push({sql:'EXISTS(SELECT 1 FROM leave_balances WHERE employee_id=? AND year=? AND entitlement+adjustment-used-reserved>=?)',values:[target.id,year,days]});stmts.push(statement('UPDATE leave_balances SET reserved=reserved+?,updated_at=? WHERE employee_id=? AND year=?',[days,now,target.id,year]),ledger(actor,'reserve',`reserve:${id}:${year}`,target.id,year,id,0,days));}}
 await commit(actor,'leave.submitted',`${number} · ${target.name}`,stmts,guards,{requestId:id,days:result.days,type});return{ok:true,id,number,...result};
}
async function leaveById(id:string):Promise<Leave>{const r=await one('SELECT * FROM leave_requests WHERE id=?',[id]);assert(r,'Pengajuan cuti tidak ditemukan.',404);return camelRow<Leave>(r);}
async function leaveAllocations(id:string):Promise<{year:number;days:number}[]>{return query<{year:number;days:number}>('SELECT year,SUM(chargeable) AS days FROM leave_request_days WHERE request_id=? GROUP BY year HAVING SUM(chargeable)>0',[id]);}
async function leaveDecide(actor:Employee,p:Payload){const id=requiredId(p),request=await leaveById(id),note=textValue(p.note,'Catatan',2000,false),decision=textValue(p.decision,'Keputusan',20) as 'approve'|'reject';const next=leaveDecisionStatus(actor,request,decision,note),now=new Date().toISOString();const stmts=[statement('UPDATE leave_requests SET status=?,decision_note=?,updated_at=? WHERE id=?',[next,note,now,id]),approval(actor,'leave',id,'manager',decision,note)];if(request.type==='annual'){for(const{year,days}of await leaveAllocations(id)){stmts.push(statement('UPDATE leave_balances SET reserved=reserved-?,used=used+?,updated_at=? WHERE employee_id=? AND year=?',[days,next==='approved'?days:0,now,request.employeeId,year]),ledger(actor,next==='approved'?'approve':'release',`${next}:${id}:${year}`,request.employeeId,year,id,next==='approved'?days:0,-days));}}await commit(actor,`leave.${next}`,request.number,stmts,[{sql:"EXISTS(SELECT 1 FROM leave_requests WHERE id=? AND status='pending')",values:[id]}],{requestId:id,delegated:actor.id!==request.approverId});return{ok:true,status:next};}
async function leaveCancel(actor:Employee,p:Payload){const id=requiredId(p),request=await leaveById(id),note=textValue(p.note,'Alasan pembatalan',2000,false);assert(request.status==='pending'||request.status==='approved','Pengajuan sudah final atau dibatalkan.',409);assert((actor.id===request.employeeId&&request.status==='pending')||(actor.role==='admin'),'Pembatalan cuti yang telah disetujui atau milik orang lain hanya dapat dilakukan Administrator.',403);assert(request.status!=='approved'||note.length>0,'Alasan pembatalan cuti yang sudah disetujui wajib diisi.');const now=new Date().toISOString(),stmts=[statement("UPDATE leave_requests SET status='cancelled',decision_note=?,updated_at=? WHERE id=?",[note,now,id]),approval(actor,'leave',id,request.status,'cancel',note)];if(request.type==='annual'){for(const{year,days}of await leaveAllocations(id)){const usedDelta=request.status==='approved'?-days:0,reservedDelta=request.status==='pending'?-days:0;stmts.push(statement('UPDATE leave_balances SET used=used+?,reserved=reserved+?,updated_at=? WHERE employee_id=? AND year=?',[usedDelta,reservedDelta,now,request.employeeId,year]),ledger(actor,request.status==='approved'?'refund':'release',`cancel:${id}:${year}`,request.employeeId,year,id,usedDelta,reservedDelta));}}await commit(actor,'leave.cancelled',request.number,stmts,[{sql:'EXISTS(SELECT 1 FROM leave_requests WHERE id=? AND status=?)',values:[id,request.status]}],{requestId:id,previousStatus:request.status});return{ok:true};}

async function absenceSave(actor:Employee,p:Payload){requireAdmin(actor);const id=p.id?requiredId(p):uid(),employeeId=textValue(p.employeeId,'Karyawan',100),target=await employeeById(employeeId);assert(target.active,'Karyawan tidak aktif.');const date=dateValue(p.date,'Tanggal'),type=textValue(p.type,'Jenis ketidakhadiran',20),reason=textValue(p.reason,'Keterangan',2000);assert(type==='sick'||type==='unexcused','Jenis ketidakhadiran tidak valid.');assert(date>=target.joinDate,'Tanggal tidak boleh sebelum tanggal masuk.');if(p.id)assert(await one('SELECT id FROM absence_records WHERE id=?',[id]),'Catatan tidak ditemukan.',404);assert(!await one("SELECT id FROM leave_requests WHERE employee_id=? AND status IN ('pending','approved') AND start_date<=? AND end_date>=? LIMIT 1",[employeeId,date,date]),'Tanggal beririsan dengan cuti aktif. Batalkan/koreksi cuti sebelum mencatat sakit/alpa.',409);const now=new Date().toISOString();const s=p.id?statement('UPDATE absence_records SET employee_id=?,date=?,type=?,reason=?,updated_at=? WHERE id=?',[employeeId,date,type,reason,now,id]):insert('absence_records',{id,employee_id:employeeId,date,type,reason,created_by:actor.id,created_at:now,updated_at:now});await commit(actor,p.id?'absence.updated':'absence.created',`${target.name} · ${date}`,[s],[{sql:"NOT EXISTS(SELECT 1 FROM leave_requests WHERE employee_id=? AND status IN ('pending','approved') AND start_date<=? AND end_date>=?)",values:[employeeId,date,date]}],{recordId:id,type});return{ok:true,id};}
async function absenceDelete(actor:Employee,p:Payload){requireAdmin(actor);const id=requiredId(p),old=await one<{employee_id:string;date:string}>('SELECT employee_id,date FROM absence_records WHERE id=?',[id]);assert(old,'Catatan tidak ditemukan.',404);const e=await employeeById(old.employee_id);await commit(actor,'absence.deleted',`${e.name} · ${old.date}`,[statement('DELETE FROM absence_records WHERE id=?',[id])],[],{recordId:id});return{ok:true};}

async function purchaseSave(actor:Employee,p:Payload){assert(!p.id,'Untuk mengubah pembelian, batalkan pengajuan yang belum diproses lalu buat pengajuan baru.');const employeeId=textValue(p.employeeId??actor.id,'Pemohon',100);assert(canActFor(actor,employeeId),'Anda hanya dapat mengajukan pembelian untuk diri sendiri.',403);const target=await employeeById(employeeId);assert(target.active,'Karyawan tidak aktif.');assert(target.managerId,'Atasan belum ditetapkan. Minta Administrator melengkapi atasan pada data karyawan.');const manager=await employeeById(target.managerId);assert(manager.active&&(manager.role==='manager'||manager.role==='admin'),'Atasan harus aktif dan memiliki level Manager atau Administrator.');const title=textValue(p.title,'Judul kebutuhan',200),reason=textValue(p.reason,'Tujuan pembelian',2000),neededBy=dateValue(p.neededBy,'Tanggal kebutuhan'),priority=textValue(p.priority??'normal','Prioritas',20);assert(priority==='normal'||priority==='urgent','Prioritas tidak valid.');assert(neededBy>=jakartaToday(),'Tanggal kebutuhan tidak boleh berada di masa lalu.');const {items,total}=validatePurchaseItems(p.items);const id=uid(),number=`PR-${jakartaToday().slice(0,4)}-${id.slice(0,8).toUpperCase()}`,now=new Date().toISOString();await commit(actor,'purchase.submitted',`${number} · ${title}`,[insert('purchase_requests',{id,number,employee_id:employeeId,title,department:target.department,priority,needed_by:neededBy,reason,total,status:'pending_manager',approver_id:target.managerId,decision_note:'',created_at:now,updated_at:now}),...insertRows('purchase_request_items',['id','request_id','name','quantity','unit','unit_price','sort_order'],items.map((item,index)=>[uid(),id,item.name,item.quantity,item.unit,item.unitPrice,index]))],[{sql:'EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND manager_id=?)',values:[target.id,target.managerId]},{sql:"EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND role IN ('admin','manager'))",values:[target.managerId]}],{requestId:id,total});return{ok:true,id,number,total};}
async function purchaseById(id:string):Promise<Purchase>{const r=await one('SELECT * FROM purchase_requests WHERE id=?',[id]);assert(r,'Permintaan pembelian tidak ditemukan.',404);return camelRow<Purchase>(r);}
async function purchaseDecide(actor:Employee,p:Payload){
 const id=requiredId(p),request=await purchaseById(id),decision=textValue(p.decision,'Keputusan',20),note=textValue(p.note,'Catatan',2000,false);
 const next=purchaseDecisionStatus(actor,request,decision,note);
 const guards:Guard[]=[{sql:'EXISTS(SELECT 1 FROM purchase_requests WHERE id=? AND status=?)',values:[id,request.status]}];
 if(request.status!=='pending_manager'&&actor.role!=='admin')guards.push({
  sql:"EXISTS(SELECT 1 FROM employees e JOIN work_units u ON u.id=e.work_unit_id JOIN divisions d ON d.id=u.division_id WHERE e.id=? AND e.active=1 AND e.role='manager' AND u.code='PURCHASING' AND u.active=1 AND d.active=1)",values:[actor.id],
 });
 await commit(actor,`purchase.${next}`,request.number,[statement('UPDATE purchase_requests SET status=?,decision_note=?,updated_at=? WHERE id=?',[next,note,new Date().toISOString(),id]),approval(actor,'purchase',id,request.status,decision,note)],guards,{requestId:id,previousStatus:request.status,delegated:request.status==='pending_manager'&&actor.id!==request.approverId});
 return{ok:true,status:next};
}

async function purchaseCancel(actor:Employee,p:Payload){const id=requiredId(p),request=await purchaseById(id),note=textValue(p.note,'Catatan',2000,false);assert(request.status==='pending_manager'||((actor.role==='admin')&&request.status==='pending_purchasing'),'Pengajuan hanya dapat dibatalkan sebelum disetujui Purchasing.',409);assert(actor.id===request.employeeId||(actor.role==='admin'),'Anda tidak dapat membatalkan permintaan orang lain.',403);await commit(actor,'purchase.cancelled',request.number,[statement("UPDATE purchase_requests SET status='cancelled',decision_note=?,updated_at=? WHERE id=?",[note,new Date().toISOString(),id]),approval(actor,'purchase',id,request.status,'cancel',note)],[{sql:'EXISTS(SELECT 1 FROM purchase_requests WHERE id=? AND status=?)',values:[id,request.status]}],{requestId:id});return{ok:true};}

async function balancePreview(actor:Employee,p:Payload){requireAdmin(actor);const [employees,balances]=await Promise.all([allEmployees(),allBalances()]);return validateBalanceImport(p.rows,employees,balances);}
async function balanceImport(actor:Employee,p:Payload){
 const preview=await balancePreview(actor,p);assert(preview.valid,`Import dibatalkan. ${preview.errors.map(e=>`Baris ${e.row}: ${e.message}`).join(' ')}`);
 const current=await allBalances();const same=preview.rows.every(r=>{const b=current.find(b=>b.employeeId===r.employeeId&&b.year===r.year);return b&&b.entitlement===r.entitlement&&b.adjustment===r.adjustment;});
 if(same)return{ok:true,alreadyImported:true,unchanged:true,count:preview.rows.length,message:'Saldo yang dipilih sudah sesuai; tidak ada perubahan.'};
 const canonical=JSON.stringify(preview.rows.map(({employeeId,nip,year,entitlement,adjustment})=>({employeeId,nip,year,entitlement,adjustment})).sort((a,b)=>(a.nip+':'+a.year).localeCompare(b.nip+':'+b.year)));
 // A file can legitimately be restored after a later import. The last immutable
 // ledger event is the balance revision, so an old content hash is not a permanent lock.
 const latest=await query<{employee_id:string;year:number;id:string}>('SELECT employee_id,year,id FROM leave_ledger WHERE rowid IN (SELECT MAX(rowid) FROM leave_ledger GROUP BY employee_id,year)');
 const revisions=preview.rows.map(r=>({employeeId:r.employeeId,year:r.year,revision:latest.find(l=>l.employee_id===r.employeeId&&l.year===r.year)?.id??'new'})).sort((a,b)=>(a.employeeId+':'+a.year).localeCompare(b.employeeId+':'+b.year));
 const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const [checksum,contentChecksum]=await Promise.all([hash(canonical+'\n'+JSON.stringify(revisions)),hash(canonical)]);
 const id=uid(),now=new Date().toISOString(),stmts:D1PreparedStatement[]=[insert('import_batches',{id,checksum,type:'leave_balances',row_count:preview.rows.length,actor_id:actor.id,created_at:now})],guards:Guard[]=[{sql:'NOT EXISTS(SELECT 1 FROM import_batches WHERE checksum=?)',values:[checksum]}];
 for(const r of preview.rows){
  guards.push({sql:'EXISTS(SELECT 1 FROM employees WHERE id=? AND nip=? AND active=1)',values:[r.employeeId,r.nip]});
  const before=current.find(b=>b.employeeId===r.employeeId&&b.year===r.year);guards.push(before?{sql:'EXISTS(SELECT 1 FROM leave_balances WHERE employee_id=? AND year=? AND entitlement=? AND adjustment=?)',values:[r.employeeId,r.year,before.entitlement,before.adjustment]}:{sql:'NOT EXISTS(SELECT 1 FROM leave_balances WHERE employee_id=? AND year=?)',values:[r.employeeId,r.year]});
  stmts.push(statement(`INSERT INTO leave_ledger (id,event_key,employee_id,year,request_id,event,entitlement_delta,adjustment_delta,used_delta,reserved_delta,actor_id,created_at) SELECT ?,?,?,?,NULL,'import',?-COALESCE((SELECT entitlement FROM leave_balances WHERE employee_id=? AND year=?),0),?-COALESCE((SELECT adjustment FROM leave_balances WHERE employee_id=? AND year=?),0),0,0,?,?`,[uid(),`import:${id}:${r.employeeId}:${r.year}`,r.employeeId,r.year,r.entitlement,r.employeeId,r.year,r.adjustment,r.employeeId,r.year,actor.id,now]),statement(`INSERT INTO leave_balances (id,employee_id,year,entitlement,adjustment,used,reserved,updated_at) VALUES (?,?,?,?,?,0,0,?) ON CONFLICT(employee_id,year) DO UPDATE SET entitlement=excluded.entitlement,adjustment=excluded.adjustment,updated_at=excluded.updated_at`,[uid(),r.employeeId,r.year,r.entitlement,r.adjustment,now]));
 }
 await commit(actor,'balance.imported',`${preview.rows.length} saldo cuti diperbarui`,stmts,guards,{batchId:id,checksum,contentChecksum,count:preview.rows.length});return{ok:true,batchId:id,count:preview.rows.length};
}

async function holidaySave(actor:Employee,p:Payload){requireAdmin(actor);const id=p.id?requiredId(p):uid(),date=dateValue(p.date,'Tanggal libur'),year=Number(date.slice(0,4)),name=textValue(p.name,'Nama hari libur',200),kind=textValue(p.kind,'Jenis libur',20),url=sourceUrl(p.sourceUrl);assert(kind==='national'||kind==='collective','Jenis libur tidak valid.');const old=p.id?await one<{year:number}>('SELECT year FROM holidays WHERE id=?',[id]):null;assert(!p.id||old,'Hari libur tidak ditemukan.',404);const duplicate=await one('SELECT id FROM holidays WHERE date=? AND id<>?',[date,id]);assert(!duplicate,'Tanggal ini sudah ada di kalender. Edit entri yang tersedia.',409);const now=new Date().toISOString(),stmts=[statement('INSERT INTO calendar_years (year,verified,source_url,revision) VALUES (?,0,?,1) ON CONFLICT(year) DO UPDATE SET verified=0,revision=revision+1',[year,url])];if(old&&old.year!==year)stmts.push(statement('UPDATE calendar_years SET verified=0,revision=revision+1 WHERE year=?',[old.year]));stmts.push(p.id?statement('UPDATE holidays SET date=?,name=?,kind=?,source_url=?,year=?,updated_at=? WHERE id=?',[date,name,kind,url,year,now,id]):insert('holidays',{id,date,name,kind,source_url:url,year,updated_at:now}));await commit(actor,'calendar.holiday_saved',`${date} · ${name}`,stmts,[],{year,requiresVerification:true});return{ok:true,id,requiresVerification:true};}
async function holidayDelete(actor:Employee,p:Payload){requireAdmin(actor);const id=requiredId(p),old=await one<{year:number;date:string;name:string}>('SELECT year,date,name FROM holidays WHERE id=?',[id]);assert(old,'Hari libur tidak ditemukan.',404);await commit(actor,'calendar.holiday_deleted',`${old.date} · ${old.name}`,[statement('DELETE FROM holidays WHERE id=?',[id]),statement('UPDATE calendar_years SET verified=0,revision=revision+1 WHERE year=?',[old.year])],[],{year:old.year,requiresVerification:true});return{ok:true,requiresVerification:true};}
async function calendarVerify(actor:Employee,p:Payload){requireAdmin(actor);const year=yearValue(p.year),url=sourceUrl(p.sourceUrl);const count=await one<{count:number}>("SELECT COUNT(*) AS count FROM holidays WHERE year=? AND kind='national'",[year]);assert(count&&count.count>0,'Isi hari libur nasional dan cocokkan seluruh tahun dengan sumber resmi sebelum verifikasi.');await commit(actor,'calendar.verified',`Kalender ${year} diverifikasi`,[statement('UPDATE calendar_years SET verified=1,source_url=?,verified_at=?,verified_by=?,revision=revision+1 WHERE year=?',[url,new Date().toISOString(),actor.id,year])],[{sql:"EXISTS(SELECT 1 FROM holidays WHERE year=? AND kind='national')",values:[year]}],{year,sourceUrl:url});return{ok:true};}
async function calendarSync(actor:Employee,p:Payload){requireAdmin(actor);const year=yearValue(p.year),holidays=officialHolidays(year),url=officialSource(year);assert(url&&holidays.length>0,`Paket kalender resmi untuk ${year} belum tersedia. Tambahkan tanggal dari SKB resmi melalui Kalender lalu verifikasi tahun tersebut.`,409,'CALENDAR_NOT_BUNDLED');const now=new Date().toISOString();const priorYear=await one<{revision:number}>('SELECT revision FROM calendar_years WHERE year=?',[year]);const existing=await query<{date:string}>('SELECT date FROM holidays WHERE year=?',[year]);const dates=new Set(holidays.map(h=>h.date));const extra=existing.filter(h=>!dates.has(h.date));const verified=extra.length===0?1:0;const stmts=[statement('INSERT INTO calendar_years (year,verified,source_url,verified_at,verified_by,revision) VALUES (?,?,?,?,?,1) ON CONFLICT(year) DO UPDATE SET verified=excluded.verified,source_url=excluded.source_url,verified_at=excluded.verified_at,verified_by=excluded.verified_by,revision=revision+1',[year,verified,url,now,actor.id]),...insertRows('holidays',['id','date','name','kind','source_url','year','updated_at'],holidays.map(h=>[h.id!,h.date,h.name,h.kind,h.sourceUrl,year,now]),'ON CONFLICT(date) DO UPDATE SET name=excluded.name,kind=excluded.kind,source_url=excluded.source_url,year=excluded.year,updated_at=excluded.updated_at')];await commit(actor,'calendar.synced',`Kalender resmi ${year} · ${holidays.length} tanggal`,stmts,[priorYear?{sql:'EXISTS(SELECT 1 FROM calendar_years WHERE year=? AND revision=?)',values:[year,priorYear.revision]}:{sql:'NOT EXISTS(SELECT 1 FROM calendar_years WHERE year=?)',values:[year]}],{year,sourceUrl:url,manualExtraDates:extra.length});return{ok:true,count:holidays.length,requiresVerification:extra.length>0,message:extra.length>0?'Data resmi diperbarui. Periksa tanggal tambahan manual lalu verifikasi ulang kalender.':'Kalender resmi sudah diperbarui dan diverifikasi.'};}
async function settingsSave(actor:Employee,p:Payload){requireAdmin(actor);const old=await settings(),companyName=textValue(p.companyName??old.companyName,'Nama perusahaan',150),policy=textValue(p.collectiveLeavePolicy??old.collectiveLeavePolicy,'Kebijakan cuti bersama',20),entitlement=integerValue(p.defaultAnnualEntitlement??old.defaultAnnualEntitlement,'Hak cuti default',0,366),workdays=normalizeWorkdays(p.workdays??old.workdays);assert(policy==='exclude'||policy==='deduct','Kebijakan cuti bersama tidak valid.');await commit(actor,'settings.updated','Kebijakan perusahaan diperbarui',[statement("UPDATE organization SET company_name=?,collective_leave_policy=?,default_annual_entitlement=?,workdays=?,updated_at=? WHERE id='main'",[companyName,policy,entitlement,workdays,new Date().toISOString()])],[],{collectiveLeavePolicy:policy,defaultAnnualEntitlement:entitlement,workdays});return{ok:true};}

export async function performAction(actor:Employee,action:string,p:Payload):Promise<unknown>{switch(action){
 case'employee.save':return employeeSave(actor,p);case'employee.delete':return employeeDelete(actor,p);
 case'leave.preview':return(await previewLeave(actor,p)).result;case'leave.create':return leaveCreate(actor,p);case'leave.decide':return leaveDecide(actor,p);case'leave.cancel':return leaveCancel(actor,p);
 case'absence.save':return absenceSave(actor,p);case'absence.delete':return absenceDelete(actor,p);
 case'purchase.save':return purchaseSave(actor,p);case'purchase.decide':return purchaseDecide(actor,p);case'purchase.cancel':return purchaseCancel(actor,p);
 case'balance.preview':return balancePreview(actor,p);case'balance.import':return balanceImport(actor,p);
 case'holiday.save':return holidaySave(actor,p);case'holiday.delete':return holidayDelete(actor,p);case'calendar.verify':return calendarVerify(actor,p);case'calendar.sync':return calendarSync(actor,p);case'settings.save':return settingsSave(actor,p);
 default:throw new AppError('Tindakan tidak dikenal.',400,'UNKNOWN_ACTION');
}}
