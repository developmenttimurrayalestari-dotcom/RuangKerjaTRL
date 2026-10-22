# Database Ruang Kerja 1.1.0

Runtime aplikasi hosted memakai Cloudflare D1/SQLite dengan kontrak Drizzle di `db/schema.ts`. File MySQL di direktori ini adalah rancangan dan jalur migrasi pendamping untuk target MySQL 8.0.16+; aplikasi hosted tetap memakai D1. Rancangan terbaru memiliki **17 tabel inti**.

## Struktur organisasi dan level akun

`divisions` menyimpan master divisi. `work_units.division_id` wajib mereferensikan divisi; `employees.work_unit_id` mereferensikan unit. Nama divisi karyawan selalu berasal dari relasi tersebut. Kode unit stabil dipakai dalam otorisasi, sedangkan nama ditampilkan pada antarmuka.

| Divisi | Kode unit | Nama unit |
|---|---|---|
| Divisi Produksi | `SURFACING` | Surfacing |
| Divisi Produksi | `WAREHOUSE_LAB` | Warehouse LAB |
| Divisi Produksi | `COATING` | Coating |
| Divisi Produksi | `QUALITY_CONTROL` | Quality Control |
| Divisi Produksi | `DELIVERY` | Delivery |
| Divisi Back Office | `ADMIN_SALES` | Admin Sales |
| Divisi Back Office | `MARKETING` | Marketing |
| Divisi Back Office | `SALES` | Sales |
| Divisi Back Office | `CUSTOMER_SERVICE` | Customer Service |
| Divisi Back Office | `ACCOUNTING_TAX` | Accounting dan Tax |
| Divisi Back Office | `HR_GENERAL_AFFAIR` | HR & General Affair |
| Divisi Back Office | `IT` | IT |
| Divisi Back Office | `AR_FINANCE` | Account Receiveable & Finance |
| Divisi Back Office | `PURCHASING` | Purchasing |
| Divisi Back Office | `WAREHOUSE_GOODS` | Warehouse Goods |

Registry yang sama tersedia di `lib/data/organization-units.json`. ID master bersifat stabil; tidak dibuat ulang pada bootstrap login. Master divisi dan unit mempunyai indeks unik serta CHECK `active IN (0,1)`; relasi divisi dan unit dilindungi foreign key. Aplikasi mensyaratkan unit dan divisinya aktif ketika menyimpan karyawan.

| Nilai database/API | Label akun | Hak utama |
|---|---|---|
| `admin` | Administrator | Semua modul dan administrasi |
| `manager` | Manager | Pengajuan sendiri dan approval yang menjadi tanggung jawabnya |
| `employee` | Staff | Pengajuan sendiri |

Tahap Unit Purchasing memerlukan Administrator atau Manager pada unit berkode `PURCHASING`. Penempatan Staff di unit tersebut tidak menambah hak approval. Menentukan atasan tetap terpisah dari divisi/unit; kesamaan unit tidak otomatis membuat seseorang menjadi approver.

## Upgrade D1 dari 1.0.1

Jalankan migration melalui mekanisme migrasi aplikasi, berurutan: `0000_productive_shatterstar.sql`, lalu **`0001_account_levels_organization.sql`**. Pada database 1.0.1 yang sudah termigrasi, hanya `0001` yang perlu diterapkan. Jangan menjalankan ulang `0000`, menghapus tabel, atau mereset database untuk mendapatkan master baru.

Migration `0001` menambah dua tabel, menambah kolom nullable `employees.work_unit_id` beserta foreign key dan indeksnya, lalu menyisipkan 2 divisi dan 15 unit. Kolom dapat tetap `NULL` agar akun lama dengan departemen tidak dikenal bisa dipertahankan. Administrator memetakannya melalui form karyawan; penyimpanan baru oleh aplikasi mensyaratkan unit yang valid.

Pemetaan berlangsung dengan aturan berikut:

1. Role lama `hr` dipetakan ke unit HR & General Affair; `purchasing` ke unit Purchasing. Kedua role menjadi `manager`.
2. Departemen dengan nama master yang sama dipetakan tanpa membedakan kapital dan spasi di tepi. Alias terbatas `People & Culture`, `Teknologi`, dan `Account Receivable & Finance` masing-masing dipetakan ke HR & General Affair, IT, dan Account Receiveable & Finance.
3. Nama ambigu seperti `Manajemen`, `Operasional`, `Gudang`, atau `Finance` pada akun nyata tetap belum dipetakan. Delapan ID bootstrap `demo-*` yang dikenal boleh mendapat padanan khusus hanya bila emailnya juga memakai domain fiktif `example.invalid`.
4. Akun `employee` yang sudah menjadi atasan karyawan aktif, approver cuti `pending`, atau approver pembelian `pending_manager`/`pending_purchasing` menjadi `manager`. Akun yang hanya muncul dalam keputusan historis tidak dinaikkan. Status aktif tidak diubah.

Nilai `department` lama tetap tersimpan saat upgrade. ID, NIP, email, `auth_subject`, relasi atasan/approver, tanggal, semua saldo, ledger, pengajuan, keputusan, import, dan audit tetap dipertahankan. Saat Administrator menyimpan pemetaan baru, aplikasi memakai nama unit terpilih untuk label departemen terkini; label pada transaksi historis tidak ditulis ulang.

CHECK `employees_role` dari migration awal sengaja tetap memuat daftar role historis. Dua trigger, `employees_role_insert` dan `employees_role_update`, menolak seluruh penulisan role di luar `admin`, `manager`, dan `employee`. Gabungan ini menegakkan kontrak tiga level tanpa membangun ulang tabel karyawan yang direferensikan oleh banyak tabel. Snapshot Drizzle mempertahankan CHECK historis tersebut; jangan menggantinya tanpa migrasi yang meninjau seluruh foreign key. Pengujian migrasi memverifikasi penolakan role legacy pada INSERT dan UPDATE.

## Target MySQL

- **Database baru:** jalankan [mysql8-schema.sql](mysql8-schema.sql) pada target `gamstrlv2_next`. Master divisi/unit disediakan dan CHECK role sejak awal hanya mengizinkan tiga nilai saat ini.
- **Target aplikasi 1.0.1 yang sudah terisi:** gunakan [mysql8-upgrade-1.1.0.sql](mysql8-upgrade-1.1.0.sql) satu kali. DDL MySQL melakukan commit otomatis; uji dahulu pada salinan hasil backup dan hentikan penulisan selama upgrade. Jika berhenti sebagian, periksa schema dan selesaikan tahap yang belum terpasang sebelum membuka aplikasi; jangan menggunakan `--force` atau menjalankan ulang tanpa pemeriksaan.
- **Sumber legacy `gamstrlv2`:** jalankan [legacy-preflight.sql](legacy-preflight.sql), lalu alur staging pada [migrate-master-data.sql](migrate-master-data.sql). Reviewer memilih `target_work_unit_id`, salah satu dari tiga role, dan atasan aktif dengan level yang sesuai. [legacy-mapping.md](legacy-mapping.md) menjelaskan kolom dan batasan historinya.

Upgrade MySQL memperbarui CHECK role secara langsung tanpa menghapus tabel karyawan. Bila staging impor lama sudah ada, upgrade menambahkan kolom target unit; snapshot dan keputusan review tetap disimpan. File schema dengan `IF NOT EXISTS` tidak menggantikan script upgrade.

## Verifikasi

`tests/organization-migration.test.mjs` memeriksa database baru dan database 1.0.1 yang sudah diisi fixture. Pengujian mencakup seluruh daftar master, keunikan dan foreign key, CHECK aktif, trigger tiga role, promosi approver yang masih bertugas, perlindungan akun nyata dengan ID mirip demo, serta perbandingan setiap tabel transaksi sebelum dan sesudah upgrade. Fixture dapat dijalankan pada SQLite Node dan D1/workerd melalui `TEST_D1_RUNTIME=workerd`.

Rancangan serta script MySQL ditinjau secara statis. Tidak ada eksekusi terhadap server MySQL dalam verifikasi rilis ini; uji pada target MySQL tetap diperlukan sebelum jalur MySQL digunakan.
