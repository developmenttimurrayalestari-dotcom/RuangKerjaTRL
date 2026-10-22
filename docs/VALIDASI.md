# Hasil validasi rilis 1.1.0

Tanggal: 20 Oktober 2026. Data dan identitas dalam tes bersifat fiktif. Database pengujian terpisah dari database Site.

## Hasil akhir

| Pemeriksaan | Hasil | Cakupan |
|---|---|---|
| TypeScript `npm run typecheck` | Lulus | Model data, server, formulir, dan UI |
| Tes domain | 15/15 lulus | Kalender/tanggal, saldo, harga, impor, hierarki dan tiga level akun |
| Tes integrasi API, SQLite | 30/30 lulus | Handler/service, bootstrap, otorisasi, transaksi, konkurensi dan penautan identitas |
| Tes frontend | 16/16 lulus | Delapan parser CSV/tanggal serta delapan pemeriksaan menu, tautan halaman dan tindakan approval |
| Tes migration organisasi, SQLite | 3/3 lulus | Database baru, upgrade 1.0.1 terisi, preservasi data dan perlindungan akun nyata yang menyerupai demo |
| Tes integrasi API, D1/workerd | 30/30 lulus | Skenario handler yang sama pada implementasi Cloudflare D1 sebenarnya melalui Miniflare |
| Tes migration organisasi, D1/workerd | 3/3 lulus | Migration yang sama pada D1, termasuk foreign key dan trigger tiga role |
| Build Worker/React/Vinext | Lulus | Halaman dinamis dan route API berhasil dikompilasi; migration 0001 ikut dalam artefak build |
| Konsistensi Drizzle | Lulus | `db:generate` tidak menemukan perubahan schema setelah snapshot 0001 dibuat |
| Pemeriksaan source | Lulus | `git diff --check`; lint komponen dan file backend/database yang diperiksa tanpa error |
| MySQL pendamping | Ditinjau statis | Schema 17 tabel, upgrade 1.1.0, staging unit/role/atasan; belum dieksekusi pada server MySQL |

**`npm test`: 64 lulus, 0 gagal. `npm run test:d1`: 33 lulus, 0 gagal.** Tes D1 mengulang 30 skenario handler dan tiga skenario migration pada engine berbeda; angka tersebut tidak berarti 97 skenario bisnis yang berbeda.

Perintah `test:d1` menjalankan kedua suite dalam proses terpisah agar hook fixture integrasi dan direktori migration sementara tidak memengaruhi suite lain. Tidak ada data atau konfigurasi produksi yang diubah oleh tes.

## Bukti perilaku level akun dan organisasi

Pengujian memeriksa bahwa hanya Administrator dapat mengelola akun/karyawan, saldo/impor, sakit-alpa, kalender dan pengaturan. Manager dapat mengajukan sendiri serta mengambil keputusan sesuai approver yang tersimpan. Staff ditolak meskipun relasi lama menunjuknya sebagai atasan atau payload/flag UI dimanipulasi. Manager baru tidak mewarisi tombol keputusan atas pengajuan yang masih ditugaskan kepada atasan lama.

Tahap Purchasing memerlukan Administrator atau Manager dalam unit `PURCHASING` yang aktif pada divisi aktif. Staff Purchasing tidak mempunyai antrean atau hak pemrosesan tambahan. Request yang ditolak sebelum approval atasan tidak bocor ke antrean Purchasing. Guard transaksi menolak pemrosesan menggunakan snapshot hak lama setelah actor pindah unit atau unit Purchasing dinonaktifkan. Approval/pemrosesan permintaan sendiri ditolak pada seluruh level.

Tes penyimpanan akun memeriksa kecocokan divisi-unit, penolakan unit tidak dikenal dan role historis, serta atasan aktif dengan level yang sah. Nonaktif/penurunan level atasan ditolak selama masih mempunyai bawahan aktif atau penugasan approval atasan pending.

Migration diuji pada database awal dan database 1.0.1 yang sengaja diisi dengan identitas, saldo, request, ledger, keputusan dan audit. Seluruh tabel transaksi dibandingkan sebelum/sesudah. Daftar eksplisit 2 divisi dan 15 unit, foreign key, nilai aktif, keunikan serta trigger INSERT/UPDATE role diperiksa. Akun nyata dengan ID mirip demo tidak mendapat unit hasil dugaan.

## Perbaikan tambahan yang direproduksi

Review menemukan kondisi bersamaan pada login pertama: setelah pencarian kandidat berdasarkan email, Administrator dapat mengganti email kandidat sebelum identitas ditautkan. UPDATE lama tidak memeriksa ulang email, sehingga identitas email lama dapat tertaut ke akun yang telah diedit.

UPDATE kini memeriksa ulang email yang dinormalisasi, ID, status aktif dan subject yang masih kosong dalam batch penautan. Regresi memaksa perubahan email tepat di antara pencarian dan batch. Hasilnya: login email lama ditolak, subject tetap kosong, tidak ada audit penautan sukses palsu, dan identitas email baru dapat masuk sesudahnya. Skenario ini lulus pada SQLite dan D1.

Frontend juga memperbaiki invalidasi pratinjau cuti: hasil perhitungan input lama tidak lagi dipakai setelah pemohon/tanggal berubah. Pemeriksaan tipe dan komponen memastikan bentuk state/API baru dapat dikompilasi.

## Regresi lama yang tetap lulus

Tes tetap mencakup libur nasional, akhir pekan, Sabtu kerja, cuti bersama, rentang lintas tahun, tahun belum terverifikasi, izin khusus tanpa debit, dan larangan tanggal tidak valid. Saldo dan ledger direkonsiliasi setelah reservasi, approval, penolakan serta refund. Dua pengajuan bersamaan tidak dapat memakai saldo yang sama; keputusan ganda hanya memberi satu perubahan efektif.

Impor CSV tetap atomik, menjaga used/reserved, dan mendukung koreksi F1 → F2 → F1. Catatan sakit/alpa tidak mengurangi cuti tahunan. Request lintas origin, pengguna anonim, upaya pendaftaran sendiri sebagai Administrator, dan perubahan hak tanpa izin ditolak.

Bootstrap awal dan dua login pertama bersamaan tetap lulus. Perbaikan **1.0.1** terhadap `D1_ERROR: too many terms in compound SELECT` dipertahankan: seed memakai CTE `VALUES`, batas parameter, guard inisialisasi dan batch atomik. [PERBAIKAN-1.0.1.md](PERBAIKAN-1.0.1.md) mempertahankan catatan penyebab HTTP 500 dan koreksi terhadap validasi SQLite-only pada 1.0.0.

## Browser dan batas verifikasi

Pratinjau managed berhasil dijalankan. Percobaan browser pertama mengalami timeout infrastruktur; setelah layanan dapat diakses kembali, pembukaan halaman mengarah ke `/signin-with-chatgpt`, yang memberikan 404 karena endpoint login dimiliki dispatch hosted dan tidak tersedia pada pratinjau ini. **UI setelah login belum diuji secara langsung di browser.** Tidak ada perubahan autentikasi aplikasi untuk melewati batas pratinjau tersebut.

- Tes API memakai identitas dan transport `next/headers` uji terkontrol. HTTP 200 pada D1 bukan bukti login hosted melalui browser.
- Instalasi/login PWA di Android dan iPhone fisik belum dijalankan. Pemeriksaan aset/cache rilis sebelumnya tetap terdokumentasi dalam UAT; tidak dianggap sebagai pengujian perangkat baru.
- MySQL tidak dijalankan. Schema dan script upgrade MySQL membutuhkan uji engine target sebelum digunakan secara operasional.
- Lampiran `gamstrlv2.sql` hanya berisi schema; tidak ada migrasi data karyawan asli dari lampiran tersebut.
- `UAT.md` memisahkan tes otomatis dari penerimaan bisnis dengan akun/perangkat nyata. Status yang belum dijalankan tidak berubah hanya karena tes otomatis lulus.

## Mengulang pemeriksaan

Gunakan Node.js yang memenuhi `engines` pada package; runtime pengujian rilis ini Node 24.19.0. Dari root source dengan dependency terpasang:

```sh
npm run typecheck
npm test
npm run test:d1
npm run build
```

Miniflare/workerd memerlukan proses lokal dan komunikasi loopback. Fixture menjalankan SQL dalam `drizzle/` pada database sementara. Database aplikasi lokal yang digunakan untuk membuka UI harus dipersiapkan terpisah sesuai `DEPLOYMENT.md`: fresh menggunakan 0000 lalu 0001; database 1.0.1 hanya menambahkan 0001.
