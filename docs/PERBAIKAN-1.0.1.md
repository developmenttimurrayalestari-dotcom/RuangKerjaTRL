# Perbaikan aplikasi tidak dapat berjalan — versi 1.0.1

Tanggal pemeriksaan: **19 Oktober 2026**. Aplikasi: **RuangKerja — HR & Purchasing**.

## Penyebab yang terkonfirmasi

Endpoint `GET /api/workspace` gagal dengan HTTP 500 saat aplikasi mencoba mengisi database kosong. Contoh log produksi yang diperiksa:

- Waktu: **19 Oktober 2026, 16:49:03 WIB** (`2026-10-19T09:49:03.901Z`).
- Route: `GET /api/workspace`.
- HTTP status: `500`.
- Request ID: `798656aaba96c1989dfb565d31d1498f`.
- Pesan server: `workspace request failed D1_ERROR: too many terms in compound SELECT: SQLITE_ERROR`.

Log yang relevan disalin tanpa cookie, header autentikasi, alamat IP atau data identitas. Pemeriksaan database menunjukkan tabel aplikasi telah dibuat tetapi tabel `organization` masih kosong. Transaksi pengisian data awal gagal sehingga seluruh halaman yang bergantung pada endpoint workspace tidak mendapat data.

`seedInsert()` pada `lib/server/bootstrap.ts` menyusun banyak baris dengan rangkaian `SELECT ... UNION ALL SELECT ...`. Jumlah parameter sudah dibatasi, tetapi jumlah SELECT gabungan belum disesuaikan dengan batas runtime D1. SQLite Node pada tes pertama menerima query tersebut. D1/workerd menolaknya.

## Reproduksi dan perbaikan

Sebelum diperbaiki, menjalankan `resolveViewer()` pada D1/workerd dengan schema aplikasi yang baru dimigrasikan menghasilkan error yang sama dengan log produksi. Setelah query diubah, bootstrap dan seluruh skenario integrasi berhasil.

Perubahan query menggunakan pola berikut:

```sql
WITH seed (kolom_1, kolom_2) AS (
  VALUES (?, ?), (?, ?)
)
INSERT INTO tabel_tujuan (kolom_1, kolom_2)
SELECT kolom_1, kolom_2
FROM seed
WHERE EXISTS (
  SELECT 1 FROM organization
  WHERE id = 'main' AND bootstrap_token = ? AND initialized = 0
);
```

Nama kolom/tabel pada contoh bersifat ilustratif; implementasi memakai daftar internal yang tetap. Query tetap menggunakan parameter terikat, batching kecil, dan guard token dalam transaksi. Perubahan ini **tidak memerlukan perubahan schema, menghapus data atau mengulang migrasi**.

Referensi teknis: [batas D1](https://developers.cloudflare.com/d1/platform/limits/), [source runtime SQLite workerd](https://github.com/cloudflare/workerd/blob/main/src/workerd/util/sqlite.c%2B%2B), dan [perilaku VALUES SQLite](https://www.sqlite.org/lang_select.html#the_values_clause). Kejadian pada aplikasi ini dibuktikan lewat log serta reproduksi runtime, bukan disimpulkan hanya dari dokumentasi.

## Pengamanan inisialisasi

Saat pemeriksaan, pengaturan Site mengizinkan anggota workspace dan database belum terisi. Variabel server opsional `WORKSPACE_BOOTSTRAP_EMAIL` ditambahkan agar admin pertama dapat dibatasi ke email pemilik yang ditetapkan melalui konfigurasi tepercaya.

Email pertama yang tidak cocok mendapat HTTP 403 dengan kode `BOOTSTRAP_OWNER_REQUIRED`; tidak ada data awal yang ditulis. Email yang cocok diproses tanpa membedakan huruf besar/kecil. Pemeriksaan hanya berlaku saat inisialisasi; akses karyawan yang sudah terdaftar tetap mengikuti identitas dan peran dalam database. Petunjuk konfigurasi ada pada `DEPLOYMENT.md`.

## Hasil pengujian

| Pengujian | Hasil |
|---|---|
| Reproduksi bootstrap lama pada D1/workerd | Gagal dengan error produksi yang sama, sesuai tujuan reproduksi |
| TypeScript | Lulus |
| Domain kalender, saldo, izin dan harga | 13/13 lulus |
| Handler dan transaksi pada SQLite Node | 21/21 lulus |
| Parser CSV/tanggal UI | 8/8 lulus |
| Handler dan transaksi pada D1/workerd | 21/21 lulus |
| Build Worker, route halaman dan API | Lulus |

Tiga tes startup ditambahkan: GET pertama pada database kosong, dua login pertama bersamaan, dan pembatasan email admin pertama. Alur cuti mencakup perhitungan tanggal merah, reservasi, approval, penolakan, pembatalan, saldo lintas tahun, impor dan transaksi bersamaan. Alur Purchasing mencakup approval atasan, approval Purchasing, pemesanan dan penerimaan barang.

Tes D1 memakai database sementara terpisah dari aplikasi live. Handler memakai transport identitas terkontrol dalam pengujian. Login SIWC pada browser live dan pengujian perangkat fisik tetap memerlukan UAT; hasil tes database tidak dianggap sebagai pengujian browser.

## Menjalankan source yang diperbaiki

Ikuti urutan perintah pada `README.md`. Pada komputer lokal, gunakan Node >=22.13.0, pasang dependency, lakukan build, jalankan migrasi D1 awal hanya jika schema belum ada, lalu jalankan **`npm run dev`**. Untuk instalasi yang schema-nya sudah dibuat, versi 1.0.1 tidak membutuhkan migrasi tambahan.

`npm start` menjalankan Worker hasil build langsung dan tidak menambahkan simulasi login pengembangan. Ini berbeda dari `npm run dev`, yang menyediakan alur login lokal pada alamat loopback. Jangan mengimpor DDL MySQL ke D1; berkas MySQL tetap merupakan rancangan pendamping, bukan adapter runtime aplikasi ini.
