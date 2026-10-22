-- GAMSTRLv2 → portal baru: pemeriksaan READ-ONLY.
-- Dapat dijalankan terhadap MySQL 5.7 sumber maupun MySQL 8.0.
-- Gunakan akun SELECT-only. Tidak ada INSERT/UPDATE/DELETE/DDL dalam file ini.
-- Hasil hanya ringkasan struktur/kualitas; tidak menampilkan password/data pribadi.
-- Salin database ke lingkungan uji terlebih dahulu bila volume sumber besar.

SELECT VERSION() AS server_version,
       @@character_set_server AS server_charset,
       @@collation_server AS server_collation;

SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'gamstrlv2'
ORDER BY TABLE_NAME;

SELECT t.TABLE_NAME AS table_without_primary_key
FROM information_schema.TABLES t
LEFT JOIN information_schema.TABLE_CONSTRAINTS c
  ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
 AND c.TABLE_NAME = t.TABLE_NAME
 AND c.CONSTRAINT_TYPE = 'PRIMARY KEY'
WHERE t.TABLE_SCHEMA = 'gamstrlv2'
  AND t.TABLE_TYPE = 'BASE TABLE'
  AND c.CONSTRAINT_NAME IS NULL
ORDER BY t.TABLE_NAME;

SELECT COUNT(*) AS declared_foreign_keys
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'gamstrlv2'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- NIP selalu diperlakukan sebagai teks; jangan CAST ke angka.
SELECT COUNT(*) AS employees_total,
       COALESCE(SUM(NULLIF(TRIM(NIP), '') IS NULL), 0) AS blank_nip,
       COALESCE(SUM(NULLIF(TRIM(Nama), '') IS NULL), 0) AS blank_name,
       COALESCE(SUM(BINARY NIP <> BINARY TRIM(NIP)), 0) AS nip_outer_spaces,
       COALESCE(SUM(NULLIF(TRIM(Email), '') IS NULL), 0) AS email_missing,
       COALESCE(SUM(NULLIF(TRIM(Departemen), '') IS NULL), 0) AS department_missing,
       COALESCE(SUM(NULLIF(TRIM(unit), '') IS NULL), 0) AS unit_missing,
       COALESCE(SUM(NULLIF(TRIM(Jabatan), '') IS NULL), 0) AS position_missing,
       COALESCE(SUM(TglKeluar IS NOT NULL AND TglMasuk IS NOT NULL
                    AND TglKeluar < TglMasuk), 0) AS employment_dates_reversed,
       COALESCE(SUM(CAST(TglMasuk AS CHAR) = '0000-00-00'), 0) AS zero_start_dates,
       COALESCE(SUM(CAST(TglKeluar AS CHAR) = '0000-00-00'), 0) AS zero_end_dates
FROM gamstrlv2.tpegawai;

-- Periksa benturan yang mungkin timbul sesudah TRIM dan normalisasi huruf.
SELECT COUNT(*) AS normalized_nip_collision_groups,
       COALESCE(SUM(group_size - 1), 0) AS extra_rows_in_collisions
FROM (
  SELECT LOWER(TRIM(CONVERT(NIP USING utf8mb4))) COLLATE utf8mb4_unicode_ci AS normalized_nip,
         COUNT(*) AS group_size
  FROM gamstrlv2.tpegawai
  GROUP BY normalized_nip
  HAVING COUNT(*) > 1
) d;

SELECT COUNT(*) AS normalized_email_collision_groups,
       COALESCE(SUM(group_size - 1), 0) AS extra_rows_in_collisions
FROM (
  SELECT LOWER(TRIM(CONVERT(Email USING utf8mb4))) COLLATE utf8mb4_unicode_ci AS normalized_email,
         COUNT(*) AS group_size
  FROM gamstrlv2.tpegawai
  WHERE NULLIF(TRIM(Email), '') IS NOT NULL
  GROUP BY normalized_email
  HAVING COUNT(*) > 1
) d;

-- Validasi sintaks dasar, bukan pembuktian kepemilikan/deliverability alamat email.
SELECT COUNT(*) AS email_syntax_needs_review
FROM gamstrlv2.tpegawai
WHERE NULLIF(TRIM(Email), '') IS NOT NULL
  AND TRIM(Email) NOT REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';

-- Aplikasi baru memerlukan atasan. Tidak ada kolom atasan di sumber ini.
SELECT COUNT(*) AS employees_needing_explicit_manager_mapping
FROM gamstrlv2.tpegawai;

-- Master organisasi lama tanpa primary key: cek nama kosong/duplikasi.
SELECT 'tdepartemen' AS source_table, COUNT(*) AS rows_total,
       COALESCE(SUM(NULLIF(TRIM(Departemen), '') IS NULL), 0) AS blank_names,
       COUNT(*) - COUNT(DISTINCT LOWER(TRIM(Departemen))) AS duplicate_or_null_names
FROM gamstrlv2.tdepartemen
UNION ALL
SELECT 'tjabatan', COUNT(*),
       COALESCE(SUM(NULLIF(TRIM(Jabatan), '') IS NULL), 0),
       COUNT(*) - COUNT(DISTINCT LOWER(TRIM(Jabatan)))
FROM gamstrlv2.tjabatan
UNION ALL
SELECT 'tunit', COUNT(*),
       COALESCE(SUM(NULLIF(TRIM(unit), '') IS NULL), 0),
       COUNT(*) - COUNT(DISTINCT LOWER(TRIM(unit)))
FROM gamstrlv2.tunit;

SELECT 'employee_department_not_in_master' AS finding, COUNT(*) AS rows_affected
FROM gamstrlv2.tpegawai e
WHERE NULLIF(TRIM(e.Departemen), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gamstrlv2.tdepartemen d
                  WHERE TRIM(d.Departemen) = TRIM(e.Departemen))
UNION ALL
SELECT 'employee_position_not_in_master', COUNT(*)
FROM gamstrlv2.tpegawai e
WHERE NULLIF(TRIM(e.Jabatan), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gamstrlv2.tjabatan j
                  WHERE TRIM(j.Jabatan) = TRIM(e.Jabatan))
UNION ALL
SELECT 'employee_unit_not_in_master', COUNT(*)
FROM gamstrlv2.tpegawai e
WHERE NULLIF(TRIM(e.unit), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM gamstrlv2.tunit u
                  WHERE TRIM(u.unit) = TRIM(e.unit));

-- Histori cuti: tidak tersedia status/approval, sehingga tidak boleh auto-debit.
SELECT COUNT(*) AS legacy_leave_rows,
       COALESCE(SUM(NULLIF(TRIM(NIP), '') IS NULL), 0) AS leave_without_nip,
       COALESCE(SUM(TglCuti IS NULL OR tglselesai IS NULL), 0) AS missing_dates,
       COALESCE(SUM(tglselesai < TglCuti), 0) AS reversed_dates,
       COALESCE(SUM(CAST(TglCuti AS CHAR) = '0000-00-00'
                    OR CAST(tglselesai AS CHAR) = '0000-00-00'), 0) AS zero_dates
FROM gamstrlv2.tcuti;

SELECT COUNT(*) AS orphan_legacy_leave_rows
FROM gamstrlv2.tcuti c
WHERE NOT EXISTS (SELECT 1 FROM gamstrlv2.tpegawai e WHERE TRIM(e.NIP) = TRIM(c.NIP));

-- Absensi lama bersifat ringkasan: jangan membuat tanggal fiktif dari total.
SELECT COUNT(*) AS attendance_summary_rows,
       COALESCE(SUM(NULLIF(TRIM(periode), '') IS NULL), 0) AS missing_period,
       COALESCE(SUM(COALESCE(Abs_A, 0) < 0 OR COALESCE(Abs_S, 0) < 0
                    OR COALESCE(Abs_I, 0) < 0 OR COALESCE(Abs_T, 0) < 0), 0) AS negative_counts
FROM gamstrlv2.tpegawaiabsen;

SELECT COUNT(*) AS orphan_attendance_summary_rows
FROM gamstrlv2.tpegawaiabsen a
WHERE NOT EXISTS (SELECT 1 FROM gamstrlv2.tpegawai e WHERE TRIM(e.NIP) = TRIM(a.NIP));

-- Tidak membaca kolom Password. Jangan menyalin password lama secara otomatis.
SELECT COUNT(*) AS user_rows,
       COALESCE(SUM(NULLIF(TRIM(Username), '') IS NULL), 0) AS blank_usernames
FROM gamstrlv2.tlogin;

SELECT COUNT(*) AS normalized_username_collision_groups
FROM (
  SELECT LOWER(TRIM(Username)) AS normalized_username
  FROM gamstrlv2.tlogin
  GROUP BY normalized_username
  HAVING COUNT(*) > 1
) d;

SELECT COUNT(*) AS goods_rows,
       COALESCE(SUM(NULLIF(TRIM(NamaBarang), '') IS NULL), 0) AS goods_without_name,
       COALESCE(SUM(Harga < 0), 0) AS negative_price,
       COALESCE(SUM(Jumlah < 0), 0) AS negative_stock
FROM gamstrlv2.tbarang;

-- Encoding: daftar definisi kolom agar DBA dapat mengaudit konversi latin1.
-- Metadata dan hitungan ASCII di bawah TIDAK menjamin tidak ada mojibake.
-- Uji hasil konversi nama/alamat secara terkontrol pada salinan lokal; jangan
-- mengekspor data pribadi atau menggunakan konversi ganda tanpa sampel verifikasi.
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE,
       CHARACTER_SET_NAME, COLLATION_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'gamstrlv2'
  AND CHARACTER_SET_NAME IS NOT NULL
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT COALESCE(SUM(LENGTH(CONVERT(Nama USING utf8mb4))
                    <> CHAR_LENGTH(CONVERT(Nama USING utf8mb4))), 0)
       AS names_with_non_ascii_after_conversion
FROM gamstrlv2.tpegawai;
