# Menjalankan dan menerapkan RuangKerja

Panduan teknis versi 1.1.0 · 20 Oktober 2026

## 1. Arsitektur yang benar-benar disediakan

| Bagian | Implementasi |
|---|---|
| Antarmuka | React/TypeScript, layout web responsif, PWA |
| Server aplikasi | Vinext pada runtime Cloudflare Workers/Sites |
| Database aplikasi berjalan | Cloudflare D1, menggunakan dialek SQLite |
| Schema aplikasi | `db/schema.ts`, Drizzle; 17 tabel, SQL migrasi `0000` dan `0001` pada `drizzle/` |
| API utama | `GET /api/workspace` dan `POST /api/workspace` |
| Identitas hosted | Sign in with ChatGPT; header identitas dari dispatch tepercaya |
| Otorisasi | Administrator (`admin`), Manager (`manager`), Staff (`employee`); level, cakupan data, dan unit diperiksa server |
| Organisasi | 2 divisi dan 15 unit kerja; master pada `lib/data/organization-units.json` |
| Kalender | Seed SKB pemerintah 2026/2027 di `lib/data/holidays-verified.json` |
| Berkas impor/ekspor | CSV UTF-8 |
| Paket database pendamping | Schema MySQL 8 untuk database baru, upgrade 1.0.1 → 1.1.0, dan staging legacy pada `database/` |

**Source aplikasi menggunakan D1/SQLite.** Berkas MySQL 8 adalah rancangan database dan bahan migrasi data lama, bukan pilihan runtime yang otomatis aktif. Mengisi `DATABASE_URL` MySQL saja tidak membuat aplikasi ini memakai MySQL. Pemisahan ini perlu diperhatikan saat merencanakan instalasi on-premise.

Versi dependency yang dikunci tersedia pada `package.json` dan `package-lock.json`. Persyaratan Node pada paket adalah **Node.js >= 22.13.0**. Periksa juga `README.md` untuk rincian runtime starter dan perintah lokal yang disediakan.

## 2. Persiapan source lokal

Ekstrak paket source ke folder kerja dan buka terminal pada folder yang berisi `package.json`. Gunakan Node/npm sesuai persyaratan paket, lalu:

```sh
npm run install:ci
npm run build
```

Jalankan satu proses instalasi dependency pada satu waktu. `install:ci` menggunakan lockfile. Proses build menghasilkan konfigurasi Worker lokal pada `dist/server/wrangler.json`.

Pastikan deklarasi binding `DB` tetap sesuai dengan `db/index.ts`, `cloudflare-env.d.ts` dan konfigurasi hosting dalam source. Situs memerlukan binding database untuk fitur persistensi; tanpa binding, penyimpanan aplikasi tidak tersedia.

### Menyiapkan database pengembangan

Pada database lokal yang masih kosong, jalankan **kedua migration berikut secara berurutan**:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_productive_shatterstar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_account_levels_organization.sql
```

Pada database lokal **1.0.1 yang sudah terisi dan telah mempunyai schema `0000`**, jalankan hanya migration tambahan yang belum diterapkan:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_account_levels_organization.sql
```

Migration `0001` menambah tabel divisi/unit, `employees.work_unit_id`, master 2 divisi/15 unit, pemetaan akun lama, dan aturan tiga role. Jangan menjalankan kembali `0000`, mereset database, atau menyalin seed transaksi untuk memperbarui instalasi lama. Jangan mengeksekusi berkas MySQL pendamping pada D1. Perintah di atas hanya mengubah database lokal, bukan produksi; simpan catatan migration lokal yang telah dijalankan dan jangan mengulang file yang sama.

Sebagai riwayat versi, **pembaruan 1.0.0 → 1.0.1 tidak menambah migration**. Versi 1.1.0 menambahkan `0001_account_levels_organization.sql`; perubahan berikutnya tetap diterapkan menurut urutan nomor dan hanya bila belum berjalan.

Setelah schema siap:

```sh
npm run dev
```

Pada mode portable, server pengembangan memakai alamat loopback yang ditampilkan terminal, secara default port 5173. Source tanpa konfigurasi runtime lokal memakai profil portable. Profil pengembangan menyediakan simulasi identitas lokal melalui `/signin-with-chatgpt?return_to=/`; baca perilaku terperinci pada `README.md` dan gunakan hanya di lingkungan pengembangan loopback.

Untuk melihat hasil build sebagai Worker lokal:

```sh
npm start
```

Perintah ini memakai konfigurasi hasil build dan database lokal pada `.wrangler/state`. Mode ini tidak menerbitkan situs dan tidak mensimulasikan alur sign-in hosted. Karena itu, **gunakan `npm run dev` untuk bekerja dengan UI aplikasi lokal**; menjalankan `npm start` lalu membuka halaman beridentitas saja dapat berakhir pada route sign-in yang tidak tersedia. Uji autentikasi end-to-end pada deployment yang memakai layanan identitas sebenarnya.

## 3. Penerapan di Sites

Gunakan lifecycle Sites untuk memasang dependency, membangun, memigrasikan database, preview dan deployment. Pertahankan pengaturan akses proyek yang berlaku. Deployment kode dan kebijakan berbagi adalah dua hal yang terpisah; penerapan kode tidak boleh dianggap sebagai izin membuka data HR kepada publik.

Saat menyiapkan instance baru:

1. Siapkan binding D1 dan terapkan `0000` lalu `0001` pada database kosong melalui lifecycle Sites. Pada upgrade 1.0.1, terapkan hanya `0001` yang belum dijalankan.
2. Bangun serta jalankan smoke test pada lingkungan uji privat.
3. Tetapkan environment runtime `WORKSPACE_BOOTSTRAP_EMAIL` ke email akun pemilik yang berwenang, kemudian masuk sebagai pemilik untuk proses bootstrap administratif.
4. Tinjau penanda/data demo dan konfigurasi perusahaan.
5. Daftarkan karyawan, pilih divisi/unit dan level akun, lengkapi email serta atasan aktif berlevel Manager/Administrator; siapkan saldo serta kalender.
6. Uji Administrator, Manager, Staff, Manager unit Purchasing, dan Staff unit Purchasing secara terpisah dengan skenario `UAT.md`. Hak pengelolaan administratif berada pada Administrator; unit HR & General Affair sendiri tidak memberikan hak tambahan.
7. Setelah hasil diterima, pindahkan penggunaan ke instance produksi yang disiapkan. Simpan catatan versi kode, migrasi dan hasil penerimaan.

Identitas SIWC menetapkan pengguna yang masuk. Hak menjadi anggota aplikasi berasal dari data karyawan aktif dan kontrol akses situs. Pada database kosong, `WORKSPACE_BOOTSTRAP_EMAIL` membatasi inisialisasi administrator ke email yang ditetapkan melalui konfigurasi server. Gunakan alamat pemilik yang diverifikasi dari pengaturan Situs; jangan menerima nilai konfigurasi ini dari formulir atau request pengguna. Email dibandingkan tanpa membedakan huruf besar/kecil. Akun lain mendapat respons 403 sampai pemilik menyelesaikan inisialisasi.

Tanpa variabel tersebut, perilaku kompatibilitas untuk pengembangan lokal adalah pengguna pertama menjadi administrator. Karena itu, tetapkan variabel tersebut pada instance hosted, atau pertahankan akses khusus pemilik sampai inisialisasi selesai. Setelah inisialisasi, penggantian variabel tidak memindahkan kepemilikan atau mengubah admin yang sudah tersimpan. Akun berikutnya harus cocok dengan karyawan aktif yang sudah dipersiapkan; pengunjung baru tidak otomatis mendapat peran administrator.

### Pemeriksaan upgrade instalasi 1.0.1

Ambil backup dan catat jumlah karyawan, saldo, pengajuan aktif, serta versi migration sebelum menerapkan `0001`. Migration mempertahankan ID, `auth_subject`, status aktif, atasan/approver, tanggal, saldo, ledger, transaksi, dan histori. Tidak ada penghapusan atau bootstrap ulang data yang sudah ada.

Role lama `hr` dan `purchasing` menjadi Manager pada unit HR & General Affair dan Purchasing. Akun Staff yang sudah menjadi atasan karyawan aktif atau approver pengajuan pending dipromosikan ke Manager agar penugasan lama tetap dapat diproses. Nama unit yang sesuai dipetakan; departemen nyata yang ambigu tetap belum dipetakan. Penempatan khusus data demo hanya berlaku pada ID demo yang dikenal dan email `@example.invalid`. Aturan lengkapnya tersedia di [`DATABASE.md`](DATABASE.md) dan [`database/README.md`](../database/README.md).

Sesudah upgrade, verifikasi 17 tabel inti, 2 divisi, 15 unit, dan hanya nilai role `admin`, `manager`, `employee` pada akun. Bandingkan transaksi/saldo dengan catatan sebelum upgrade. Administrator meninjau karyawan **Belum dipetakan** melalui form divisi/unit; pemilik awal dengan label `Manajemen` dapat termasuk dalam daftar ini. ID dan kode unit tetap stabil; divisi karyawan diturunkan dari unit yang dipilih.

Jalankan pemeriksaan source yang disediakan (`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:d1`) dan build. Pengujian migration D1 mencakup schema baru, database 1.0.1 berisi fixture, preservasi identitas/transaksi, role/FK, serta perlindungan akun nyata yang ID-nya menyerupai demo. Fixture workerd memerlukan port loopback lokal. Tetap lakukan smoke test akun dan approval pada deployment setelah migration diterapkan.

## 4. Jika perusahaan memilih server sendiri dan MySQL

Paket `database/` menjelaskan schema 17 tabel, pemetaan lama, dan prapemeriksaan migrasi. Database target baru memakai `database/mysql8-schema.sql`. Target aplikasi MySQL 1.0.1 yang sudah terisi memakai `database/mysql8-upgrade-1.1.0.sql` satu kali. `CREATE TABLE IF NOT EXISTS` pada schema baru tidak menggantikan script upgrade. Gunakan MySQL 8.0.16+ agar CHECK tiga role dan integritas lainnya ditegakkan.

Jalankan analisis data pada salinan database lama, lakukan rekonsiliasi hasil, dan simpan pemetaan ID asal untuk penelusuran. Impor sumber legacy melalui staging memerlukan pilihan `target_work_unit_id` aktif, role `admin`/`manager`/`employee`, serta atasan aktif berlevel Administrator/Manager. Label unit/departemen sumber tetap tersimpan untuk peninjauan. Keberadaan berkas SQL lama dalam lampiran tidak berarti data itu sudah dimuat ke situs berjalan.

Agar memakai MySQL sebagai database operasional, implementasikan adapter penyimpanan yang menggantikan akses D1 pada server, lalu uji semua transaksi pada engine target. Area yang wajib disesuaikan mencakup koneksi/pool, tipe data, parameter query, konflik unik, timestamp, atomisitas batch dan penguncian saldo pada permintaan bersamaan. Migrasi schema saja tidak mengganti perilaku API.

Hosting mandiri juga memerlukan lapisan autentikasi yang memverifikasi sesi atau token dengan benar. Header `oai-authenticated-user-*` hanya dipercaya ketika diinjeksikan oleh dispatch hosted yang tepercaya. Server publik mandiri tidak boleh menerima nilai header tersebut langsung dari klien sebagai bukti login. Hapus header buatan klien pada proxy dan gunakan provider identitas yang diverifikasi server sebelum meneruskan identitas internal.

Untuk rencana on-premise, tentukan URL HTTPS, reverse proxy, provider identitas, database, backup dan proses pemulihan. Setelah adapter runtime/auth selesai, jalankan ulang seluruh UAT dan uji transaksi bersamaan sebelum data produksi dipindahkan. DDL MySQL melakukan implicit commit; hentikan penulisan selama upgrade dan uji pemulihan dari backup pada instance terpisah. File MySQL rilis 1.1.0 ditinjau secara statis dan belum dieksekusi pada server MySQL dalam verifikasi rilis ini. Kelulusan uji D1 tidak membuktikan adapter atau upgrade MySQL sudah teruji.

## 5. Aturan perhitungan dan transaksi

Tanggal cuti dan kalender memakai string ISO `YYYY-MM-DD` sebagai tanggal bisnis dengan acuan Asia/Jakarta. Jangan mengubah tanggal kalender menjadi timestamp UTC lalu memotong string tanpa mempertimbangkan pergeseran hari.

Saldo tersedia adalah `entitlement + adjustment - used - reserved`. Pengajuan pending memesan saldo, approval mengalihkan pesanan ke penggunaan, dan pembatalan/penolakan mengembalikan komponen yang sesuai. Operasi tersebut harus atomik agar dua permohonan tidak membelanjakan saldo yang sama. Saldo dan ledger adalah data transaksi; koreksi tidak dilakukan dengan menghapus riwayat.

Permintaan pembelian memakai harga rupiah dan kuantitas bilangan bulat pada versi ini. Total dihitung server. Status berpindah sesuai urutan atasan → Purchasing → disetujui → dipesan → diterima. Simpan pengambil keputusan, waktu dan alasan pada riwayat.

### Level akun, atasan, dan tahap Purchasing

Administrator mempunyai seluruh fitur administratif. Manager mengajukan kebutuhan sendiri serta menyetujui pengajuan yang menunjuknya sebagai atasan; Staff mengajukan dan melihat data pribadi. Nilai database untuk Staff tetap `employee`. Role lama `hr` dan `purchasing` tidak boleh digunakan untuk akun baru.

Atasan yang dipilih harus aktif dan berlevel Manager atau Administrator; rantai atasan diperiksa agar tidak membentuk siklus. `approver_id` disimpan saat pengajuan, sehingga perubahan atasan pada master tidak memindahkan permintaan lama secara diam-diam. Administrator dapat mengambil keputusan sebagai delegasi; pemohon tidak dapat menyetujui permintaannya sendiri.

Setelah tahap atasan, proses Purchasing memerlukan **Administrator atau Manager pada unit berkode `PURCHASING`**. Unit dan divisi Manager Purchasing harus aktif. Staff unit Purchasing tetap tidak memiliki hak approval, pemesanan, atau penerimaan. Relasi divisi/unit tidak otomatis menentukan atasan; Administrator memilih atasan secara terpisah pada data karyawan.

Penonaktifan atau penurunan level menjadi Staff ditolak jika akun masih memiliki bawahan aktif, cuti `pending` yang menugaskannya sebagai approver, atau pembelian `pending_manager` yang belum diputuskan. Alihkan bawahan serta selesaikan tanggung jawab persetujuan sebelum mengubah akun. Antrean yang telah masuk `pending_purchasing` memakai hak unit Purchasing saat diproses. Sistem melindungi Administrator aktif terakhir dan menolak perubahan level/status akun Administrator sendiri dari sesi yang sama. Guard transaksi memeriksa ulang role, status, unit, dan tanggung jawab untuk mencegah perubahan bersamaan melewati batas akses.

Sakit/alpa tidak mengubah saldo tahunan. Cuti bersama `exclude` tidak terpotong; `deduct` dihitung untuk tanggal permohonan individual yang memang merupakan hari kerja. Fitur pemotongan massal cuti bersama belum disediakan.

## 6. Pemeliharaan kalender tahunan

Seed saat ini mencakup 2026 dan 2027. Label sinkronisasi di aplikasi berarti memuat ulang seed yang sudah diverifikasi; **tidak ada integrasi live API pemerintah** dalam versi ini.

Setiap tahun baru atau keputusan revisi membutuhkan alur berikut:

1. Dapatkan SKB atau keputusan resmi pada situs pemerintah dan simpan URL serta tanggal/nomor dokumen.
2. Susun seluruh tanggal ISO dengan jenis `national` atau `collective`; jangan menggabungkannya sebagai satu tipe.
3. Bandingkan daftar yang akan dimasukkan dengan versi aktif: tanggal baru, dihapus, digeser dan berganti jenis.
4. Validasi format, duplikasi, tahun, nama dan sumber. Jangan mengganti daftar aktif dengan respons kosong dari proses unduh yang gagal.
5. Tinjau dampak perubahan terhadap pengajuan yang sudah dibuat. Pertahankan jejak rincian hitung/kebijakan pada transaksi untuk audit.
6. Administrator mengaktifkan cakupan tahun sebagai terverifikasi setelah daftar lengkap diperiksa HR. Tahun tanpa verifikasi harus tetap menolak perhitungan final.
7. Perbarui seed dan versi aplikasi bila fungsi sinkronisasi akan memakai daftar yang baru.

Sumber 2026: [SKB dan daftar resmi Sekretariat Negara](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026). Sumber 2027: [SKB dan daftar resmi Sekretariat Negara](https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027). Kedua daftar diperiksa 19 Oktober 2026. SKB menyatakan penetapan Idulfitri dan Iduladha mengikuti keputusan Menteri Agama.

## 7. PWA, cache dan offline

Manifest ada pada `public/manifest.webmanifest`, service worker pada `public/sw.js`, dan fallback umum pada `public/offline.html`. Ikon tersedia sebagai SVG dan PNG 192/512 piksel. PWA berjalan di origin aplikasi dan memakai tampilan standalone bila browser mendukung.

Worker memakai jaringan terlebih dahulu untuk navigasi dan meminta `cache: no-store`. Worker tidak menyimpan HTML hasil navigasi. Cache Storage hanya berisi halaman offline yang bersifat umum dan tiga aset ikon lokal. Aset instalasi diperiksa agar redirect ke halaman sign-in atau respons non-gambar tidak masuk sebagai ikon.

Permintaan API, jalur autentikasi, permintaan lintas origin serta metode selain GET dilewatkan tanpa intersepsi. Tidak ada background sync atau antrian kirim untuk pengajuan. Endpoint API/server juga perlu mengirim header cache yang sesuai untuk data beridentitas; pengaturan Worker tidak menggantikan kontrol cache pada server/proxy.

Saat memperbarui fallback atau ikon, naikkan versi nama cache pada `sw.js`. Aktivasi Worker membersihkan versi cache dengan prefix RuangKerja saja. Periksa DevTools Application → Manifest, Service Workers dan Cache Storage; panduan panel tersedia pada [dokumentasi Chrome DevTools](https://developer.chrome.com/docs/devtools/progressive-web-apps).

Uji secara nyata di Android/Chrome dan iPhone/Safari: instalasi, sign-in, navigasi, offline, kembali online, sign-out dan pergantian pengguna. Kehadiran manifest atau lulus pemeriksaan source bukan bukti bahwa seluruh perangkat tersebut sudah diuji. Status uji perangkat ditulis terpisah pada `UAT.md`.

## 8. Backup, pemulihan dan pembaruan

Gunakan mekanisme backup/export database yang disediakan penyelenggara D1 dan simpan cadangan schema, data serta versi source secara konsisten. Tentukan frekuensi backup dan batas kehilangan data yang diterima perusahaan. Uji restore pada instance terpisah lalu rekonsiliasi jumlah karyawan, saldo, permohonan, ledger dan keputusan approval.

CSV laporan hanya mencakup hasil laporan terpilih; CSV bukan backup seluruh hubungan tabel. Backup juga perlu mencakup konfigurasi kalender, peran dan pemetaan identitas. Jangan memasukkan `.wrangler/state`, token, cookie sesi, hasil log berisi identitas, atau berkas rahasia ke source ZIP/repository yang dibagikan.

Sebelum pembaruan schema, simpan backup dan catatan migration yang sudah berjalan. Untuk 1.1.0, database baru memerlukan `0000` lalu `0001`; database 1.0.1 hanya memerlukan `0001`. Bangun aplikasi dan jalankan smoke test setelah perubahan diterapkan. Reverting kode saja tidak otomatis membalik pemetaan level akun atau migration data; pemulihan data harus mengikuti langkah yang telah diuji pada instance terpisah dan mempertahankan transaksi sesudah upgrade.

## 9. Cakupan rilis

Yang disediakan pada 1.1.0: aplikasi web/PWA, API server, schema 17 tabel dan migration D1, tiga level akun, master 2 divisi/15 unit, pemilihan unit/atasan pada karyawan, rancangan dan upgrade MySQL pendamping, seed kalender, pengelolaan karyawan/cuti/saldo/sakit-alpa/pembelian, approval, CSV dan audit.

Yang memerlukan tahap lanjutan jika dibutuhkan perusahaan: paket Android/iOS native, push/email/WhatsApp otomatis, payroll, setengah hari/jam, pemotongan cuti bersama massal, integrasi Oracle EBS/PO/AP, adapter MySQL operasional, dan konversi seluruh riwayat lama ke instance berjalan. Daftar ini menentukan pekerjaan implementasi berikutnya; rilis saat ini menyediakan alur yang disebutkan di atas.
