import { getChatGPTUser } from '../../chatgpt-auth';
import { AppError, assert } from '../../../lib/domain';
import { resolveViewer } from '../../../lib/server/bootstrap';
import { getWorkspace, performAction } from '../../../lib/server/workspace';
export const dynamic='force-dynamic';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store, max-age=0','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers});}
function fail(error:unknown){if(error instanceof AppError)return json({error:error.message,code:error.code},error.status);console.error('workspace request failed',error instanceof Error?error.message:'unknown error');return json({error:'Permintaan belum dapat diproses. Muat ulang atau hubungi administrator.',code:'INTERNAL_ERROR'},500);}
async function viewer(){const user=await getChatGPTUser();assert(user,'Masuk dengan ChatGPT untuk membuka workspace.',401,'UNAUTHENTICATED');return resolveViewer(user);}
export async function GET(){try{return json(await getWorkspace(await viewer()));}catch(error){return fail(error);}}
export async function POST(request:Request){try{
 const origin=request.headers.get('Origin');if(origin){let sameOrigin=false;try{sameOrigin=new URL(origin).origin===new URL(request.url).origin;}catch{/* Opaque or malformed origins are never authorized. */}assert(sameOrigin,'Permintaan lintas situs ditolak.',403,'ORIGIN_REJECTED');}
 const fetchSite=request.headers.get('Sec-Fetch-Site');assert(fetchSite!=='cross-site','Permintaan lintas situs ditolak.',403,'ORIGIN_REJECTED');
 assert(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()==='application/json','Gunakan Content-Type application/json.',415,'CONTENT_TYPE');
 const contentLength=Number(request.headers.get('Content-Length')??0);assert(contentLength<=256_000,'Ukuran permintaan melebihi batas 256 KB.',413);const body=await request.text();assert(body.length<=256_000,'Ukuran permintaan melebihi batas 256 KB.',413);
 let input:unknown;try{input=JSON.parse(body);}catch{throw new AppError('JSON permintaan tidak valid.');}
 assert(input&&typeof input==='object'&&!Array.isArray(input),'Format permintaan tidak valid.');const parsed=input as {action?:unknown;payload?:unknown};assert(typeof parsed.action==='string','Tindakan wajib diisi.');assert(parsed.payload&&typeof parsed.payload==='object'&&!Array.isArray(parsed.payload),'Payload harus berupa objek.');
 return json(await performAction(await viewer(),parsed.action,parsed.payload as Record<string,unknown>));
 }catch(error){return fail(error);}}
