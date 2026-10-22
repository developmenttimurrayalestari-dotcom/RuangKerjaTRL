import { env } from 'cloudflare:workers';
import { AppError, type Employee } from '../domain';
export type SqlValue = string|number|null;
export function db():D1Database {if(!env.DB) throw new AppError('Database belum terhubung. Hubungi administrator.',503,'DATABASE_UNAVAILABLE');return env.DB;}
export function statement(sql:string,values:SqlValue[]=[]):D1PreparedStatement{return db().prepare(sql).bind(...values);}
export async function query<T=Record<string,unknown>>(sql:string,values:SqlValue[]=[]):Promise<T[]> {const r=await statement(sql,values).all<T>();return r.results;}
export async function one<T=Record<string,unknown>>(sql:string,values:SqlValue[]=[]):Promise<T|null>{return await statement(sql,values).first<T>();}
export function insert(table:string,row:Record<string,SqlValue>):D1PreparedStatement {const keys=Object.keys(row);return statement(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,Object.values(row));}
export function insertRows(table:string,keys:string[],rows:SqlValue[][],suffix=''):D1PreparedStatement[]{const size=Math.max(1,Math.floor(90/keys.length));const result:D1PreparedStatement[]=[];for(let offset=0;offset<rows.length;offset+=size){const chunk=rows.slice(offset,offset+size);result.push(statement(`INSERT INTO ${table} (${keys.join(',')}) VALUES ${chunk.map(()=>`(${keys.map(()=>'?').join(',')})`).join(',')} ${suffix}`,chunk.flat()));}return result;}
export type Guard={sql:string;values?:SqlValue[]};
export function guardStatement(id:string,guard:Guard):D1PreparedStatement{return statement(`INSERT INTO mutation_guards (id,valid) SELECT ?,CASE WHEN (${guard.sql}) THEN 1 ELSE 0 END`,[id,...(guard.values??[])]);}
export function uid():string{return crypto.randomUUID();}
export async function commit(actor:Employee,action:string,subject:string,statements:D1PreparedStatement[],guards:Guard[]=[],details:unknown={}):Promise<void>{const id=uid();const now=new Date().toISOString();const allGuards=[{sql:"EXISTS(SELECT 1 FROM employees WHERE id=? AND active=1 AND role=? AND COALESCE(work_unit_id,'')=?)",values:[actor.id,actor.role,actor.workUnitId??'']},...guards];const guarded=allGuards.map((g,i)=>guardStatement(id+':'+i,g));const cleanup=statement('DELETE FROM mutation_guards WHERE id LIKE ?',[id+':%']);try{await db().batch([...guarded,...statements,insert('audit_logs',{id:uid(),action,actor_id:actor.id,subject,details:JSON.stringify(details),created_at:now}),cleanup]);}catch(error){const msg=error instanceof Error?error.message:String(error);if(/constraint|UNIQUE|mutation_precondition|FOREIGN KEY/i.test(msg)){throw new AppError('Data berubah bersamaan atau melanggar aturan. Muat ulang, periksa duplikasi, saldo, tanggal, dan status sebelum mencoba lagi.',409,'CONFLICT');}throw error;}}
export function camelRow<T>(row:Record<string,unknown>):T {const result:Record<string,unknown>={};for(const[k,v]of Object.entries(row))result[k.replace(/_([a-z])/g,(_,x)=>x.toUpperCase())]=v;return result as T;}
export function mapEmployee(row:Record<string,unknown>):Employee {const e=camelRow<Employee>(row);e.active=Boolean(e.active);e.workUnitId??=null;e.workUnitName??=null;e.workUnitCode??=null;e.divisionId??=null;e.divisionName??=null;return e;}
// Resolve organizational authority from the database, never request payload labels.
// Retain legacy department text only for older employees not yet assigned a unit.
const employeeSelect=`SELECT e.id,e.nip,e.name,e.email,COALESCE(u.name,e.department) AS department,
 e.position,e.manager_id,e.role,e.workdays,e.active,e.join_date,e.work_unit_id,
 u.name AS work_unit_name,CASE WHEN u.active=1 AND d.active=1 THEN u.code ELSE NULL END AS work_unit_code,
 d.id AS division_id,d.name AS division_name
 FROM employees e LEFT JOIN work_units u ON u.id=e.work_unit_id LEFT JOIN divisions d ON d.id=u.division_id`;
export async function allEmployees():Promise<Employee[]>{return(await query(employeeSelect+' ORDER BY e.name')).map(mapEmployee);}
export async function employeeBySubject(subject:string):Promise<Employee|null>{const row=await one(employeeSelect+' WHERE e.auth_subject=? AND e.active=1',[subject]);return row?mapEmployee(row):null;}
