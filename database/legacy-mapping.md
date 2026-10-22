# Pemetaan database lama → aplikasi baru

## Fakta dari lampiran

`gamstrlv2.sql` berisi struktur MySQL 5.7.24: **28 tabel, 0 INSERT, 0 foreign key**. Tidak ada data personal, akun, saldo, atau transaksi aktual dalam lampiran. Semua tabel memakai `latin1`; `viewpribadi` adalah tabel MyISAM fisik, sedangkan tabel lainnya InnoDB. Ada 10 tabel tanpa primary key.

Aplikasi yang disediakan menggunakan **Cloudflare D1 (SQLite) melalui Drizzle**. [`mysql8-schema.sql`](mysql8-schema.sql) adalah rancangan target MySQL 8.0 untuk jalur on-premise, dan [`migrate-master-data.sql`](migrate-master-data.sql) dijalankan pada **MySQL**, bukan pada D1. Mengimpor file SQL MySQL tidak otomatis menyambungkan aplikasi hosted ke server MySQL.

Database lama **tidak diubah atau dihapus**. Migrasi ditujukan ke `gamstrlv2_next`; nama ini dapat diganti konsisten pada kedua script oleh DBA.

## Aturan migrasi inti

- **NIP tetap teks.** Angka nol awal dipertahankan; nilai unik tidak boleh dihasilkan dari urutan baris.
- Nama, email, departemen, unit, jabatan, dan telepon berasal dari kolom sumber yang benar; tidak diisi dengan orang/email fiktif.
- Unit target dipilih dari master 2 divisi/15 unit melalui `target_work_unit_id`; label asli `department` dan `unit_source` tetap tersimpan di staging. Divisi diturunkan melalui relasi unit.
- Atasan tidak tersedia di `tpegawai`. HR harus mengisi pemetaan NIP atasan; tidak menebak dari `Jabatan`, `Level`, urutan pegawai, atau departemen.
- Akun tidak dibuat dari `tlogin.Password`; role tidak otomatis dipercaya dari `tlogin.Level`. Migrasi master tidak memberikan izin login atau approval.
- Saldo awal tidak tersedia. HR harus menyuplai saldo per tahun dan memeriksa posisi pengajuan yang masih berjalan. Tidak menganggap semua orang otomatis memiliki saldo tertentu.
- Histori `tcuti` tidak mempunyai status persetujuan atau jumlah hari terhitung. Data tersebut hanya masuk staging sampai HR merekonsiliasi status, saldo, dan aturan kalender historis.
- `tpegawaiabsen` adalah rekap periode, bukan kejadian harian. Jangan membuat tanggal sakit/alpa dari bilangan rekap.
- Migrasi template menyisipkan karyawan yang sudah lolos peninjauan, dan menggunakan NIP/ID target deterministik agar pengulangan tidak menduplikasi. Master target yang sudah ada tidak ditimpa diam-diam.
- Source mengandung data pribadi pada database nyata. Hak SELECT source dan akses staging dibatasi kepada DBA/HR; jangan memasukkan export data aktual ke repository.

## Pemetaan master karyawan

| Kolom sumber | Makna / tindakan |
|---|---|
| `tpegawai.NIP` | Kunci bisnis teks; trim spasi pinggir setelah memeriksa benturan. |
| `tpegawai.Nama` | Nama lengkap; wajib ada sebelum commit. |
| `tpegawai.Email` | Email bila valid; tidak boleh mengarang domain/alamat. Duplikasi dan alamat kosong memerlukan peninjauan. |
| `tpegawai.Departemen` | Label asli disimpan di staging; reviewer memilih unit master yang sesuai. Karyawan baru memakai nama unit terpilih sebagai label departemen. |
| `tpegawai.unit` | Label unit asli disimpan sebagai `unit_source`; reviewer mengisi `target_work_unit_id`, tanpa menebak dari nama yang ambigu. |
| `tpegawai.Jabatan` | Label jabatan; bukan sumber wewenang approval otomatis. |
| `tpegawai.Telp` | Telepon sebagai teks; pertahankan nol awal. |
| `tpegawai.TglMasuk` / `TglKeluar` | Tanggal kerja; tanggal nol/tidak valid ditandai untuk rekonsiliasi. |
| `tpegawai.StatusKerja` | Status sumber untuk ditinjau HR; aktif/tidak aktif target ditetapkan eksplisit. |
| Tidak tersedia | NIP atasan, role login, ID unit master baru, jadwal kerja, saldo awal dan hak cuti per tahun. |
| Kolom profil pribadi lain | Tetap di sumber; tidak disalin dalam migrasi inti bila aplikasi tidak memerlukannya. |

## Seluruh 28 tabel: ruang lingkup migrasi

| Tabel | Fungsi | Penanganan |
|---|---|---|
| `tabsen` | Absensi/check-in lama | Pertahankan sumber; PK hanya NIP, tidak cukup sebagai histori harian lengkap. |
| `tbarang` | Master/inventaris barang | Pertahankan sumber; kandidat katalog pada perluasan berikutnya. Jangan menganggapnya purchase request. |
| `tbukutelp` | Buku telepon | Pertahankan sebagai modul legacy, di luar scope inti. |
| `tcuti` | Riwayat cuti | Salin ke staging histori saja; keputusan, saldo, dan hari kerja belum diketahui. |
| `tdepartemen` | Master departemen | Bahan rekonsiliasi label lama terhadap master `divisions`/`work_units`; tidak menentukan divisi secara otomatis. |
| `tjabatan` | Master jabatan | Normalisasi label; tidak menebak struktur level/otorisasi. |
| `tklaimobat` | Klaim kesehatan | Pertahankan sumber; nominal float memerlukan kebijakan pembulatan saat dimigrasikan. |
| `tkontrak` | Kontrak karyawan | Pertahankan sumber; perlu migrasi histori kontrak tersendiri. |
| `tkontrakhistori` | Riwayat kontrak | Pertahankan sumber; periksa NoKontrak bentrok sebelum digabung. |
| `tlogin` | Akun lama | Tidak dimigrasikan otomatis. Format Password tidak diketahui; buat/undang/reset akun baru. |
| `tpegawai` | Master karyawan | Staging → validasi HR → employees. NIP sebagai teks dan unik; atasan dipetakan eksplisit. |
| `tpegawaiabsen` | Rekap absensi per periode | Staging rekap apa adanya; tidak direka menjadi tanggal sakit/alpa. |
| `tpegawaianak` | Data anak | Pertahankan legacy, di luar scope inti; batasi akses. |
| `tpegawaikontakdarurat` | Kontak darurat | Pertahankan legacy, di luar scope inti; batasi akses. |
| `tpegawaipendidikan` | Pendidikan | Pertahankan legacy; periode berupa teks perlu validasi saat migrasi. |
| `tpegawaipengalaman` | Pengalaman | Pertahankan legacy; periode berupa teks perlu validasi saat migrasi. |
| `tpegawaiprestasi` | Prestasi | Pertahankan legacy, di luar scope inti. |
| `tpegawairiwayat` | Riwayat tambahan | Pertahankan legacy, di luar scope inti. |
| `tperiode` | Master tahun/periode | Pertahankan legacy; kalender/saldo baru memakai tahun eksplisit. |
| `tpeserta_external` | Peserta training eksternal | Pertahankan legacy, di luar scope inti. |
| `tstatushadir` | Kode status hadir | Validasi kamus Abs_A/Abs_S/Abs_I/Abs_T; jangan memetakan otomatis tanpa HR. |
| `ttraining` | Master training | Pertahankan legacy, di luar scope inti. |
| `ttrainingmentor` | Master mentor | Pertahankan legacy, di luar scope inti. |
| `ttraining_detail` | Kegiatan training | Pertahankan legacy, di luar scope inti. |
| `ttraining_peserta` | Peserta training | Pertahankan legacy, di luar scope inti. |
| `ttraining_tempat` | Lokasi training | Pertahankan legacy, di luar scope inti. |
| `tunit` | Master unit | Bahan pemetaan `target_work_unit_id` terhadap 15 unit yang ditetapkan; setiap padanan ditinjau. |
| `viewpribadi` | Tabel gabungan profil | Pada dump ini tabel MyISAM fisik, bukan VIEW. Pertahankan; jangan digabung otomatis karena duplikasi dan atribut berbeda. |


## Perubahan master dan akun versi 1.1.0

Schema target kini memiliki 17 tabel inti. `divisions` menyimpan dua divisi, `work_units` menyimpan 15 unit dengan foreign key divisi, dan `employees.work_unit_id` mereferensikan unit. Tidak ada kolom divisi tambahan di karyawan yang dapat berbeda dari divisi unitnya. Lihat [panduan database 1.1.0](README.md) untuk daftar lengkap dan urutan upgrade.

Role target hanya `admin` (Administrator), `manager` (Manager), dan `employee` (Staff). Reviewer staging wajib memilih salah satu nilai ini; role `hr`/`purchasing` tidak diterima untuk impor baru. Semua NIP atasan yang dirujuk harus mengarah ke karyawan aktif dengan level Administrator atau Manager. Manager unit dengan kode `PURCHASING` menjalankan tahap Unit Purchasing; Staff unit Purchasing tetap mempunyai hak Staff.

Untuk database target baru, gunakan `mysql8-schema.sql` versi 1.1.0. Untuk target 1.0.1 yang sudah ada, gunakan [mysql8-upgrade-1.1.0.sql](mysql8-upgrade-1.1.0.sql) sebelum memperbarui prosedur impor. Upgrade tersebut menambah `target_work_unit_id` pada staging yang sudah ada; tidak mengganti koreksi atau snapshot sumber. Reviewer harus mengisi unit yang masih kosong sebelum data baru dapat menjadi calon impor.

Upgrade aplikasi D1 berbeda dari migrasi sumber `gamstrlv2`: file `drizzle/0001_account_levels_organization.sql` memperbarui instalasi aplikasi 1.0.1 yang sudah berjalan. Akun legacy `hr` dan `purchasing` menjadi Manager pada unit yang sesuai; akun Staff yang sudah ditetapkan sebagai atasan karyawan aktif atau approver permintaan pending dinaikkan menjadi Manager agar penugasan yang ada tetap berfungsi. Penugasan, status aktif, autentikasi, transaksi, saldo, ledger, dan histori tidak dihapus. Label departemen yang ambigu tetap belum dipetakan dan perlu ditinjau Administrator.

## Inventaris seluruh kolom sumber

Nama kolom berikut disalin dari DDL lampiran. Kolom bertipe sensitif hanya dicantumkan namanya; tidak ada nilainya dalam dokumen ini.


### `tabsen`

Primary key: `NIP`. Engine: InnoDB.

`NIP`, `Nama`, `Jabatan`, `UnitKerja`, `TglMasuk`, `JamMasuk`, `JamPulang`, `Status`, `Keterangan`.

### `tbarang`

Primary key: `KdBarang`. Engine: InnoDB.

`KdBarang`, `NamaBarang`, `JenisBarang`, `Satuan`, `Jumlah`, `Harga`, `TglBeli`, `Foto`.

### `tbukutelp`

Primary key: `idrec`. Engine: InnoDB.

`idrec`, `nama`, `alamat`, `telp`, `hp`, `ext`, `email`, `ket`.

### `tcuti`

Primary key: `idcuti`. Engine: InnoDB.

`idcuti`, `NIP`, `Nama`, `departemen`, `unit`, `TglCuti`, `tglselesai`, `pengganti`, `keterangan`.

### `tdepartemen`

Primary key: tidak ada. Engine: InnoDB.

`Departemen`.

### `tjabatan`

Primary key: tidak ada. Engine: InnoDB.

`Jabatan`.

### `tklaimobat`

Primary key: `NoKlaim`. Engine: InnoDB.

`NoKlaim`, `Nip`, `Nama`, `TglKlaim`, `NominalKlaim`, `Persentase`, `NominalBayar`, `userInput`, `Keterangan`.

### `tkontrak`

Primary key: `NoKontrak`. Engine: InnoDB.

`NoKontrak`, `nip`, `nama`, `masa_kontrak`, `tglkontrak`, `tglselesai`, `keterangan`.

### `tkontrakhistori`

Primary key: `NoKontrak`. Engine: InnoDB.

`NoKontrak`, `nip`, `nama`, `masa_kontrak`, `tglkontrak`, `tglselesai`, `keterangan`.

### `tlogin`

Primary key: `Username`, `idrec`. Engine: InnoDB.

`idrec`, `Username`, `Password`, `Level`, `Catatan`.

### `tpegawai`

Primary key: `NIP`. Engine: InnoDB.

`NIP`, `Nama`, `TempatLahir`, `TglLahir`, `JenisKelamin`, `Agama`, `WargaNegara`, `GolDarah`, `Alamat`, `NoID`, `JenisID`, `AlamatKTP`, `Telp`, `Email`, `NoBPJS`, `NoNPWP`, `Jabatan`, `Departemen`, `unit`, `StatusKerja`, `TglMasuk`, `TglKeluar`, `KetKerja`, `NamaAyah`, `NamaIbu`, `StatusNikah`, `NamaPasangan`, `JumlahAnak`, `Catatan`.

### `tpegawaiabsen`

Primary key: tidak ada. Engine: InnoDB.

`NIP`, `NamaPegawai`, `Departemen`, `unit`, `periode`, `Abs_A`, `Abs_S`, `Abs_I`, `Abs_T`, `SP1_Ket`, `SP1_TglM`, `SP1_TglA`, `SP2_Ket`, `SP2_TglM`, `SP2_TglA`, `SP3_Ket`, `SP3_TglM`, `SP3_TglA`, `Ket`.

### `tpegawaianak`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `Nama`, `JenisKelamin`, `TglLahir`.

### `tpegawaikontakdarurat`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `NamaKontak`, `Hubungan`, `Alamat`, `Telp`.

### `tpegawaipendidikan`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `Tingkat`, `Tempat`, `Mulai`, `Selesai`, `Catatan`.

### `tpegawaipengalaman`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `Lokasi`, `Jabatan`, `Mulai`, `Selesai`, `Catatan`.

### `tpegawaiprestasi`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `PO`, `Jenis`, `Penyelenggara`, `Lokasi`, `Mulai`, `Bersertifikat`.

### `tpegawairiwayat`

Primary key: `idRec`. Engine: InnoDB.

`idRec`, `NIP`, `Riwayat`, `Status`.

### `tperiode`

Primary key: tidak ada. Engine: InnoDB.

`tahun`.

### `tpeserta_external`

Primary key: `nopeserta`. Engine: InnoDB.

`nopeserta`, `nama`, `asal`.

### `tstatushadir`

Primary key: `KodeKehadiran`. Engine: InnoDB.

`KodeKehadiran`, `Keterangan`, `Catatan`.

### `ttraining`

Primary key: tidak ada. Engine: InnoDB.

`namatraining`.

### `ttrainingmentor`

Primary key: tidak ada. Engine: InnoDB.

`namamentor`.

### `ttraining_detail`

Primary key: `idtraining`. Engine: InnoDB.

`idtraining`, `namatraining`, `materi`, `namamentor`, `unit`, `tgltraining`, `biaya`, `tempattraining`, `sertifikat`, `keterangan`.

### `ttraining_peserta`

Primary key: tidak ada. Engine: InnoDB.

`idtraining`, `nip`, `nama`, `statuspeserta`.

### `ttraining_tempat`

Primary key: tidak ada. Engine: InnoDB.

`namatempat`.

### `tunit`

Primary key: tidak ada. Engine: InnoDB.

`unit`.

### `viewpribadi`

Primary key: tidak ada. Engine: MyISAM.

`NIP`, `Nama`, `TempatLahir`, `TglLahir`, `JenisKelamin`, `Agama`, `WargaNegara`, `GolDarah`, `Alamat`, `NoID`, `JenisID`, `AlamatKTP`, `Telp`, `Email`, `NoBPJS`, `NoNPWP`, `Jabatan`, `Departemen`, `StatusKerja`, `TglMasuk`, `TglKeluar`, `GaPok`, `Tunjangan`, `KetKerja`, `NamaAyah`, `NamaIbu`, `StatusNikah`, `NamaPasangan`, `Catatan`, `JKel Anak`, `NamaKontak`, `Hubungan`, `Tingkat`, `Tempat`, `Lokasi`, `JPengalaman`, `PO`, `Jenis`, `Riwayat`, `Status`, `Tgl Lahir Anak`, `Catatan Anak`, `Alamat Kontak`, `Telp Kontak`, `Catatan Kontak`, `Mulai Pendidikan`, `Selesai Pendidikan`, `Catatan Pendidikan`, `Mulai Pengalaman`, `Selesai Pengalaman`, `Catatan Pengalaman`, `Penyelenggara`, `Lokasi Prestasi`, `Mulai Prestasi`, `Selesai Prestasi`, `Bersertifikat`, `Catatan Prestasi`, `Catatan Riwayat`, `Nama Anak`.


## Data historis dan cut-over

Sebelum cut-over, HR menandatangani rekap jumlah karyawan aktif, mapping atasan, saldo per tahun, pengajuan yang masih menunggu, dan tanggal cutoff. Transaksi yang sudah ditransfer harus diberi referensi unik sehingga proses retry tidak membuat debit atau approval kedua. Jalur script master tidak mengaktifkan proses debit historis tersebut.

Jalankan [`legacy-preflight.sql`](legacy-preflight.sql) dengan akun hanya-baca terlebih dahulu. Simpan hasil rekonsiliasi di lokasi internal yang dilindungi; jangan menyimpan password, hash, token, atau data pribadi dalam log publik.
