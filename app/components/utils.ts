export const roleLabel: Record<string,string>={admin:'Administrator',manager:'Manager',employee:'Staff'};
export const statusLabel:Record<string,string>={pending:'Menunggu atasan',pending_manager:'Menunggu atasan',pending_purchasing:'Review Purchasing',approved:'Disetujui',rejected:'Ditolak',cancelled:'Dibatalkan',ordered:'Dipesan',received:'Diterima'};
export const todayISO=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n||0);
export const dateLabel=(date:string,long=false)=>date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:long?'long':'short',year:long?'numeric':undefined,timeZone:date.includes('T')?'Asia/Jakarta':'UTC'}).format(new Date(date.includes('T')?date:date.slice(0,10)+'T12:00:00Z')):'—';
export const rangeLabel=(s:string,e:string)=>s===e?dateLabel(s,true):`${dateLabel(s)} – ${dateLabel(e,true)}`;
export const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase();
export const matches=(query:string,...values:unknown[])=>!query||values.join(' ').toLocaleLowerCase('id-ID').includes(query.toLocaleLowerCase('id-ID'));
export async function callApi<T=Record<string,unknown>>(action:string,payload:unknown={}):Promise<T> {
  const res=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload}),cache:'no-store'});
  const body:unknown=await res.json().catch(()=>({error:'Server belum dapat dihubungi. Coba lagi.'}));
  const error=body&&typeof body==='object'&&'error'in body&&typeof body.error==='string'?body.error:'';
  if(!res.ok||error)throw new Error(error||'Permintaan tidak dapat diproses.');
  return body as T;
}
export function downloadCsv(filename:string,headers:string[],rows:unknown[][]){
  const escape=(v:unknown)=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const content='\ufeff'+[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function parseCsv(source:string){
  const text=source.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0];const separator=first.includes(';')&&!first.includes(',')?';':',';
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===separator&&!quoted){row.push(cell.trim());cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';}else cell+=c;}
  if(quoted)throw new Error('Tanda kutip CSV belum ditutup.');row.push(cell.trim());if(row.some(Boolean))rows.push(row);
  if(rows.length<2)throw new Error('File harus memiliki header dan minimal satu baris data.');
  const headers=rows.shift()!.map(x=>x.toLowerCase());
  if(new Set(headers).size!==headers.length)throw new Error('Nama kolom CSV tidak boleh berulang.');
  for(const h of ['nip','year','entitlement'])if(!headers.includes(h))throw new Error(`Kolom ${h} tidak ditemukan. Gunakan template CSV.`);
  if(rows.length>100)throw new Error('Maksimal 100 baris per impor.');
  return rows.map((values,i)=>{if(values.length!==headers.length)throw new Error(`Baris ${i+2}: jumlah kolom tidak sesuai.`);const get=(h:string)=>values[headers.indexOf(h)]||'';if(!get('year')||!get('entitlement'))throw new Error(`Baris ${i+2}: year dan entitlement wajib diisi, termasuk angka 0 bila tidak ada hak cuti.`);return {nip:get('nip'),year:Number(get('year')),entitlement:Number(get('entitlement')),adjustment:Number(get('adjustment')||0)};});
}
