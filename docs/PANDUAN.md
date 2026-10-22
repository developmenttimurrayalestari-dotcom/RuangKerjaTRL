# Panduan RuangKerja

HR & Purchasing · Panduan pengguna versi 1.1.0 · 20 Oktober 2026

RuangKerja menggabungkan permohonan cuti dengan approval atasan, administrasi karyawan, saldo cuti, pencatatan sakit/alpa, dan permintaan pembelian. Versi 1.1.0 memakai **tiga level akun: Administrator, Manager, dan Staff**, dengan **2 divisi serta 15 unit kerja**. Aplikasi dibuka melalui browser desktop atau ponsel. Fitur PWA menyediakan ikon di layar utama; transaksi memerlukan koneksi internet.

## 1. Level akun dan persiapan Administrator

Sebelum memakai data operasional, Administrator melengkapi nama perusahaan, daftar karyawan, email akun, divisi, unit kerja, jabatan, atasan, jadwal kerja, dan saldo awal. Periksa data contoh apabila penanda demo masih terlihat. Data contoh dipakai untuk mencoba alur dan bukan data kepegawaian dari SQL lama.

### Tiga level akun

| Level | Penggunaan utama |
|---|---|
| **Administrator** | Seluruh fitur: mengelola akun, data karyawan, saldo/impor, sakit/alpa, kalender, laporan, dan pengaturan; mengajukan atas nama karyawan serta memutuskan pengajuan orang lain |
| **Manager** | Mengajukan cuti/pembelian sendiri, memantau pengajuan tim, dan memutuskan pengajuan yang ditugaskan kepadanya sebagai atasan |
| **Staff** | Mengajukan cuti/pembelian sendiri, melihat saldo dan statusnya, membaca kalender, serta membatalkan pengajuan pribadi pada tahap yang diizinkan |

**Review Purchasing, pemesanan, dan penerimaan hanya dapat diproses Administrator atau Manager di Unit Purchasing.** Karyawan dengan level Staff di Unit Purchasing tetap memiliki akses Staff. Penempatan dalam satu divisi/unit tidak otomatis menjadikan seseorang sebagai atasan seluruh anggota unit tersebut.

Menu administratif—**Data karyawan**, **Akun & akses**, **Saldo & impor cuti**, **Sakit & alpa**, **Laporan**, dan **Pengaturan**—hanya tersedia bagi Administrator. Semua level dapat membaca **Kalender kerja**; perubahan kalender dilakukan Administrator. Menu **Persetujuan** tersedia bagi Manager dan Administrator. Server memeriksa identitas serta izin pada setiap tindakan, termasuk ketika alamat halaman dibuka secara langsung.

Pemohon tidak boleh menyetujui cutinya sendiri atau menyetujui maupun memproses pembeliannya sendiri. Aturan ini juga berlaku untuk Administrator dan Manager. Pengajuan pribadi Manager harus memiliki atasan lain yang aktif dengan level Manager atau Administrator.

### Mendaftarkan akun melalui Akun & akses

1. Masuk sebagai Administrator, lalu buka **Akun & akses** dan pilih **Tambah akun**.
2. Isi NIP unik, nama lengkap, **email akun ChatGPT yang akan dipakai masuk**, dan jabatan.
3. Pilih **Divisi**, kemudian **Unit kerja**. Pilihan unit mengikuti divisi; mengganti divisi mengosongkan pilihan unit agar dipilih kembali dengan benar.
4. Tetapkan **Level akun**: Administrator, Manager, atau Staff. Untuk petugas yang memproses review pembelian, pilih Manager dan Unit Purchasing.
5. Pilih **Atasan untuk persetujuan** dari Manager atau Administrator aktif. Atasan harus orang lain dan hubungan atasan tidak boleh membentuk siklus.
6. Lengkapi tanggal bergabung, jadwal kerja, dan status aktif, lalu simpan.
7. Pastikan karyawan juga memiliki akses ke situs privat, kemudian minta karyawan masuk melalui **Sign in with ChatGPT**.

Form ini mendaftarkan akun terlebih dahulu berdasarkan email. Pada login pertama yang cocok, aplikasi menautkan karyawan dengan identitas ChatGPT yang stabil. **Aplikasi tidak menyediakan password tersendiri dan tidak mengirim email, undangan, atau reset password dari formulir akun.** Akses situs privat tetap mengikuti pengaturan akses platform. Bila karyawan belum dapat masuk, periksa akses situs, kecocokan email, dan status aktifnya.

Akun yang sudah tertaut mempertahankan identitas masuknya. Mengubah email di formulir tidak otomatis memindahkan akun kepada orang lain. Perubahan level akun maupun status aktif akun sendiri harus dikelola Administrator lain.

Gunakan pencarian dan filter **Level akun**, **Divisi**, **Unit kerja**, serta **Status** untuk menemukan akun. Kartu ringkasan level dapat dipilih untuk menyaring daftar. Klik ikon edit pada baris akun untuk memperbarui data; ikon nonaktif mempertahankan riwayat transaksi dan audit. Bagian **Rincian hak akses & persetujuan** menjelaskan cakupan masing-masing level.

## 2. Divisi, unit kerja, dan data karyawan

### Struktur organisasi

| Divisi | Unit kerja |
|---|---|
| Divisi Produksi | Surfacing |
| Divisi Produksi | Warehouse LAB |
| Divisi Produksi | Coating |
| Divisi Produksi | Quality Control |
| Divisi Produksi | Delivery |
| Divisi Back Office | Admin Sales |
| Divisi Back Office | Marketing |
| Divisi Back Office | Sales |
| Divisi Back Office | Customer Service |
| Divisi Back Office | Accounting dan Tax |
| Divisi Back Office | HR & General Affair |
| Divisi Back Office | IT |
| Divisi Back Office | Account Receiveable & Finance |
| Divisi Back Office | Purchasing |
| Divisi Back Office | Warehouse Goods |

Kelima belas unit tersebut tersedia dalam master aplikasi. **HR & General Affair** dan **Purchasing** merupakan nama unit kerja. Hak menggunakan fitur ditetapkan melalui level akun serta penugasan atasan. Administrasi HR membutuhkan level Administrator; akses review pembelian membutuhkan Administrator atau Manager Unit Purchasing.

### Mengelola karyawan

Pada menu **Data karyawan**, Administrator menambahkan atau mengubah NIP, nama, email, divisi/unit, jabatan, tanggal bergabung, atasan, level akun, dan hari kerja. Data ini merupakan data yang sama dengan menu **Akun & akses**.

- Pakai NIP unik dan konsisten karena NIP menjadi kunci pencocokan impor saldo.
- Email harus sesuai akun yang akan masuk dan tidak dipakai oleh dua karyawan.
- Pilih divisi dahulu, lalu unit kerja yang benar. Unit wajib dipilih saat menyimpan akun.
- Pilih atasan Manager atau Administrator aktif selain karyawan itu sendiri.
- Periksa jadwal kerja masing-masing karyawan. Untuk pola enam hari, Sabtu menjadi hari kerja.
- Nonaktifkan akun yang sudah tidak digunakan agar riwayat cuti, pembelian, dan audit tetap tersimpan.
- Sebelum menonaktifkan atau menurunkan level seorang atasan, pindahkan bawahan aktif dan selesaikan pengajuan yang masih menjadi tanggung jawab persetujuannya.

Mengisi atasan yang benar sebelum pengajuan dibuat membantu pengajuan masuk ke antrean yang sesuai. Atasan dicatat pada saat pengajuan dibuat. Perubahan atasan pada master karyawan tidak otomatis memindahkan tanggung jawab pengajuan lama; periksa detail pengajuan dan gunakan penanganan Administrator bila diperlukan. Uji satu karyawan dan satu atasan dengan akun terpisah sebelum mengaktifkan seluruh tim.

Pilihan jadwal adalah Senin–Jumat atau Senin–Sabtu. Jadwal shift/roster yang berubah per tanggal memerlukan pengembangan lanjutan.

### Data lama bertanda Belum dipetakan

Peningkatan ke 1.1.0 mempertahankan informasi lama dan hanya memetakan nama unit yang dapat dikenali. Label umum seperti Manajemen, Gudang, atau Finance dapat tetap berstatus **Belum dipetakan**. Akun pemilik workspace yang belum memiliki penempatan juga dapat menampilkan status ini.

Administrator membuka **Akun & akses** atau **Data karyawan**, memilih filter Divisi **Belum dipetakan**, lalu mengedit akun. Cocokkan informasi lama dengan penempatan sebenarnya, pilih divisi/unit, dan simpan. Riwayat cuti/pembelian tetap tersedia. Label unit pada pembelian lama mengikuti data yang disimpan saat pengajuan dibuat.

Untuk upgrade dari 1.0.1, role lama HR dan Purchasing dikonversi menjadi Manager. Akun Staff lama yang sudah mendapat penugasan sebagai atasan juga dapat dipertahankan sebagai Manager melalui migrasi. Administrator perlu meninjau level akun hasil migrasi dan menetapkan akses administratif sesuai tanggung jawab nyata karyawan. Petunjuk migrasi database berada di [README](../README.md) dan [DATABASE.md](DATABASE.md).

## 3. Saldo cuti dan impor CSV

Administrator mengelola saldo melalui **Saldo & impor cuti**. Manager dan Staff melihat saldo personal pada Ringkasan atau Pengajuan cuti. Saldo disimpan per karyawan dan tahun. Nilai yang ditampilkan dibedakan sebagai berikut:

| Komponen | Arti |
|---|---|
| Hak / entitlement | Jumlah hak cuti tahun tersebut |
| Penyesuaian / adjustment | Koreksi tambahan atau pengurangan sesuai persetujuan perusahaan |
| Terpakai / used | Cuti tahunan yang sudah disetujui dan belum dibatalkan |
| Ditahan / reserved | Saldo untuk permohonan tahunan yang masih menunggu approval |
| Tersedia / available | Hak + penyesuaian − terpakai − ditahan |

Contoh: hak 12 hari, penyesuaian 2 hari, terpakai 3 hari dan menunggu 2 hari menghasilkan saldo tersedia 9 hari. Angka hak default pada pengaturan aplikasi adalah nilai konfigurasi; Administrator menetapkan saldo sesuai aturan perusahaan.

### Format impor

Gunakan file **CSV UTF-8**, pemisah koma, maksimal **100 baris data per impor**. Versi 1.1.0 mengimpor dan mengekspor CSV; file XLSX perlu dikonversi sebelum diunggah. Excel boleh dipakai untuk menyiapkan data, kemudian simpan sebagai CSV UTF-8 dan periksa pemisahnya.

```csv
nip,year,entitlement,adjustment
EMP001,2026,12,0
EMP002,2026,12,2
EMP001,2027,12,0
```

NIP di atas hanya contoh; ganti dengan NIP karyawan yang sudah terdaftar. Kolom `adjustment` boleh tidak diisi dan bernilai nol secara default. Tahun dan jumlah hari memakai bilangan bulat. Jangan menambahkan teks “hari”, pemisah ribuan, atau formula Excel ke nilai angka.

Langkah impor:

1. Unduh template atau siapkan header persis seperti contoh.
2. Isi hak dan penyesuaian per NIP/tahun.
3. Unggah CSV pada menu **Saldo & impor cuti** dan baca hasil pratinjau.
4. Perbaiki semua baris yang ditolak: NIP tidak ditemukan, tahun/nilai tidak valid, pasangan NIP/tahun ganda, atau hasil saldo kurang dari pemakaian dan saldo ditahan yang telah ada.
5. Jalankan impor setelah pratinjau valid, lalu cocokkan jumlah karyawan dan saldo hasilnya.

Impor mengganti nilai hak dan penyesuaian untuk pasangan karyawan/tahun terkait. Nilai terpakai dan ditahan tidak direset. Satu file diproses sebagai satu kesatuan; file yang tidak valid tidak boleh menghasilkan pembaruan sebagian. Jika seluruh hak/penyesuaian sudah sama dengan data tersimpan, pengulangan impor tidak membuat perubahan baru. File yang pernah dipakai boleh diimpor lagi apabila nilai tersimpan sudah berubah; koreksi kembali tersebut dicatat sebagai batch baru. Untuk koreksi, siapkan file berisi nilai yang benar, lalu periksa pratinjaunya.

## 4. Mengajukan cuti

1. Buka **Pengajuan cuti**, lalu pilih **Ajukan cuti**. Manager dan Staff mengajukan untuk dirinya sendiri; Administrator dapat memilih karyawan lain.
2. Pilih jenis cuti: tahunan atau khusus, sesuai kebijakan perusahaan.
3. Isi tanggal mulai, tanggal akhir dan alasan.
4. Periksa rincian hari yang dihitung. Libur nasional dan hari di luar jadwal kerja tidak mengurangi saldo tahunan.
5. Periksa saldo tersedia, lalu kirim.
6. Pantau status dan catatan keputusan pada daftar pengajuan.

Permohonan tahunan yang menunggu persetujuan menahan saldo agar saldo yang sama tidak dipakai oleh beberapa permohonan. Persetujuan memindahkan saldo ditahan ke terpakai. Penolakan atau pembatalan pada tahap yang diperbolehkan melepaskan saldo yang ditahan. Pembatalan cuti yang sudah disetujui dilakukan Administrator dengan alasan dan pengembalian saldo melalui transaksi yang tercatat.

Cuti khusus dicatat sebagai jenis permohonan terpisah dan tidak mengurangi saldo tahunan. Persetujuan tetap diperlukan. Versi ini menghitung hari penuh; permohonan setengah hari atau berdasarkan jam belum disediakan.

Permohonan lintas tahun dipecah sesuai tanggalnya. Misalnya `2026-12-31` sampai `2027-01-04`, untuk jadwal Senin–Jumat, memakai 1 hari saldo 2026 dan 1 hari saldo 2027. Tahun Baru serta Sabtu–Minggu tidak dihitung. Kedua tahun harus mempunyai kalender terverifikasi dan saldo yang memadai.

Rentang yang seluruhnya merupakan hari tidak terpotong menghasilkan nol hari dan tidak diterima sebagai permohonan cuti. Tanggal tumpang tindih dengan permohonan aktif perlu diselesaikan terlebih dahulu.

Karyawan mengajukan tanggal hari ini atau sesudahnya. Pencatatan tanggal lampau hanya dapat dilakukan Administrator. Tanggal tidak boleh lebih awal dari tanggal bergabung karyawan dan satu pengajuan dibatasi maksimal 367 tanggal kalender. Catatan sakit/alpa yang bertumpuk juga perlu dikoreksi sebelum permohonan dibuat.

### Approval cuti

Pada menu **Persetujuan**, Manager yang ditunjuk atau Administrator memeriksa nama, rentang tanggal, jumlah hari, dan alasan. Pilih setujui atau tolak. Penolakan harus disertai alasan agar pemohon mengetahui tindak lanjutnya. Bila permohonan tidak muncul, periksa level akun, atasan yang tersimpan pada detail pengajuan, dan status terakhirnya.

Pemohon dapat membatalkan permohonan miliknya ketika masih menunggu. Cuti yang sudah disetujui memerlukan tindakan Administrator, bukan mengubah saldo secara langsung. Klik ganda atau pemuatan ulang setelah keputusan tidak boleh menghasilkan pemotongan dua kali; gunakan status dan riwayat terbaru sebagai acuan.

## 5. Kalender Indonesia dan kebijakan cuti bersama

Kalender awal memuat **2026: 17 tanggal libur nasional dan 8 tanggal cuti bersama**, serta **2027: 18 tanggal libur nasional dan 8 tanggal cuti bersama**, berdasarkan SKB yang dipublikasikan pemerintah. Sumber resmi dapat dibuka melalui referensi kalender. [S1][S2]

Fungsi sinkronisasi pada versi ini membaca **seed resmi terverifikasi yang disertakan dalam aplikasi**. Fitur tersebut tidak memanggil API pemerintah secara langsung dan tidak menjanjikan pembaruan otomatis untuk semua tahun.

| Jenis tanggal | Perlakuan aplikasi |
|---|---|
| Libur nasional | Tidak memotong saldo cuti tahunan |
| Hari tidak bekerja menurut jadwal karyawan | Tidak memotong saldo cuti tahunan |
| Cuti bersama dengan kebijakan `exclude` | Tidak memotong saldo; ini konfigurasi awal aplikasi |
| Cuti bersama dengan kebijakan `deduct` | Dihitung jika termasuk tanggal pengajuan individual dan merupakan hari kerja karyawan |

SKB membedakan cuti bersama dari libur nasional dan menetapkan bahwa pelaksanaan cuti bersama bagi instansi swasta diatur pimpinan masing-masing. Administrator menetapkan pilihan aplikasi sesuai kebijakan perusahaan. [S1][S2]

Pilihan `deduct` pada versi ini **tidak membebankan seluruh cuti bersama secara massal** kepada seluruh karyawan. Jika perusahaan memakai pemotongan massal, proses dan ledger tambahan perlu dirancang terlebih dahulu agar tidak dipotong lagi melalui permohonan individual.

### Contoh hitung

Dengan jadwal Senin–Jumat dan kebijakan cuti bersama `exclude`:

| Pengajuan | Hari terpotong | Dasar |
|---|---:|---|
| 15–17 Juni 2026 | 2 | Tanggal 16 libur nasional |
| 24–28 Desember 2026 | 1 | Tanggal 24 cuti bersama, 25 Natal, 26–27 akhir pekan; tanggal 28 dihitung |
| 31 Desember 2026–4 Januari 2027 | 2 | Tanggal 31 dan 4 dihitung pada tahun masing-masing |

Contoh tanggal lampau dipakai untuk memeriksa hitungan; pencatatan transaksinya dilakukan Administrator.

Bila contoh 24–28 Desember memakai `deduct`, hasilnya 2 hari: tanggal 24 dan 28. Jika jadwal karyawan mencakup Sabtu, tanggal 26 juga diperiksa sebagai hari kerja. Tidak ada hari yang dipotong dua kali hanya karena mempunyai lebih dari satu alasan pengecualian.

Untuk tahun yang belum terverifikasi, finalisasi perhitungan diblokir. Administrator harus mengisi dan memverifikasi daftar tahun itu terlebih dahulu. Jangan menandai kalender sebagai lengkap hanya karena sudah menambah satu hari libur. Periksa sumber SKB terbaru, seluruh tanggal, jenis tanggal, dan nomor revisi. Penetapan Idulfitri dan Iduladha tetap mengikuti keputusan Menteri Agama sebagaimana disebutkan dalam SKB. [S2]

## 6. Sakit dan alpa

Administrator menggunakan menu **Sakit & alpa** untuk memilih karyawan, tanggal, jenis kejadian, dan keterangan. Koreksi catatan yang salah melalui pengelolaan catatan tersebut. Satu karyawan/tanggal tidak boleh mempunyai pencatatan ketidakhadiran ganda.

Sakit dan alpa dicatat terpisah dari cuti tahunan sehingga pencatatan ini tidak otomatis memotong saldo cuti. Versi 1.1.0 belum menghitung potongan gaji, payroll, bukti medis, atau klaim kesehatan dari catatan tersebut.

## 7. Permintaan pembelian

1. Buka **Pembelian**, lalu pilih **Buat permintaan**. Manager dan Staff mengajukan untuk dirinya sendiri; Administrator dapat memilih pengaju lain.
2. Isi judul kebutuhan, alasan, tanggal dibutuhkan dan prioritas normal/mendesak.
3. Tambahkan barang, jumlah, satuan dan estimasi harga satuan dalam rupiah.
4. Periksa total, lalu kirim ke atasan.
5. Setelah Manager yang ditunjuk atau Administrator menyetujui, permintaan masuk ke tahap review Unit Purchasing.
6. Manager Unit Purchasing atau Administrator meninjau lalu menyetujui, atau menolak dengan alasan.
7. Manager Unit Purchasing atau Administrator memperbarui proses menjadi dipesan, kemudian diterima setelah barang benar-benar diterima.

| Status | Arti |
|---|---|
| Menunggu atasan (`pending_manager`) | Perlu keputusan atasan pemohon |
| Review Purchasing (`pending_purchasing`) | Sudah lolos atasan dan menunggu review Manager Unit Purchasing/Administrator |
| Disetujui (`approved`) | Review Purchasing selesai; permintaan siap dipesan |
| Dipesan (`ordered`) | Pemesanan sudah dicatat Manager Unit Purchasing/Administrator |
| Diterima (`received`) | Penerimaan sudah dikonfirmasi |
| Ditolak (`rejected`) | Tidak dilanjutkan; baca alasan |
| Dibatalkan (`cancelled`) | Pemohon membatalkan pada tahap yang diizinkan |

Manager di luar Unit Purchasing hanya memutuskan tahap atasan yang ditugaskan kepadanya. Staff tidak memperoleh approval dari penempatan unit. Semua pemroses, termasuk Manager Unit Purchasing dan Administrator, dilarang memproses pembelian miliknya sendiri.

Pemohon hanya dapat membatalkan sendiri saat masih menunggu atasan. Tahapan tidak boleh dilompati. Estimasi total dihitung server dari baris barang. Kuantitas dan harga pada versi ini memakai bilangan bulat; nilai rupiah tidak memakai desimal.

Satu permintaan memuat 1–30 baris barang. Tanggal dibutuhkan tidak boleh berada di masa lalu. Untuk mengubah permintaan yang belum diproses, batalkan dahulu lalu buat permintaan yang benar; riwayat permintaan awal tetap tersimpan.

Modul ini mengelola permintaan dan status proses pembelian. Penerbitan PO resmi, posting ke Oracle EBS, pencatatan hutang, pajak dan jurnal akuntansi memerlukan integrasi lanjutan.

## 8. Laporan dan riwayat

Menu **Laporan** merupakan fitur Administrator. Manager dan Staff dapat mengekspor daftar pengajuan yang tersedia pada halaman cuti/pembelian sesuai cakupan datanya. Ekspor direktori akun/karyawan mengikuti filter yang dipilih; laporan transaksi mengikuti periode tahun yang ditampilkan. Hasil yang terlihat dan diekspor mengikuti hak akses akun. Cocokkan saldo tahunan, permohonan, dan status purchasing berdasarkan periode yang sama. Catatan audit merekam tindakan administratif dan keputusan untuk penelusuran.

Unduhan CSV berisi data sesuai cakupan laporan. Simpan dan bagikan melalui prosedur internal perusahaan. Ekspor laporan bukan backup lengkap database; panduan teknis backup berada di `DEPLOYMENT.md`.

## 9. Memasang di ponsel

**Android dengan Chrome:** buka URL aplikasi melalui HTTPS, masuk dengan akun yang terdaftar, lalu buka menu Chrome dan pilih instal aplikasi atau opsi instal/buat pintasan yang tersedia. Ikuti konfirmasi browser. Nama menu dapat berbeda menurut versi. [S3]

**iPhone dengan Safari:** buka URL aplikasi, gunakan Bagikan, pilih Tambahkan ke Layar Utama, aktifkan opsi buka sebagai aplikasi web jika tersedia, lalu tambahkan. [S4]

Ikon RuangKerja membuka aplikasi yang sama. Aplikasi yang disediakan adalah web responsif/PWA; paket APK atau aplikasi native App Store tidak disertakan. Uji pemasangan di perangkat perusahaan sebelum distribusi luas.

Saat koneksi terputus, halaman offline umum muncul pada pembukaan halaman. Worker tidak menyimpan respons API, identitas, data HR, atau halaman pengguna. Formulir tidak diantrikan untuk dikirim otomatis. Setelah kembali online, periksa status terakhir sebelum mengulang tindakan yang sebelumnya tampak gagal.

## 10. Pesan masalah dan tindakan

| Gejala | Yang diperiksa |
|---|---|
| Akun tidak dikenal | Email master, status aktif, identitas masuk dan akses situs privat |
| Saldo tidak cukup | Tahun saldo, hak, penyesuaian, cuti terpakai dan yang menunggu |
| Kalender belum terverifikasi | Cakupan setiap tahun dalam pengajuan, data lengkap dan status verifikasi Administrator |
| Impor ditolak | Header/pemisah CSV, NIP, angka bulat, duplikasi NIP/tahun, maksimal 100 baris dan saldo hasil |
| Menu administrasi tidak tersedia | Fitur tersebut membutuhkan level Administrator; penempatan HR & General Affair tidak otomatis memberi akses administratif |
| Unit kerja belum dipetakan / belum dipilih | Administrator memilih Divisi lalu Unit kerja yang benar pada akun terkait, kemudian menyimpan |
| Tombol approval tidak tersedia | Level Manager/Administrator, atasan yang tersimpan pada pengajuan, larangan approval sendiri, dan status terakhir |
| Review Purchasing tidak tersedia | Level Administrator atau Manager di Unit Purchasing; Staff Purchasing tetap hanya mengajukan untuk diri sendiri |
| Pengajuan beririsan | Periksa permohonan pending/approved yang meliputi tanggal sama |
| Penyimpanan gagal saat koneksi putus | Sambungkan kembali dan cek daftar terbaru sebelum mencoba lagi |
| Tidak muncul pilihan instal | Buka langsung di browser yang mendukung, pastikan HTTPS dan periksa izin browser |

## Sumber

- [S1 — Sekretariat Negara, SKB libur nasional dan cuti bersama 2026; penetapan 19 September 2025](https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026).
- [S2 — Sekretariat Negara, SKB libur nasional dan cuti bersama 2027; penetapan 15 September 2026](https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027).
- [S3 — Google Chrome, menggunakan dan menginstal aplikasi web di Android](https://support.google.com/chrome/answer/9658361?hl=id&co=GENIE.Platform%3DAndroid).
- [S4 — Apple, menambahkan situs sebagai aplikasi web di iPhone](https://support.apple.com/guide/iphone/iphea86e5236/ios).

Sumber kalender dan pemasangan diperiksa pada 19 Oktober 2026. Aturan operasional aplikasi didokumentasikan dari kontrak API serta skema source code yang disertakan.
