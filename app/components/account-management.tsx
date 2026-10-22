'use client';

import {useState} from 'react';
import {Building2,Check,ChevronDown,Download,Pencil,Search,ShieldCheck,Trash2,UserRound,Users,X} from 'lucide-react';
import type {Employee,Role,WorkspaceState} from './types';
import {Avatar,Empty,Panel} from './primitives';
import {downloadCsv,matches,roleLabel} from './utils';

type DirectoryProps={
  data:WorkspaceState;
  mode:'accounts'|'employees';
  query:string;
  onQueryChange:(value:string)=>void;
  onEdit:(employee:Employee)=>void;
  onDeactivate:(employee:Employee)=>void;
};

const levels:{role:Role;icon:typeof ShieldCheck;description:string;features:string[]}[]=[
  {role:'admin',icon:ShieldCheck,description:'Seluruh fitur perusahaan',features:['Data karyawan, akun & pengaturan','Pengajuan dan persetujuan','Administrasi cuti & pembelian']},
  {role:'manager',icon:Users,description:'Pengajuan dan persetujuan tim',features:['Pengajuan cuti & pembelian sendiri','Persetujuan yang ditugaskan','Pantau pengajuan tim']},
  {role:'employee',icon:UserRound,description:'Kebutuhan kerja pribadi',features:['Pengajuan cuti & pembelian sendiri','Pantau saldo dan status pengajuan','Lihat kalender kerja Indonesia']},
];

export function EmployeeDirectory({data,mode,query,onQueryChange,onEdit,onDeactivate}:DirectoryProps){
  const [role,setRole]=useState('all');
  const [divisionId,setDivision]=useState('all');
  const [unitId,setUnit]=useState('all');
  const [status,setStatus]=useState('all');
  const accountMode=mode==='accounts';
  const divisions=data.divisions.filter(division=>division.active).sort((a,b)=>a.sortOrder-b.sortOrder);
  const units=data.workUnits.filter(unit=>unit.active&&(divisionId==='all'||unit.divisionId===divisionId)).sort((a,b)=>a.sortOrder-b.sortOrder);
  const managerName=(employee:Employee)=>data.employees.find(person=>person.id===employee.managerId)?.name||'Belum ditetapkan';
  const rows=data.employees.filter(employee=>
    (role==='all'||employee.role===role)&&
    (divisionId==='all'||(divisionId==='unmapped'?!employee.workUnitId:employee.divisionId===divisionId))&&
    (unitId==='all'||employee.workUnitId===unitId)&&
    (status==='all'||employee.active===(status==='active'))&&
    matches(query,employee.name,employee.nip,employee.email,employee.workUnitName,employee.divisionName,employee.department,employee.position,roleLabel[employee.role],managerName(employee))
  );
  const hasFilters=role!=='all'||divisionId!=='all'||unitId!=='all'||status!=='all'||!!query;
  const unmapped=data.employees.filter(employee=>!employee.workUnitId).length;
  function clearFilters(){setRole('all');setDivision('all');setUnit('all');setStatus('all');onQueryChange('');}
  function exportDirectory(){
    downloadCsv(accountMode?'akun-dan-akses.csv':'data-karyawan.csv',
      ['nip','nama','email','divisi','unit_kerja','jabatan','atasan','level_akun','jadwal','aktif'],
      rows.map(employee=>[employee.nip,employee.name,employee.email,employee.divisionName||'Belum dipetakan',employee.workUnitName||'Belum dipetakan',employee.position,managerName(employee),roleLabel[employee.role],employee.workdays,employee.active?'Ya':'Tidak']));
  }
  if(!data.permissions.manageAdministration)return null;
  return <div className="directory-page">
    {accountMode&&<section className="account-levels" aria-label="Tiga level akun">
      {levels.map(level=>{
        const total=data.employees.filter(employee=>employee.role===level.role).length;
        const active=data.employees.filter(employee=>employee.role===level.role&&employee.active).length;
        return <button key={level.role} className={`account-level-card level-${level.role} ${role===level.role?'selected':''}`} aria-pressed={role===level.role} onClick={()=>setRole(role===level.role?'all':level.role)}>
          <span className="account-level-top"><span className="account-level-icon"><level.icon size={20}/></span><span className="account-level-count">{active}<small>aktif / {total} akun</small></span></span>
          <strong>{roleLabel[level.role]}</strong><p>{level.description}</p>
          <ul>{level.features.map(feature=><li key={feature}><Check size={13}/><span>{feature}</span></li>)}</ul>
        </button>;
      })}
    </section>}
    <Panel title={accountMode?'Daftar akun':'Direktori karyawan'} subtitle={accountMode?'Kelola level akses, unit kerja, dan atasan setiap akun.':'Identitas dan struktur kerja tersimpan bersama akses aplikasi.'} className="employee-directory">
      <div className="directory-search-row">
        <label className="directory-search"><Search size={17}/><input aria-label={accountMode?'Cari akun':'Cari karyawan'} placeholder="Cari nama, NIP, email, atau unit kerja…" value={query} onChange={event=>onQueryChange(event.target.value)}/>{query&&<button type="button" aria-label="Hapus pencarian" onClick={()=>onQueryChange('')}><X size={15}/></button>}</label>
        <button className="button secondary small" onClick={exportDirectory} disabled={!rows.length}><Download size={15}/>Ekspor</button>
      </div>
      <div className="directory-filters">
        <label><span>Level akun</span><select value={role} onChange={event=>setRole(event.target.value)}><option value="all">Semua level</option>{levels.map(level=><option key={level.role} value={level.role}>{roleLabel[level.role]}</option>)}</select></label>
        <label><span>Divisi</span><select value={divisionId} onChange={event=>{setDivision(event.target.value);setUnit('all');}}><option value="all">Semua divisi</option>{divisions.map(division=><option key={division.id} value={division.id}>{division.name}</option>)}{unmapped>0&&<option value="unmapped">Belum dipetakan ({unmapped})</option>}</select></label>
        <label><span>Unit kerja</span><select value={unitId} disabled={divisionId==='unmapped'} onChange={event=>setUnit(event.target.value)}><option value="all">Semua unit kerja</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
        <label><span>Status</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></label>
        {hasFilters&&<button className="text-button directory-reset" onClick={clearFilters}><X size={13}/>Reset filter</button>}
      </div>
      {rows.length?<div className="table-scroll"><table className="directory-table"><thead><tr><th>{accountMode?'Akun':'Karyawan'}</th><th>Divisi & unit kerja</th>{!accountMode&&<th>Jabatan</th>}<th>Level akun</th><th>Atasan persetujuan</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
        {rows.map(employee=><tr key={employee.id}>
          <td><div className="person-cell"><Avatar name={employee.name}/><div><strong>{employee.name}{employee.id===data.viewer.id&&<span className="current-account">Anda</span>}</strong><small className={accountMode?'':'mono'}>{accountMode?employee.email:employee.nip}</small>{accountMode&&<small className="mono">{employee.nip}</small>}</div></div></td>
          <td><div className="cell-stack organization-cell"><strong className={!employee.workUnitId?'unmapped-label':undefined}>{employee.workUnitName||'Belum dipetakan'}</strong><small>{employee.divisionName||(employee.department?`Data lama: ${employee.department}`:'Pilih divisi dan unit kerja')}</small></div></td>
          {!accountMode&&<td>{employee.position}</td>}
          <td><span className={`role-tag role-${employee.role}`}>{roleLabel[employee.role]}</span>{employee.role==='manager'&&employee.workUnitCode==='PURCHASING'&&<small className="purchasing-scope">Review Purchasing</small>}</td>
          <td><span className={!employee.managerId?'muted':''}>{managerName(employee)}</span></td>
          <td><span className={`badge badge-${employee.active?'approved':'cancelled'}`}><i/>{employee.active?'Aktif':'Nonaktif'}</span></td>
          <td><div className="table-buttons"><button className="icon-button" aria-label={`Edit ${accountMode?'akun':'karyawan'} ${employee.name}`} onClick={()=>onEdit(employee)}><Pencil size={16}/></button><button disabled={!employee.active||employee.id===data.viewer.id} className="icon-button danger" aria-label={`Nonaktifkan ${employee.name}`} onClick={()=>onDeactivate(employee)}><Trash2 size={16}/></button></div></td>
        </tr>)}
      </tbody></table></div>:<Empty title={accountMode?'Akun tidak ditemukan':'Karyawan tidak ditemukan'} description="Coba kata pencarian atau filter yang berbeda." action={<button className="button secondary small" onClick={clearFilters}>Reset filter</button>}/>}
      <div className="panel-foot"><span>Menampilkan {rows.length} dari {data.employees.length} {accountMode?'akun':'karyawan'}</span><span>{unmapped?`${unmapped} akun perlu pemetaan unit`:'Seluruh akun sudah terhubung ke unit kerja'}</span></div>
    </Panel>
    {accountMode&&<details className="access-reference">
      <summary><span><ShieldCheck size={18}/><strong>Rincian hak akses & persetujuan</strong></span><ChevronDown size={17}/></summary>
      <div className="table-scroll"><table><thead><tr><th>Fitur</th><th>Administrator</th><th>Manager</th><th>Staff</th></tr></thead><tbody>
        <tr><td>Pengajuan cuti & pembelian</td><td>Sendiri / atas nama karyawan</td><td>Sendiri</td><td>Sendiri</td></tr>
        <tr><td>Persetujuan pengajuan</td><td>Pengajuan orang lain</td><td>Sesuai penugasan atasan</td><td>—</td></tr>
        <tr><td>Review Purchasing & pemesanan</td><td>Ya</td><td>Khusus Unit Purchasing</td><td>—</td></tr>
        <tr><td>Data, akun, saldo, sakit / alpa, pengaturan</td><td>Kelola seluruhnya</td><td>—</td><td>—</td></tr>
      </tbody></table></div>
      <p className="access-reference-note">Atasan mengikuti penugasan pada setiap karyawan. Pengajuan pribadi Manager dan Administrator tetap disetujui orang lain. Level Staff di Unit Purchasing hanya memiliki akses pengajuan pribadi.</p>
    </details>}
    <Panel title="Divisi & unit kerja" subtitle={`${divisions.length} divisi dengan ${data.workUnits.filter(unit=>unit.active).length} unit kerja perusahaan.`} className="organization-directory">
      <div className="organization-groups">{divisions.map(division=><section key={division.id} className="organization-group"><div className="organization-group-title"><Building2 size={19}/><h3>{division.name}</h3><span>{data.employees.filter(employee=>employee.active&&employee.divisionId===division.id).length} aktif</span></div><div className="organization-units">{data.workUnits.filter(unit=>unit.active&&unit.divisionId===division.id).sort((a,b)=>a.sortOrder-b.sortOrder).map(unit=><button key={unit.id} className={unitId===unit.id?'selected':''} onClick={()=>{setDivision(division.id);setUnit(unit.id);}} aria-label={`Filter unit ${unit.name}`}><span>{unit.name}</span><small>{data.employees.filter(employee=>employee.active&&employee.workUnitId===unit.id).length}</small></button>)}</div></section>)}</div>
    </Panel>
  </div>;
}
