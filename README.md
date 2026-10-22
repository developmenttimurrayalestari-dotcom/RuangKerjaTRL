# RuangKerja — HR & Purchasing

Aplikasi web responsif dan PWA berbahasa Indonesia untuk pengajuan cuti, persetujuan atasan, administrasi karyawan, saldo cuti, pencatatan sakit/alpa, serta permintaan pembelian ke Unit Purchasing.

**Versi 1.1.0** menambahkan tiga level akun **Administrator, Manager, dan Staff**, serta **2 divisi dengan 15 unit kerja**. Administrator mengelola akun melalui menu **Akun & akses**, memilih divisi dan unit kerja, lalu menetapkan atasan untuk persetujuan. Pengajuan dan setiap keputusan tetap diperiksa oleh server.

## Level akun

| Level | Hak utama |
|---|---|
| **Administrator** (`admin`) | Seluruh fitur: akun, karyawan, saldo/impor, sakit/alpa, kalender, laporan, pengaturan, pengajuan atas nama karyawan, dan persetujuan pengajuan orang lain |
| **Manager** (`manager`) | Mengajukan cuti/pembelian sendiri, memantau tim, serta menyetujui pengajuan yang menunjuknya sebagai atasan |
| **Staff** (`employee`) | Mengajukan cuti/pembelian sendiri, melihat saldo dan status pengajuan, serta membaca kalender kerja |

Review pembelian, pemesanan, dan penerimaan ditangani **Administrator atau Manager di Unit Purchasing**. Staff di Unit Purchasing tetap memiliki hak Staff. Setiap pemohon, termasuk Administrator dan Manager, memerlukan orang lain untuk menyetujui pengajuannya. Atasan pada pengajuan yang sudah dibuat mengikuti penugasan yang tersimpan dalam pengajuan tersebut.

## Divisi dan unit kerja

| Divisi | Unit kerja |
|---|---|
| **Divisi Produksi** — 5 unit | Surfacing; Warehouse LAB; Coating; Quality Control; Delivery |
| **Divisi Back Office** — 10 unit | Admin Sales; Marketing; Sales; Customer Service; Accounting dan Tax; HR & General Affair; IT; Account Receiveable & Finance; Purchasing; Warehouse Goods |

Pilihan divisi dan unit berasal dari master database. Form karyawan menampilkan unit sesuai divisi yang dipilih. Data lama yang belum dapat dipetakan ditampilkan sebagai **Belum dipetakan**, sehingga Administrator dapat memilih unit yang benar sesuai penempatan karyawan sebenarnya.

### Catatan rilis sebelumnya

**Versi 1.0.1** memperbaiki HTTP 500 saat database pertama kali diisi (`D1_ERROR: too many terms in compound SELECT`). Query bootstrap memakai `VALUES`; perbaikan tersebut tetap dipertahankan pada 1.1.0. Rincian penyebab dan pengujian rilis sebelumnya ada di [docs/PERBAIKAN-1.0.1.md](docs/PERBAIKAN-1.0.1.md).

## Mulai dari sini

- Catatan perubahan 1.1.0: [docs/PERUBAHAN-1.1.0.md](docs/PERUBAHAN-1.1.0.md)
- Hasil dan batas pengujian: [docs/VALIDASI.md](docs/VALIDASI.md)
- Panduan pengguna: [docs/PANDUAN.md](docs/PANDUAN.md)
- Instalasi dan penerapan: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Rancangan database dan migrasi: [docs/DATABASE.md](docs/DATABASE.md)
- Skenario penerimaan: [docs/UAT.md](docs/UAT.md)
- Pemetaan seluruh tabel lama: [database/legacy-mapping.md](database/legacy-mapping.md)

## Implementasi

React + TypeScript pada Vinext, server Cloudflare Workers, database D1/SQLite dan migrasi Drizzle. Aplikasi hosted memakai Sign in with ChatGPT dan otorisasi per tindakan pada server. PWA menyediakan pemasangan ke layar utama; data dan pengajuan memerlukan koneksi internet.

Database yang dilampirkan pengguna adalah dump **struktur MySQL 5.7 berisi 28 tabel, tanpa data**. Aplikasi tidak membaca database produksi lama secara langsung. Bootstrap menyediakan pemilik workspace dan delapan karyawan/transaksi fiktif yang diberi penanda contoh.

Rancangan MySQL 8.0.16+ ada pada `database/mysql8-schema.sql`. Ini merupakan target pendamping untuk migrasi/on-premise, **bukan driver MySQL yang otomatis dipakai oleh aplikasi D1**. Adapter runtime dan autentikasi on-premise masih perlu dibuat apabila memilih hosting MySQL sendiri. Skrip migrasi lama menggunakan staging dan peninjauan Administrator, tanpa menyalin password atau mengarang status approval historis.

## Fitur

- Akun & akses: tiga level, pencarian serta filter level/divisi/unit/status, atasan aktif, status akun, dan ekspor daftar akun. Email karyawan didaftarkan sebelum masuk melalui ChatGPT; formulir akun tidak membuat password atau mengirim undangan email. Identitas yang sudah tertaut tetap dipertahankan.
- Karyawan: tambah, baca/cari/filter, ubah, dan nonaktifkan sambil mempertahankan histori; NIP/email unik, divisi/unit kerja, atasan Manager/Administrator, level akun, dan jadwal 5/6 hari kerja.
- Cuti tahunan/izin khusus: perhitungan tanggal di server, rincian hari tersimpan, persetujuan atasan, penolakan dan pembatalan; tanpa persetujuan atas pengajuan sendiri.
- Saldo per tahun: hak + koreksi − terpakai − ditahan, dukungan rentang lintas tahun, ledger atomik dan perlindungan pengajuan bersamaan.
- Impor saldo CSV: pratinjau, validasi semua baris, maksimal 100 baris per batch, pencegahan duplikasi dan koreksi nilai tanpa menimpa transaksi pemakaian.
- Sakit/alpa: CRUD Administrator terpisah dari saldo cuti.
- Pembelian: 1–30 rincian barang, total integer rupiah dihitung server, atasan → review Manager Unit Purchasing/Administrator → disetujui → dipesan → diterima, riwayat keputusan.
- Kalender resmi Indonesia 2026/2027; libur nasional tidak dipotong, cuti bersama dapat diatur. Tahun tanpa kalender terverifikasi diblokir. Pemutakhiran memakai seed terverifikasi dan pengelolaan Administrator; sumber kalender tidak diambil dari API pemerintah secara langsung.
- Laporan CSV, cetak detail/laporan, pencarian dan catatan aktivitas.

## Menjalankan pertama kali di komputer lokal

Ekstrak ZIP, lalu buka terminal di folder `RuangKerja` yang berisi `package.json`. Gunakan Node.js **>=22.13.0**. Source yang baru diekstrak tanpa `.sites-runtime` memakai profil portable. Perintah berikut dapat dijalankan pada terminal Windows, macOS atau Linux.

```sh
node --version
npm run install:ci
npm run build
```

Setelah build berhasil, **buat schema database lokal sekali** dengan kedua migrasi secara berurutan, kemudian jalankan mode pengembangan:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_productive_shatterstar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_account_levels_organization.sql
npm run dev
```

Buka alamat loopback yang ditampilkan. Pada profil portable, `/signin-with-chatgpt?return_to=/` memakai simulasi identitas pengembangan lokal; simulasi tidak masuk ke build produksi. `npm start` menjalankan build Worker lokal dengan D1, tetapi tidak mensimulasikan sign-in. Lihat panduan deployment untuk akses hosted dan perbedaan profil.

Untuk penggunaan berikutnya, cukup `npm run dev`; data lokal disimpan di `.wrangler/state`. Database baru menggunakan **0000 lalu 0001**. Kedua migrasi dijalankan sekali per database.

### Memperbarui database lokal 1.0.1 ke 1.1.0

Hentikan proses aplikasi lama, buat backup sesuai [panduan deployment](docs/DEPLOYMENT.md), dan pasang/build source 1.1.0. Database yang sudah memiliki schema 1.0.0/1.0.1 hanya memerlukan **0001**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_account_levels_organization.sql
npm run dev
```

Jangan mengulang 0000 pada database yang sudah berisi tabel aplikasi. Perbaikan 1.0.1 dahulu tidak mengubah schema; peningkatan 1.1.0 menambahkan master divisi/unit dan relasi karyawan melalui migrasi 0001. Simpan database yang sama agar transaksi dan saldo tetap tersedia.

Migrasi menggabungkan role lama `hr` dan `purchasing` menjadi Manager serta mempertahankan kewenangan approver lama melalui pemetaan yang tercantum dalam [rancangan database](docs/DATABASE.md). Administrasi pada versi baru hanya untuk Administrator. Setelah peningkatan, tinjau **Akun & akses**, terutama level akun, atasan, dan akun bertanda **Belum dipetakan**. Pemilik workspace juga perlu memilih divisi/unit apabila belum memiliki penempatan. Riwayat pengajuan dan identitas ChatGPT yang sudah tertaut dipertahankan.

### Jika belum dapat berjalan

| Gejala | Tindakan |
|---|---|
| `node` / `npm` tidak dikenali, atau versi Node terlalu lama | Pasang Node sesuai persyaratan, buka terminal baru, ulangi `node --version`. |
| `Cannot find module` atau perintah framework tidak ditemukan | Jalankan `npm run install:ci` dari folder yang berisi `package.json`. |
| `dist/server/wrangler.json` tidak ditemukan | Jalankan `npm run build` sampai berhasil. |
| `no such table: organization` | Database masih kosong; jalankan 0000 lalu 0001 setelah build. |
| `no such table: divisions` / `work_units` atau `no such column: work_unit_id` | Database versi lama belum ditingkatkan; jalankan 0001 pada database yang sama. |
| `table ... already exists` saat migrasi awal | Schema awal sudah ada. Periksa migrasi yang telah diterapkan; database 1.0.1 cukup menjalankan 0001. Pertahankan data yang ada. |
| `/signin-with-chatgpt` tidak tersedia setelah `npm start` | Untuk menjalankan aplikasi lokal beserta login pengembangan, gunakan `npm run dev`. |
| HTTP 500 dengan `too many terms in compound SELECT` | Gunakan source 1.1.0 yang memuat perbaikan 1.0.1, build ulang, dan mulai ulang proses yang memakai source lama. |

### Mengulang pengujian

```sh
npm run typecheck
npm test
npm run test:d1
```

`npm test` menjalankan logika domain, parser UI, dan handler API melalui fixture SQLite. **`npm run test:d1` menjalankan handler dan transaksi yang sama pada D1 sebenarnya di Miniflare/workerd**, dengan database sementara yang terpisah dari data aplikasi. Runtime ini membutuhkan izin proses lokal dan loopback. Keduanya tidak menggantikan uji fisik browser/ponsel atau eksekusi pada MySQL. Detail hasil rilis dicatat pada `docs/VALIDASI.md`.

## Struktur source

| Folder | Isi |
|---|---|
| `app/components` | UI akun/organisasi, kontrol akses layar, formulir, kalender, tabel, laporan, dan detail approval |
| `app/api/workspace` | Handler GET/POST beridentitas, validasi request |
| `lib/domain.ts` | Aturan tanggal, saldo, peran dan transisi status |
| `lib/server` | Penyimpanan D1, bootstrap, otorisasi dan transaksi |
| `lib/data` | Master 2 divisi/15 unit, kalender SKB pemerintah, dan metadata sumber |
| `db`, `drizzle` | Schema asli aplikasi dan migrasi terkontrol |
| `database` | DDL MySQL, preflight dan migrasi master legacy |
| `tests` | Pengujian domain, handler dan integritas transaksi |
| `public` | Manifest PWA, ikon, service worker dan halaman offline |
| `docs` | Panduan, arsitektur, migrasi dan penerimaan |

## Sumber kalender

- [Sekretariat Negara — kalender 2026](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026)
- [Sekretariat Negara — kalender 2027](https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027)

Terverifikasi 19 Oktober 2026. Perubahan resmi berikutnya harus direkonsiliasi oleh Administrator. Perhitungan historis tidak berubah diam-diam akibat perubahan kalender atau kebijakan.
