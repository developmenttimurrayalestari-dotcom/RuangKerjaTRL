# Skenario penerimaan RuangKerja

Versi 1.1.0 · 20 Oktober 2026

Dokumen ini menyediakan kriteria penerimaan untuk HR, atasan, Purchasing dan administrator. Status **Belum dijalankan** berarti skenario memerlukan eksekusi dan pencatatan bukti pada environment uji; daftar ini bukan pernyataan bahwa seluruh UAT sudah lulus. Hasil pengujian teknis yang benar-benar dijalankan harus dicatat terpisah dengan perintah, tanggal dan bukti.

## Data uji

Siapkan instance uji privat. Gunakan karyawan fiktif A dan B dengan level Staff, atasan M dengan level Manager, petugas HR H dengan level Administrator, petugas P dengan level Manager di unit Purchasing, dan administrator Z dengan akun yang berbeda. A berada di bawah M dan B di bawah atasan lain. A bekerja Senin–Jumat; B Senin–Sabtu. Berikan hak 12 hari per tahun dengan used/reserved awal nol. Aktifkan kalender lengkap 2026 dan 2027 serta kebijakan cuti bersama `exclude`.

Semua angka hasil di bawah mengasumsikan tidak ada pengajuan lain yang memakai tanggal atau saldo yang sama. Kembalikan kondisi awal melalui tindakan aplikasi yang sah atau instance uji baru antar skenario.

Tanggal Juni 2026 sudah lampau pada saat dokumen dibuat. Gunakan Administrator untuk mencatat skenario lampau atas nama karyawan, atau uji rincian melalui preview hitungan; akun karyawan biasa memang dilarang mengirim pengajuan lampau. Tetapkan tanggal bergabung data uji sebelum semua tanggal yang diuji.

## 1. Kalender dan saldo

| ID | Skenario / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| K01 | Administrator mencatat 15–17 Juni 2026 atas nama A, atau periksa melalui preview | 2 hari; 16 Juni libur nasional tidak terpotong | Belum dijalankan |
| K02 | A mengajukan 24–28 Desember 2026, `exclude` | 1 hari, hanya 28 Desember | Belum dijalankan |
| K03 | Ulangi K02 pada data bersih dengan `deduct` | 2 hari, 24 dan 28 Desember; Natal tetap nol | Belum dijalankan |
| K04 | B mengajukan 24–28 Desember 2026, `exclude` | 2 hari: Sabtu 26 dan Senin 28; jadwal enam hari dihormati | Belum dijalankan |
| K05 | A mengajukan 31 Desember 2026–4 Januari 2027 | 2 hari: satu dialokasikan ke 2026 dan satu ke 2027 | Belum dijalankan |
| K06 | Ajukan 2028 tanpa kalender terverifikasi | Finalisasi ditolak dengan alasan cakupan kalender; tidak ada reservasi saldo | Belum dijalankan |
| K07 | Ajukan tanggal yang seluruhnya libur/akhir pekan | Ditolak sebagai nol hari; tidak ada ledger pemotongan | Belum dijalankan |
| K08 | Ajukan dua permohonan aktif yang beririsan | Permohonan kedua ditolak; data/saldo permohonan pertama tetap konsisten | Belum dijalankan |
| K09 | Hak 12, adjustment 2, used 3, reserved 2 | Saldo tersedia 9 ditampilkan dan sama dengan hitungan server | Belum dijalankan |
| K10 | Ajukan 2 hari cuti tahunan dari saldo 12 | Pending: reserved 2, used 0, available 10 | Belum dijalankan |
| K11 | Atasan menyetujui K10 | Approved: reserved 0, used 2, available 10 | Belum dijalankan |
| K12 | Tolak atau batalkan pending 2 hari | Reserved kembali 0, used tidak berubah, available kembali 12 | Belum dijalankan |
| K13 | Administrator membatalkan cuti approved 2 hari dengan alasan | Used kembali 0; pengembalian serta actor/alasan tercatat; tindakan ulang tidak menggandakan refund | Belum dijalankan |
| K14 | Hak tersedia 1, kirim dua permohonan berbeda masing-masing 1 hari secara bersamaan | Maksimal satu berhasil; tidak ada saldo negatif atau reservasi ganda | Belum dijalankan |
| K15 | Submit cuti khusus yang sah | Status approval dan hari tercatat; saldo tahunan tidak dipotong | Belum dijalankan |
| K16 | Ubah kalender/kebijakan setelah sebuah permohonan dibuat | Rincian tanggal dan dasar kebijakan transaksi dapat ditelusuri; perubahan tidak diam-diam merusak ledger | Belum dijalankan |
| K17 | Karyawan biasa mencoba mengirim tanggal lampau | Ditolak; Administrator tetap dapat mencatat riwayat yang sah | Belum dijalankan |

Ekspektasi tanggal K01–K05 berasal dari [daftar resmi 2026](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026) dan [daftar resmi 2027](https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027), diperiksa 19 Oktober 2026. Jumlah terpotong dihitung menurut konfigurasi uji di atas.

## 2. Impor dan administrasi

| ID | Skenario / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| A01 | Tambah karyawan dengan NIP/email baru, lalu ubah jabatan dan jadwal | Tersimpan, dimuat ulang, tampil sesuai data; jadwal dipakai dalam preview cuti | Belum dijalankan |
| A02 | Tambah NIP/email duplikat atau atasan diri sendiri | Ditolak dengan pesan jelas dan tidak ada data parsial | Belum dijalankan |
| A03 | Nonaktifkan karyawan yang mempunyai riwayat | Akses/tindakan baru terhenti; riwayat tetap tersedia bagi pihak berwenang | Belum dijalankan |
| A04 | Pratinjau dan impor CSV valid ≤100 baris | Hak/adjustment sesuai file; used/reserved lama terpelihara | Belum dijalankan |
| A05 | CSV mempunyai NIP asing atau pasangan NIP/tahun ganda | Pratinjau menunjukkan kesalahan; commit seluruh file ditolak, termasuk baris valid lain | Belum dijalankan |
| A06 | Impor file identik dua kali | Impor kedua dikenali sebagai pengulangan; tidak menggandakan perubahan/ledger | Belum dijalankan |
| A07 | Impor hak yang lebih kecil dari used+reserved setelah adjustment | Ditolak; saldo aktif tetap valid | Belum dijalankan |
| A08 | CSV dengan tahun nonangka, pecahan hari, header salah atau >100 baris | Ditolak melalui validasi; tidak ada pembaruan sebagian | Belum dijalankan |
| A09 | Catat sakit lalu koreksi/hapus catatan melalui Administrator | Rekam kehadiran mengikuti tindakan; saldo cuti tahunan tetap | Belum dijalankan |
| A10 | Catat sakit dan alpa untuk karyawan/tanggal sama | Tidak ada dua rekam kehadiran yang saling bertentangan | Belum dijalankan |
| A11 | Ekspor CSV laporan lalu cocokkan dengan filter/tampilan | Kolom/nilai dan cakupan pengguna sesuai; bukan seluruh database tanpa batas peran | Belum dijalankan |
| A12 | Impor F1 dengan hak 12, F2 dengan hak 15, lalu F1 lagi | Hak kembali menjadi 12; koreksi sah menjadi batch baru, bukan no-op karena file pernah dipakai | Belum dijalankan |

## 3. Approval dan purchasing

| ID | Skenario / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| P01 | A mengirim 2 unit @150.000 dan 3 unit @25.000 | Total server 375.000; status menunggu atasan | Belum dijalankan |
| P02 | M menyetujui P01, lalu P menyetujui | Status berurutan pending_manager → pending_purchasing → approved; dua actor keputusan tercatat | Belum dijalankan |
| P03 | P memperbarui approved menjadi ordered kemudian received | Urutan tersimpan; status dapat dimuat ulang dari server | Belum dijalankan |
| P04 | Coba langsung received dari pending_manager | Ditolak; tahapan approval tidak terlewati | Belum dijalankan |
| P05 | Tolak permintaan tanpa alasan, lalu dengan alasan | Tanpa alasan ditolak; dengan alasan tersimpan dan terlihat pemohon | Belum dijalankan |
| P06 | A membatalkan saat pending_manager, lalu mencoba membatalkan setelah pending_purchasing | Pembatalan awal berhasil; pembatalan mandiri setelah tahap berubah ditolak | Belum dijalankan |
| P07 | Submit kuantitas 0/negatif, harga negatif, atau total klien yang dimanipulasi | Nilai tidak valid ditolak; total sah tetap dihitung ulang server | Belum dijalankan |
| P08 | Dua browser menyetujui permintaan yang sama hampir bersamaan | Hanya satu transisi efektif; riwayat/status tidak berlipat | Belum dijalankan |
| P09 | Manager/Manager Purchasing/Administrator mencoba approve permohonannya sendiri | Ditolak oleh server tanpa perubahan status | Belum dijalankan |

## 4. Akses dan persistensi

| ID | Skenario / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| S01 | Buka API tanpa sesi tepercaya | Data HR tidak dikembalikan; akses ditolak atau autentikasi diminta | Belum dijalankan |
| S02 | Karyawan A mencoba membaca/mengubah data B lewat ID API | Server menolak tindakan/cakupan di luar izin | Belum dijalankan |
| S03 | M mencoba approve bawahan atasan lain | Ditolak walaupun ID permintaan diketahui | Belum dijalankan |
| S04 | Karyawan biasa mengirim perubahan role, kalender atau saldo langsung ke API | Ditolak oleh server; UI tersembunyi bukan satu-satunya kontrol | Belum dijalankan |
| S05 | Masuk dengan akun yang belum didaftarkan | Tidak otomatis menjadi administrator/karyawan operasional | Belum dijalankan |
| S06 | Tambah data, tutup browser, buka kembali dan masuk | Data berasal dari database dan tetap ada; status/saldo sama | Belum dijalankan |
| S07 | Tindakan dari origin lain tanpa jalur autentikasi sah | Tidak dapat mengubah data; kontrol request server diuji | Belum dijalankan |
| S08 | Ubah saldo dan ambil keputusan approval | Audit menunjukkan actor, waktu dan jenis tindakan yang benar | Belum dijalankan |
| S09 | Instance baru dengan database kosong dan akses privat hanya untuk pemilik | Pemilik melakukan inisialisasi, memeriksa identitas admin, kemudian baru membuka akses pengguna yang sudah dipersiapkan; tidak ada bootstrap melalui akses publik | Belum dijalankan |

## 5. Level akun dan struktur organisasi

| ID | Skenario / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| R01 | Administrator membuka Akun & akses | Tiga level muncul: Administrator, Manager, Staff; tidak ada level HR/Purchasing terpisah | Belum dijalankan di browser |
| R02 | Pilih Divisi Produksi saat membuat akun | Unit hanya Surfacing, Warehouse LAB, Coating, Quality Control, Delivery | Belum dijalankan di browser |
| R03 | Ubah divisi ke Divisi Back Office | Pilihan unit lama direset; sepuluh unit Back Office tersedia, pilihan divisi/unit wajib sesuai | Belum dijalankan di browser |
| R04 | Simpan akun baru, filter menurut divisi/unit/level, lalu buka ulang | Identitas, unit, atasan dan level tersimpan serta filter/ekspor sesuai hasil | Belum dijalankan di browser |
| R05 | Masuk sebagai Staff; buka URL halaman akun, saldo administratif dan persetujuan | Halaman/tindakan administratif tidak tersedia; data API tetap sesuai cakupan pribadi | Belum dijalankan dengan akun nyata |
| R06 | Manager mengajukan cuti/pembelian sendiri dan menyetujui pengajuan yang ditugaskan | Pengajuan pribadi menuju atasan lain; approval sendiri dan bawahan manager lain ditolak | Belum dijalankan dengan akun nyata |
| R07 | Staff di Purchasing mencoba tahap review, pesan atau terima | Ditolak, termasuk request API langsung; akun tersebut tetap Staff | Belum dijalankan dengan akun nyata |
| R08 | Manager Purchasing memproses pengajuan setelah approval atasan | Review, pesan, terima sesuai urutan; request yang belum lolos atasan tidak masuk antrean Purchasing | Belum dijalankan dengan akun nyata |
| R09 | Nonaktifkan/turunkan level atasan yang mempunyai bawahan aktif atau approval pending | Ditolak dengan petunjuk pengalihan/penyelesaian tanggung jawab | Belum dijalankan di browser |
| R10 | Ubah atasan setelah request dibuat | Approval request lama tetap mengikuti approver yang tersimpan; tidak otomatis berpindah ke atasan baru | Belum dijalankan di browser |
| R11 | Uji upgrade dari database 1.0.1 yang berisi transaksi | Seluruh ID, relasi, saldo, ledger dan histori bertahan; data unit yang belum jelas berlabel Belum dipetakan | Lulus fixture SQLite dan D1; rekonsiliasi data operasional tetap diperlukan |
| R12 | Admin mengganti email akun belum tertaut bersamaan dengan login email lama | Identitas lama tidak memperoleh akun yang sudah dipindahkan ke email baru | Belum dijalankan dengan akun nyata |

Hasil otomatis untuk pembatasan API, tautan halaman dan migrasi dicatat pada `VALIDASI.md`; kolom UAT di atas memisahkan pemeriksaan browser/akun nyata dari tes terkontrol.

## 6. Web seluler dan PWA

| ID | Perangkat / tindakan | Hasil yang harus dibuktikan | Status |
|---|---|---|---|
| M01 | Android fisik, Chrome, pasang dari URL HTTPS | Nama/ikon RuangKerja, pembukaan standalone dan sign-in berfungsi | Belum dijalankan pada perangkat fisik |
| M02 | iPhone fisik, Safari, Tambahkan ke Layar Utama | Ikon, pembukaan web app, sign-in dan navigasi berfungsi | Belum dijalankan pada perangkat fisik |
| M03 | Lebar 360–390 px, buka semua form/modal | Kontrol dapat disentuh; teks dapat dibaca; form bisa discroll; tombol simpan dapat dicapai | Belum dijalankan pada perangkat fisik |
| M04 | Putuskan internet setelah Worker aktif lalu buka halaman baru | Halaman offline umum tampil; tidak menampilkan data karyawan dari cache | Belum dijalankan di browser |
| M05 | Saat offline kirim pengajuan lalu sambungkan lagi | Tidak ada pengiriman background; pengguna melihat kegagalan dan memeriksa status sebelum mencoba ulang | Belum dijalankan di browser |
| M06 | Periksa Cache Storage setelah memakai modul dan sign-in | Hanya offline.html dan ikon pada cache RuangKerja; tidak ada API, auth atau HTML pengguna | Belum dijalankan di browser |
| M07 | Sign-out A lalu sign-in B pada perangkat sama | B tidak memperoleh data A dari Worker/cache; cakupan API mengikuti B | Belum dijalankan di browser |
| M08 | Upgrade versi cache lalu buka ulang | Cache RuangKerja lama dibersihkan; cache aplikasi lain tidak dihapus | Belum dijalankan di browser |
| M09 | Chrome/Edge desktop, keyboard saja | Form, tab, modal dan tindakan utama dapat diakses; fokus terlihat | Belum dijalankan di browser |

## Catatan hasil teknis yang terpisah

Isi bagian ini hanya dengan pengujian yang benar-benar selesai. Pengecekan source/Node tidak menggantikan uji akun berbeda, perangkat fisik atau browser sebenarnya.

| Tanggal | Pemeriksaan | Bukti | Hasil |
|---|---|---|---|
| 2026-10-19 | Seed kalender | 51 tanggal ISO unik: 17+8 untuk 2026, 18+8 untuk 2027; sumber dan kategori tersedia | Lulus pemeriksaan data |
| 2026-10-19 | Ikon PWA | Rasterisasi SVG lokal menghasilkan PNG 192×192 dan 512×512; ikon 192 diperiksa visual | Lulus pemeriksaan aset |
| 2026-10-19 | Manifest dan sintaks Worker | JSON/ukuran seluruh ikon divalidasi; `node --check public/sw.js` berhasil | Lulus pemeriksaan statis |
| 2026-10-20 | Level akun dan organisasi | Tes domain, handler SQLite/D1, migrasi 1.0.1 dan helper akses UI; rincian pada VALIDASI.md | Lulus tes otomatis; bukan UAT akun nyata |
| 2026-10-20 | Pratinjau browser managed | Halaman mengarah ke route Sign in with ChatGPT; route login hosted tidak tersedia pada pratinjau ini (404) | Interaksi UI setelah login belum terverifikasi |
| 2026-10-19 | Kebijakan Worker, simulasi Node | Allowlist aset; navigasi live no-store tanpa menyimpan HTML; fallback generik; bypass API/auth/write/external; penolakan HTML login saat instalasi; pembersihan cache hanya prefix sendiri | Lulus simulasi logika; bukan uji browser/perangkat |

## Catatan penerimaan perusahaan

Catat environment/URL, versi source, migrasi terakhir, peran penguji, tanggal pelaksanaan, data uji, hasil aktual, bukti dan isu yang tersisa. HR menerima perhitungan cuti/kebijakan, atasan menerima alur keputusan, Purchasing menerima alur permintaan, dan IT menerima autentikasi, persistensi, backup serta pemulihan.

Keputusan siap dipakai operasional dibuat setelah hasil aktual sesuai dengan kriteria yang relevan. Jika ada fitur yang belum diuji, tulis batas tersebut pada berita acara penerimaan.
