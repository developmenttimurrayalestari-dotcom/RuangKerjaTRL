# RuangKerja 1.1.0 — Level akun dan unit kerja

20 Oktober 2026

Rilis ini menambahkan pengelolaan akun dengan tiga level dan struktur organisasi yang diminta, sekaligus mempertahankan perbaikan startup D1 pada 1.0.1. Panduan penggunaan lengkap ada di [PANDUAN.md](PANDUAN.md), panduan instalasi/upgrade di [DEPLOYMENT.md](DEPLOYMENT.md), dan bukti serta batas pengujian di [VALIDASI.md](VALIDASI.md).

## Hak akses

| Fitur | Administrator | Manager | Staff |
|---|---|---|---|
| Cuti tahunan, izin khusus dan pembelian | Mengajukan sendiri atau atas nama karyawan | Mengajukan sendiri | Mengajukan sendiri |
| Approval cuti dan pembelian tahap atasan | Pengajuan orang lain | Pengajuan yang ditugaskan kepadanya | Tidak |
| Review Purchasing, pemesanan dan penerimaan | Ya, kecuali permintaan sendiri | Hanya Manager pada unit Purchasing aktif | Tidak |
| Data karyawan dan level akun | Kelola | Tidak | Tidak |
| Saldo/impor, sakit-alpa, kalender dan pengaturan | Kelola | Tidak | Tidak |
| Melihat pengajuan | Seluruh data | Data pribadi, bawahan langsung dan penugasan approval; tambahan antrean bagi Manager Purchasing | Data pribadi |

Level disimpan sebagai `admin`, `manager`, dan `employee`. UI menampilkan **Administrator**, **Manager**, dan **Staff**. Divisi/unit kerja merupakan penempatan organisasi; level akun menentukan kewenangan. Staff yang ditempatkan di Purchasing tetap tidak dapat menyetujui, memesan atau menerima pembelian.

Administrator dan Manager tidak boleh menyetujui permintaan sendiri. Atasan dipilih dari Manager/Administrator aktif. Pengajuan menyimpan ID approver saat dibuat; pergantian atasan tidak memindahkan approval lama secara diam-diam. Sebelum atasan dinonaktifkan atau diturunkan menjadi Staff, bawahan aktif harus dialihkan dan pengajuan pending yang ditugaskan kepadanya harus diselesaikan.

## Pengelolaan akun

Menu **Akun & akses** menyediakan ringkasan ketiga level, tabel akun, pencarian nama/NIP/email, filter level/divisi/unit/status, ekspor CSV, edit dan penonaktifan. Menu **Data karyawan** memakai data yang sama sehingga penempatan unit dan hak akun tetap konsisten.

Saat menambah atau mengedit karyawan, Administrator memilih Divisi terlebih dahulu, lalu Unit kerja. Mengganti divisi mengosongkan pilihan unit sebelumnya. Server juga memeriksa kecocokan divisi dan unit, sehingga payload yang dimanipulasi tidak dapat menyimpan hubungan yang salah.

Email harus sesuai akun ChatGPT yang digunakan untuk masuk. Penambahan karyawan mempersiapkan hak aplikasi; proses ini tidak mengirim undangan atau membuat password. Akses situs tetap mengikuti pengaturan berbagi yang sudah berlaku. Setelah login pertama berhasil, identitas akun tertaut ke subject autentikasi yang stabil.

## Struktur organisasi

| Divisi | Unit kerja |
|---|---|
| Divisi Produksi | Surfacing; Warehouse LAB; Coating; Quality Control; Delivery |
| Divisi Back Office | Admin Sales; Marketing; Sales; Customer Service; Accounting dan Tax; HR & General Affair; IT; Account Receiveable & Finance; Purchasing; Warehouse Goods |

Daftar ini berisi **2 divisi dan 15 unit kerja**. Ejaan unit mengikuti permintaan pengguna. Registry terdapat pada `lib/data/organization-units.json`; data operasional disimpan dalam master database, bukan hanya pilihan statis di form.

## Database dan upgrade

Schema D1 kini mempunyai 17 tabel. Migration tambahan `drizzle/0001_account_levels_organization.sql` menambah `divisions`, `work_units`, dan foreign key nullable `employees.work_unit_id`. Divisi karyawan diturunkan dari unitnya. Tabel dan migration awal tidak dibangun ulang.

Pada instalasi baru, jalankan `0000` lalu `0001`. Pada instalasi 1.0.1 yang sudah mempunyai schema, terapkan hanya `0001`. Jangan mereset database atau menjalankan ulang migration awal. Perintah lokal lengkap tercantum di panduan deployment.

Upgrade mempertahankan ID karyawan, identitas login, hubungan atasan, status aktif, saldo, ledger, pengajuan dan histori. Role lama HR/Purchasing dipetakan menjadi Manager pada unit yang sesuai. Akun Staff lama yang memang sudah bertugas sebagai atasan/approver aktif dipetakan menjadi Manager agar tugas approval yang sudah ada tetap dapat diselesaikan. Data departemen nyata yang ambigu tidak diberi unit hasil dugaan; Administrator melengkapi akun berlabel **Belum dipetakan**.

Rancangan MySQL terbaru tersedia di `database/mysql8-schema.sql`, bersama `database/mysql8-upgrade-1.1.0.sql` untuk target 1.0.1. Aplikasi yang berjalan memakai D1; rancangan MySQL belum menggantikan adapter runtime dan belum diuji pada server MySQL.

## Perbaikan terkait

- Menu, tautan halaman dan tombol persetujuan mengikuti level akun serta permission yang diberikan server.
- API memvalidasi role, penugasan approver dan unit Purchasing; tidak bergantung pada tombol yang terlihat.
- Guard transaksi memeriksa ulang role/unit akun. Permintaan yang memakai informasi lama ditolak apabila hak Purchasing sudah dicabut melalui perpindahan unit atau penonaktifan master unit/divisi.
- Penautan identitas saat login pertama memeriksa ulang email di dalam batch, sehingga perubahan email bersamaan tidak memberikan akun kepada identitas lama.
- Pratinjau hitungan cuti tidak lagi menampilkan hasil lama setelah tanggal atau pemohon diganti.
- Validasi tipe state dialog/form dan pengelolaan fokus modal diperbaiki.

Perhitungan tanggal merah tetap berlaku: libur nasional dan hari di luar jadwal kerja tidak memotong saldo cuti. Cuti bersama mengikuti kebijakan perusahaan. Kalender yang belum terverifikasi tetap memblokir perhitungan final. Rilis ini tidak mengubah snapshot tanggal pada pengajuan lama.

## Verifikasi dan penggunaan awal

Pengujian menggunakan database sementara dan identitas fiktif. Cakupan mencakup tiga level, manipulasi role/divisi/unit, larangan approval sendiri, Staff dengan relasi approver lama, Manager Purchasing, perpindahan unit bersamaan, migrasi database terisi, serta regresi perhitungan saldo/kalender dan startup. Angka hasil akhir tersedia di `VALIDASI.md`.

Sebelum memakai data operasional, buka **Akun & akses** sebagai Administrator, periksa pemetaan unit dan atasan, lalu uji satu Staff, satu Manager, dan satu Manager Purchasing dengan akun masing-masing. Skenario UAT dan batas pemeriksaan perangkat tercatat pada `UAT.md`.
