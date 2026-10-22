import holidayBundle from '../data/holidays-verified.json';
import { env } from 'cloudflare:workers';
import { AppError, calculateLeave, type Employee, type Holiday } from '../domain';
import { db, statement, one, employeeBySubject, uid, type SqlValue } from './db';
import type { ChatGPTUser } from '../../app/chatgpt-auth';

export const officialYears=holidayBundle.coverage.map(x=>x.year);
export function officialHolidays(year:number):Holiday[]{return holidayBundle.holidays.filter(h=>Number(h.date.slice(0,4))===year).map(h=>({id:'id-'+h.date,date:h.date,name:h.name,kind:h.kind==='national_holiday'?'national':'collective',year,sourceUrl:holidayBundle.sources.find(s=>s.id===h.source_id)!.url}));}
export function officialSource(year:number):string|null {const coverage=holidayBundle.coverage.find(c=>c.year===year);return holidayBundle.sources.find(s=>s.id===coverage?.source_id)?.url??null;}
function seedInsert(table:string,columns:string[],rows:SqlValue[][],token:string):D1PreparedStatement[]{
 // D1's compound-SELECT limit is lower than desktop SQLite's. A VALUES CTE
 // inserts multiple rows without UNION ALL, while retaining the atomic
 // bootstrap-token guard. Leave room below D1's 100 bound-parameter limit.
 const rowsPerStatement=Math.max(1,Math.floor(88/columns.length));
 const result:D1PreparedStatement[]=[];
 const columnList=columns.join(',');
 const placeholders=`(${columns.map(()=>'?').join(',')})`;
 for(let offset=0;offset<rows.length;offset+=rowsPerStatement){
  const chunk=rows.slice(offset,offset+rowsPerStatement);
  result.push(statement(`WITH seed (${columnList}) AS (VALUES ${chunk.map(()=>placeholders).join(',')})
   INSERT INTO ${table} (${columnList})
   SELECT ${columnList} FROM seed
   WHERE EXISTS(SELECT 1 FROM organization WHERE id='main' AND bootstrap_token=? AND initialized=0)`,[...chunk.flat(),token]));
 }
 return result;
}

async function initialize(user:ChatGPTUser):Promise<void>{
 const token=uid(),ownerId=uid(),now=new Date().toISOString();const email=user.email.trim().toLowerCase();
 const bootstrapEmail=(env as typeof env & {WORKSPACE_BOOTSTRAP_EMAIL?:string}).WORKSPACE_BOOTSTRAP_EMAIL?.trim().toLowerCase();
 if(bootstrapEmail&&email!==bootstrapEmail)throw new AppError('Workspace belum diinisialisasi. Pemilik aplikasi perlu masuk terlebih dahulu.',403,'BOOTSTRAP_OWNER_REQUIRED');
 const employeeRows:SqlValue[][]=[
  [ownerId,'ADMIN-001',user.displayName,email,user.userId,'Manajemen','Administrator',null,'admin','1,2,3,4,5',1,'2026-01-01',now,now,null],
  ['demo-bima','EMP-001','Bima Pratama','bima@example.invalid',null,'Surfacing','Manager Operasional',ownerId,'manager','1,2,3,4,5',1,'2022-02-01',now,now,'unit-surfacing'],
  ['demo-ayu','EMP-002','Ayu Lestari','ayu@example.invalid',null,'HR & General Affair','HR Specialist',ownerId,'manager','1,2,3,4,5',1,'2023-03-15',now,now,'unit-hr-general-affair'],
  ['demo-nadia','EMP-003','Nadia Putri','nadia@example.invalid',null,'Surfacing','Staff Operasional','demo-bima','employee','1,2,3,4,5',1,'2024-01-08',now,now,'unit-surfacing'],
  ['demo-raka','EMP-004','Raka Wibowo','raka@example.invalid',null,'IT','IT Support',ownerId,'employee','1,2,3,4,5',1,'2023-06-12',now,now,'unit-it'],
  ['demo-sekar','EMP-005','Sekar Anindita','sekar@example.invalid',null,'Account Receiveable & Finance','Finance Staff',ownerId,'employee','1,2,3,4,5',1,'2022-09-01',now,now,'unit-ar-finance'],
  ['demo-dimas','EMP-006','Dimas Saputra','dimas@example.invalid',null,'Warehouse LAB','Warehouse Staff','demo-bima','employee','1,2,3,4,5,6',1,'2024-05-06',now,now,'unit-warehouse-lab'],
  ['demo-fajar','EMP-007','Fajar Nugroho','fajar@example.invalid',null,'Purchasing','Purchasing Officer',ownerId,'manager','1,2,3,4,5',1,'2023-08-21',now,now,'unit-purchasing'],
  ['demo-intan','EMP-008','Intan Permata','intan@example.invalid',null,'HR & General Affair','Admin HR','demo-ayu','employee','1,2,3,4,5',1,'2025-02-03',now,now,'unit-hr-general-affair'],
 ];
 const holidays=officialYears.flatMap(officialHolidays);
 const leaveSeeds=[
  {id:'demo-leave-01',number:'CT-2026-DEMO01',employeeId:'demo-nadia',start:'2026-10-26',end:'2026-10-28',reason:'Keperluan keluarga',status:'pending',approverId:'demo-bima',createdAt:'2026-10-16T03:15:00.000Z'},
  {id:'demo-leave-02',number:'CT-2026-DEMO02',employeeId:'demo-raka',start:'2026-11-02',end:'2026-11-03',reason:'Acara keluarga di luar kota',status:'pending',approverId:ownerId,createdAt:'2026-10-17T04:30:00.000Z'},
  {id:'demo-leave-03',number:'CT-2026-DEMO03',employeeId:'demo-sekar',start:'2026-10-12',end:'2026-10-14',reason:'Istirahat tahunan',status:'approved',approverId:ownerId,createdAt:'2026-10-05T02:10:00.000Z'},
  {id:'demo-leave-04',number:'CT-2026-DEMO04',employeeId:'demo-dimas',start:'2026-12-23',end:'2026-12-28',reason:'Libur akhir tahun bersama keluarga',status:'pending',approverId:'demo-bima',createdAt:'2026-10-18T07:40:00.000Z'},
 ];
 const balanceState=new Map<string,{used:number;reserved:number}>();const leaveRows:SqlValue[][]=[],dayRows:SqlValue[][]=[],ledgerRows:SqlValue[][]=[],approvalRows:SqlValue[][]=[];
 for(const e of employeeRows){for(const year of officialYears){balanceState.set(e[0]+':'+year,{used:0,reserved:0});ledgerRows.push([uid(),`seed-grant:${e[0]}:${year}`,e[0],year,null,'initial_grant',12,0,0,0,ownerId,now]);}}
 for(const l of leaveSeeds){const workdays=String(employeeRows.find(e=>e[0]===l.employeeId)![9]);const calc=calculateLeave({startDate:l.start,endDate:l.end,type:'annual',workdays,collectiveLeavePolicy:'exclude',holidays,verifiedYears:officialYears});
  leaveRows.push([l.id,l.number,l.employeeId,'annual',l.start,l.end,calc.days,l.reason,l.status,l.approverId,l.status==='approved'?'Disetujui (contoh fiktif)':'',JSON.stringify({workdays,collectiveLeavePolicy:'exclude',calendarRevisions:{2026:1}}),l.createdAt,l.createdAt]);
  for(const d of calc.details)dayRows.push([uid(),l.id,d.date,d.year,d.chargeable?1:0,d.reason]);
  for(const[y,n]of Object.entries(calc.yearBreakdown)){const b=balanceState.get(l.employeeId+':'+y)!;if(l.status==='approved')b.used+=n;else b.reserved+=n;ledgerRows.push([uid(),`seed-request:${l.id}:${y}`,l.employeeId,Number(y),l.id,l.status==='approved'?'approved':'reserve',0,0,l.status==='approved'?n:0,l.status==='pending'?n:0,ownerId,l.createdAt]);}
  if(l.status==='approved')approvalRows.push([uid(),'leave',l.id,'manager','approve',ownerId,'Disetujui (contoh fiktif)',l.createdAt]);
 }
 const balanceRows:SqlValue[][]=[];for(const e of employeeRows){for(const year of officialYears){const b=balanceState.get(e[0]+':'+year)!;balanceRows.push([uid(),e[0],year,12,0,b.used,b.reserved,now]);}}
 const purchaseRows:SqlValue[][]=[
  ['demo-pr-01','PR-2026-DEMO01','demo-nadia','Monitor untuk tim operasional','Surfacing','normal','2026-10-30','Menambah dua workstation untuk tim operasional',5_300_000,'pending_manager','demo-bima','','2026-10-18T02:00:00.000Z',now],
  ['demo-pr-02','PR-2026-DEMO02','demo-raka','Printer label pengiriman','IT','urgent','2026-10-23','Printer pengganti untuk kelancaran pengiriman',3_400_000,'pending_purchasing',ownerId,'Disetujui atasan (contoh fiktif)','2026-10-16T05:30:00.000Z',now],
  ['demo-pr-03','PR-2026-DEMO03','demo-dimas','Perlengkapan packing gudang','Warehouse LAB','normal','2026-10-26','Pengisian kembali perlengkapan operasional',1_200_000,'ordered','demo-bima','Pesanan diproses vendor (contoh fiktif)','2026-10-13T04:10:00.000Z',now],
  ['demo-pr-04','PR-2026-DEMO04','demo-intan','Alat tulis dan kertas kantor','HR & General Affair','normal','2026-10-16','Kebutuhan administrasi bulanan',750_000,'received','demo-ayu','Barang sudah diterima (contoh fiktif)','2026-10-08T02:00:00.000Z',now],
 ];
 const purchaseItems:SqlValue[][]=[['demo-pi-01','demo-pr-01','Monitor IPS 24 inci',2,'unit',2_650_000,0],['demo-pi-02','demo-pr-02','Printer label thermal',1,'unit',3_400_000,0],['demo-pi-03','demo-pr-03','Kardus pengiriman',100,'pcs',9_000,0],['demo-pi-04','demo-pr-03','Lakban kemasan',20,'roll',15_000,1],['demo-pi-05','demo-pr-04','Kertas A4',10,'rim',55_000,0],['demo-pi-06','demo-pr-04','Alat tulis kantor',1,'paket',200_000,1]];
 for(const p of purchaseRows){if(p[9]!=='pending_manager')approvalRows.push([uid(),'purchase',p[0],'pending_manager','approve',p[10],'Disetujui (contoh fiktif)',now]);if(['ordered','received'].includes(String(p[9]))){approvalRows.push([uid(),'purchase',p[0],'pending_purchasing','approve','demo-fajar','Disetujui (contoh fiktif)',now],[uid(),'purchase',p[0],'approved','order','demo-fajar','Dipesan (contoh fiktif)',now]);}if(p[9]==='received')approvalRows.push([uid(),'purchase',p[0],'ordered','receive','demo-fajar','Diterima (contoh fiktif)',now]);}
 const statements=[
  statement(`INSERT OR IGNORE INTO organization (id,owner_subject,bootstrap_token,initialized,company_name,collective_leave_policy,default_annual_entitlement,workdays,demo,created_at,updated_at) VALUES ('main',?,?,0,'Ruang Kerja','exclude',12,'1,2,3,4,5',1,?,?)`,[user.userId,token,now,now]),
  ...seedInsert('employees',['id','nip','name','email','auth_subject','department','position','manager_id','role','workdays','active','join_date','created_at','updated_at','work_unit_id'],employeeRows,token),
  ...seedInsert('calendar_years',['year','verified','source_url','verified_at','verified_by','revision'],officialYears.map(y=>[y,1,officialSource(y),now,ownerId,1]),token),
  ...seedInsert('holidays',['id','date','name','kind','source_url','year','updated_at'],holidays.map(h=>[h.id!,h.date,h.name,h.kind,h.sourceUrl,h.year,now]),token),
  ...seedInsert('leave_balances',['id','employee_id','year','entitlement','adjustment','used','reserved','updated_at'],balanceRows,token),
  ...seedInsert('leave_requests',['id','number','employee_id','type','start_date','end_date','days','reason','status','approver_id','decision_note','policy_snapshot','created_at','updated_at'],leaveRows,token),
  ...seedInsert('leave_request_days',['id','request_id','date','year','chargeable','reason'],dayRows,token),
  ...seedInsert('leave_ledger',['id','event_key','employee_id','year','request_id','event','entitlement_delta','adjustment_delta','used_delta','reserved_delta','actor_id','created_at'],ledgerRows,token),
  ...seedInsert('absence_records',['id','employee_id','date','type','reason','created_by','created_at','updated_at'],[['demo-absence-01','demo-raka','2026-10-12','sick','Istirahat karena sakit (contoh fiktif)','demo-ayu',now,now],['demo-absence-02','demo-dimas','2026-10-09','unexcused','Belum ada keterangan (contoh fiktif)','demo-ayu',now,now]],token),
  ...seedInsert('purchase_requests',['id','number','employee_id','title','department','priority','needed_by','reason','total','status','approver_id','decision_note','created_at','updated_at'],purchaseRows,token),
  ...seedInsert('purchase_request_items',['id','request_id','name','quantity','unit','unit_price','sort_order'],purchaseItems,token),
  ...seedInsert('approval_events',['id','entity_type','entity_id','stage','decision','actor_id','note','created_at'],approvalRows,token),
  ...seedInsert('audit_logs',['id','action','actor_id','subject','details','created_at'],[[uid(),'workspace.initialized',ownerId,'Workspace dibuat dengan 8 karyawan fiktif',JSON.stringify({demo:true,calendarYears:officialYears}),now]],token),
  statement("UPDATE organization SET initialized=1 WHERE id='main' AND bootstrap_token=? AND initialized=0",[token]),
 ];
 await db().batch(statements);
}

export async function resolveViewer(user:ChatGPTUser):Promise<Employee>{
 const org=await one<{initialized:number}>("SELECT initialized FROM organization WHERE id='main'");if(!org||!org.initialized)await initialize(user);
 let employee=await employeeBySubject(user.userId);
 if(!employee){
  const email=user.email.trim().toLowerCase();
  const candidate=await one<{id:string}>('SELECT id FROM employees WHERE email=? AND auth_subject IS NULL AND active=1',[email]);
  if(candidate){
   const linkedAt=new Date().toISOString();
   // Provisioning may change while the identity lookup is in flight. Bind only
   // if this active, unclaimed employee still belongs to the same email.
   await db().batch([
    statement('UPDATE employees SET auth_subject=?,updated_at=? WHERE id=? AND email=? AND auth_subject IS NULL AND active=1',[user.userId,linkedAt,candidate.id,email]),
    statement("INSERT INTO audit_logs (id,action,actor_id,subject,details,created_at) SELECT ?,'account.linked',id,'Akun ChatGPT ditautkan','{}',? FROM employees WHERE id=? AND auth_subject=? AND updated_at=?",[uid(),linkedAt,candidate.id,user.userId,linkedAt]),
   ]);
   employee=await employeeBySubject(user.userId);
  }
 }
 if(!employee)throw new AppError('Akun Anda belum terdaftar atau dinonaktifkan. Minta Admin menambahkan email ChatGPT Anda ke data karyawan aktif.',403,'NOT_PROVISIONED');
 return employee;
}
