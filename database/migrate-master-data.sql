-- MIGRASI MASTER TERKONTROL: gamstrlv2 → gamstrlv2_next, MySQL 8.0.16+.
-- Jalankan mysql8-schema.sql 1.1.0 dahulu, lalu legacy-preflight.sql pada salinan uji.
-- Target/staging 1.0.1 harus menjalankan mysql8-upgrade-1.1.0.sql lebih dahulu.
-- Sumber dan target harus dapat diakses di server MySQL yang sama. Aplikasi
-- hosted tetap memakai D1; file ini tidak mengubah koneksi aplikasi hosted.
--
-- DEFAULT: STAGING + VALIDASI SAJA. @migration_apply = 0 tidak mengisi employees.
-- Untuk commit: HR meninjau staging, lalu CALL migrate_legacy_master_v1(batch, 1).
-- Procedure menggunakan transaksi dan ROLLBACK otomatis jika ada kesalahan.
-- Jalankan dengan akun DBA terbatas source=SELECT dan target=DDL/DML/ROUTINE.
-- Jangan menggunakan --force. Hentikan penulisan source/target saat cut-over.
-- Tidak ada pembacaan Password, pembuatan auth_subject, impor saldo, approval
-- histori, atau pembuatan tanggal sakit/alpa dari rekap.

USE `gamstrlv2_next`;
SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET @migration_batch = 'gamstrlv2-master-v1';
SET @migration_apply = 0;

-- Payload menyimpan hanya atribut yang diperlukan untuk rekonsiliasi master.
-- Nilai koreksi HR terpisah dari source_payload sehingga sumber asli terlacak.
CREATE TABLE IF NOT EXISTS `legacy_employee_stage` (
  `batch_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `source_nip` varchar(50) COLLATE utf8mb4_bin NOT NULL,
  `source_payload` json NOT NULL,
  `source_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_seen_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `nip` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `name` text NOT NULL,
  `email` varchar(254) COLLATE utf8mb4_bin NOT NULL,
  `department` text NOT NULL,
  `position` text NOT NULL,
  `unit_source` text NULL,
  `phone_source` text NULL,
  `employment_status_source` text NULL,
  `join_date` date NULL,
  `exit_date_source` varchar(10) NULL,
  `manager_nip` varchar(191) COLLATE utf8mb4_bin NULL,
  `manager_waived` tinyint NOT NULL DEFAULT 0,
  `manager_waiver_reason` text NULL,
  `target_role` varchar(16) NOT NULL DEFAULT 'employee',
  `target_work_unit_id` varchar(191) COLLATE utf8mb4_bin NULL,
  `target_workdays` varchar(32) NOT NULL DEFAULT '1,2,3,4,5',
  `target_active` tinyint NULL,
  `reviewed` tinyint NOT NULL DEFAULT 0,
  `reviewed_by` varchar(191) NULL,
  `reviewed_at` datetime(3) NULL,
  `validation_errors` text NOT NULL DEFAULT ('REVIEW_REQUIRED'),
  `first_seen_at` datetime(3) NOT NULL,
  `last_seen_at` datetime(3) NOT NULL,
  PRIMARY KEY (`batch_id`, `source_nip`),
  KEY `legacy_stage_nip_idx` (`nip`),
  CONSTRAINT `legacy_stage_reviewed` CHECK (`reviewed` IN (0,1)),
  CONSTRAINT `legacy_stage_active` CHECK (`target_active` IS NULL OR `target_active` IN (0,1)),
  CONSTRAINT `legacy_stage_manager_waived` CHECK (`manager_waived` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `legacy_employee_map` (
  `source_nip` varchar(50) COLLATE utf8mb4_bin NOT NULL,
  `target_employee_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `migration_batch` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `migrated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`source_nip`),
  UNIQUE KEY `legacy_map_employee_unique` (`target_employee_id`),
  CONSTRAINT `legacy_map_employee_fk` FOREIGN KEY (`target_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `legacy_leave_history_stage` (
  `batch_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `source_idcuti` int NOT NULL,
  `source_payload` json NOT NULL,
  `source_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_seen_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `reconciliation_status` varchar(32) NOT NULL DEFAULT 'pending_hr_review',
  `reconciliation_note` text NULL,
  `captured_at` datetime(3) NOT NULL,
  PRIMARY KEY (`batch_id`, `source_idcuti`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Source tidak memiliki PK. Fingerprint + source_occurrences mempertahankan
-- banyaknya baris identik untuk atribut rekap yang diambil; bukan tanggal harian.
CREATE TABLE IF NOT EXISTS `legacy_absence_summary_stage` (
  `batch_id` varchar(191) COLLATE utf8mb4_bin NOT NULL,
  `row_fingerprint` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `source_payload` json NOT NULL,
  `source_occurrences` int NOT NULL,
  `source_seen_occurrences` int NOT NULL,
  `reconciliation_status` varchar(32) NOT NULL DEFAULT 'pending_hr_review',
  `captured_at` datetime(3) NOT NULL,
  PRIMARY KEY (`batch_id`, `row_fingerprint`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Simpan snapshot baru. Replay tidak menimpa koreksi HR atau snapshot pertama.
-- Jika hash source berubah, SOURCE_CHANGED akan memblokir import row tersebut.
-- Gunakan batch baru setelah rekonsiliasi perubahan source; jangan mengubah hash
-- agar sebuah row lolos validasi tanpa peninjauan.
INSERT INTO legacy_employee_stage (
  batch_id, source_nip, source_payload, source_hash, source_seen_hash,
  nip, name, email, department, position, unit_source, phone_source,
  employment_status_source, join_date, exit_date_source, first_seen_at, last_seen_at
)
SELECT @migration_batch, src.NIP, src.payload,
       SHA2(CAST(src.payload AS CHAR CHARACTER SET utf8mb4), 256),
       SHA2(CAST(src.payload AS CHAR CHARACTER SET utf8mb4), 256),
       TRIM(CONVERT(src.NIP USING utf8mb4)),
       TRIM(COALESCE(CONVERT(src.Nama USING utf8mb4), '')),
       LOWER(TRIM(COALESCE(CONVERT(src.Email USING utf8mb4), ''))),
       TRIM(COALESCE(CONVERT(src.Departemen USING utf8mb4), '')),
       TRIM(COALESCE(CONVERT(src.Jabatan USING utf8mb4), '')),
       CONVERT(src.unit USING utf8mb4), CONVERT(src.Telp USING utf8mb4),
       CONVERT(src.StatusKerja USING utf8mb4),
       CASE
         WHEN src.TglMasuk IS NULL THEN NULL
         WHEN CAST(src.TglMasuk AS CHAR) NOT REGEXP '^[12][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN NULL
         WHEN CAST(RIGHT(CAST(src.TglMasuk AS CHAR), 2) AS UNSIGNED)
              > DAY(LAST_DAY(CONCAT(LEFT(CAST(src.TglMasuk AS CHAR), 7), '-01'))) THEN NULL
         ELSE STR_TO_DATE(CAST(src.TglMasuk AS CHAR), '%Y-%m-%d')
       END,
       CAST(src.TglKeluar AS CHAR), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
FROM (
  SELECT e.NIP, e.Nama, e.Email, e.Departemen, e.Jabatan, e.unit, e.Telp,
         e.StatusKerja, e.TglMasuk, e.TglKeluar,
         JSON_OBJECT('NIP', CONVERT(e.NIP USING utf8mb4),
                     'Nama', CONVERT(e.Nama USING utf8mb4),
                     'Email', CONVERT(e.Email USING utf8mb4),
                     'Departemen', CONVERT(e.Departemen USING utf8mb4),
                     'Jabatan', CONVERT(e.Jabatan USING utf8mb4),
                     'unit', CONVERT(e.unit USING utf8mb4),
                     'Telp', CONVERT(e.Telp USING utf8mb4),
                     'StatusKerja', CONVERT(e.StatusKerja USING utf8mb4),
                     'TglMasuk', CAST(e.TglMasuk AS CHAR),
                     'TglKeluar', CAST(e.TglKeluar AS CHAR)) AS payload
  FROM gamstrlv2.tpegawai e
) src
ON DUPLICATE KEY UPDATE
  source_seen_hash = VALUES(source_seen_hash),
  last_seen_at = VALUES(last_seen_at);

INSERT INTO legacy_leave_history_stage
  (batch_id, source_idcuti, source_payload, source_hash, source_seen_hash, captured_at)
SELECT @migration_batch, src.idcuti, src.payload,
       SHA2(CAST(src.payload AS CHAR CHARACTER SET utf8mb4), 256),
       SHA2(CAST(src.payload AS CHAR CHARACTER SET utf8mb4), 256), UTC_TIMESTAMP(3)
FROM (
  SELECT c.idcuti,
         JSON_OBJECT('idcuti', c.idcuti, 'NIP', CONVERT(c.NIP USING utf8mb4),
                     'departemen', CONVERT(c.departemen USING utf8mb4),
                     'unit', CONVERT(c.unit USING utf8mb4),
                     'TglCuti', CAST(c.TglCuti AS CHAR),
                     'tglselesai', CAST(c.tglselesai AS CHAR),
                     'pengganti', CONVERT(c.pengganti USING utf8mb4),
                     'keterangan', CONVERT(c.keterangan USING utf8mb4)) AS payload
  FROM gamstrlv2.tcuti c
) src
ON DUPLICATE KEY UPDATE source_seen_hash = VALUES(source_seen_hash);

INSERT INTO legacy_absence_summary_stage
  (batch_id, row_fingerprint, source_payload, source_occurrences,
   source_seen_occurrences, captured_at)
SELECT @migration_batch,
       SHA2(CAST(ANY_VALUE(src.payload) AS CHAR CHARACTER SET utf8mb4), 256),
       ANY_VALUE(src.payload), COUNT(*), COUNT(*), UTC_TIMESTAMP(3)
FROM (
  SELECT JSON_OBJECT('NIP', CONVERT(a.NIP USING utf8mb4),
                     'Departemen', CONVERT(a.Departemen USING utf8mb4),
                     'unit', CONVERT(a.unit USING utf8mb4),
                     'periode', CONVERT(a.periode USING utf8mb4),
                     'Abs_A', a.Abs_A, 'Abs_S', a.Abs_S,
                     'Abs_I', a.Abs_I, 'Abs_T', a.Abs_T) AS payload
  FROM gamstrlv2.tpegawaiabsen a
) src
GROUP BY BINARY CAST(src.payload AS CHAR CHARACTER SET utf8mb4)
ON DUPLICATE KEY UPDATE source_seen_occurrences = VALUES(source_seen_occurrences);

-- Metadata routine target dapat dibuat ulang; tidak menyentuh object sumber.
DROP PROCEDURE IF EXISTS migrate_legacy_master_v1;
DELIMITER $$
CREATE PROCEDURE migrate_legacy_master_v1(IN p_batch varchar(191), IN p_apply tinyint)
main: BEGIN
  DECLARE v_missing_managers int DEFAULT 0;
  DECLARE v_cycles int DEFAULT 0;
  DECLARE v_candidates int DEFAULT 0;
  DECLARE v_inserted int DEFAULT 0;
  DECLARE v_migration_now datetime(3);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_apply NOT IN (0,1) OR p_apply IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'p_apply must be 0 (preview) or 1 (commit).';
  END IF;
  SET v_migration_now = UTC_TIMESTAMP(3);
  START TRANSACTION;

  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_dup_nips;
  CREATE TEMPORARY TABLE tmp_legacy_dup_nips AS
  SELECT LOWER(TRIM(nip)) AS normalized_nip
  FROM legacy_employee_stage WHERE batch_id = p_batch
  GROUP BY LOWER(TRIM(nip)) HAVING COUNT(*) > 1;

  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_dup_emails;
  CREATE TEMPORARY TABLE tmp_legacy_dup_emails AS
  SELECT LOWER(TRIM(email)) AS normalized_email
  FROM legacy_employee_stage WHERE batch_id = p_batch AND TRIM(email) <> ''
  GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1;

  UPDATE legacy_employee_stage s
  LEFT JOIN tmp_legacy_dup_nips dn ON dn.normalized_nip = LOWER(TRIM(s.nip))
  LEFT JOIN tmp_legacy_dup_emails de ON de.normalized_email = LOWER(TRIM(s.email))
  LEFT JOIN legacy_employee_map lm ON lm.source_nip = s.source_nip
  LEFT JOIN employees en ON en.nip = TRIM(s.nip)
  LEFT JOIN employees ee ON ee.email = LOWER(TRIM(s.email))
  LEFT JOIN work_units wu ON wu.id = s.target_work_unit_id
  LEFT JOIN divisions dv ON dv.id = wu.division_id
  SET s.validation_errors = CONCAT_WS(';',
    IF(s.source_hash <> s.source_seen_hash, 'SOURCE_CHANGED', NULL),
    IF(TRIM(s.nip) = '' OR CHAR_LENGTH(TRIM(s.nip)) > 50, 'NIP_REQUIRED_MAX_50', NULL),
    IF(dn.normalized_nip IS NOT NULL, 'DUPLICATE_NORMALIZED_NIP', NULL),
    IF(TRIM(s.name) = '' OR CHAR_LENGTH(TRIM(s.name)) > 150, 'NAME_REQUIRED_MAX_150', NULL),
    IF(TRIM(s.email) NOT REGEXP '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$', 'VALID_EMAIL_REQUIRED', NULL),
    IF(de.normalized_email IS NOT NULL, 'DUPLICATE_EMAIL', NULL),
    IF(en.id IS NOT NULL AND (lm.target_employee_id IS NULL OR lm.target_employee_id <> en.id), 'EXISTING_NIP_NEEDS_RECONCILIATION', NULL),
    IF(ee.id IS NOT NULL AND (lm.target_employee_id IS NULL OR lm.target_employee_id <> ee.id), 'EXISTING_EMAIL_NEEDS_RECONCILIATION', NULL),
    IF(wu.id IS NULL OR wu.active <> 1 OR dv.active <> 1, 'ACTIVE_WORK_UNIT_REQUIRED', NULL),
    IF(TRIM(s.position) = '' OR CHAR_LENGTH(TRIM(s.position)) > 100, 'POSITION_REQUIRED_MAX_100', NULL),
    IF(s.join_date IS NULL OR YEAR(s.join_date) NOT BETWEEN 1900 AND 2200, 'VALID_JOIN_DATE_1900_2200_REQUIRED', NULL),
    IF(s.target_active IS NULL, 'ACTIVE_STATUS_REQUIRED', NULL),
    IF(BINARY s.target_role NOT IN ('admin','manager','employee'), 'INVALID_ROLE', NULL),
    IF(BINARY s.target_workdays NOT IN ('1,2,3,4,5','1,2,3,4,5,6'), 'INVALID_WORKDAYS', NULL),
    IF(NULLIF(TRIM(s.manager_nip), '') IS NULL
       AND NOT (s.manager_waived = 1 AND NULLIF(TRIM(s.manager_waiver_reason), '') IS NOT NULL), 'MANAGER_MAPPING_OR_JUSTIFIED_WAIVER_REQUIRED', NULL),
    IF(LOWER(TRIM(s.manager_nip)) = LOWER(TRIM(s.nip)), 'SELF_MANAGER_FORBIDDEN', NULL),
    IF(s.reviewed <> 1 OR NULLIF(TRIM(s.reviewed_by), '') IS NULL OR s.reviewed_at IS NULL, 'REVIEW_REQUIRED', NULL)
  )
  WHERE s.batch_id = p_batch;

  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_candidates;
  CREATE TEMPORARY TABLE tmp_legacy_candidates AS
  SELECT s.source_nip, CONCAT('legacy-emp-', SHA2(TRIM(s.nip), 256)) AS target_id,
         TRIM(s.nip) AS nip, TRIM(s.name) AS name,
         LOWER(TRIM(s.email)) AS email, wu.name AS department, s.target_work_unit_id,
         TRIM(s.position) AS position, NULLIF(TRIM(s.manager_nip), '') AS manager_nip,
         s.target_role, s.target_workdays, s.target_active, s.join_date
  FROM legacy_employee_stage s
  JOIN work_units wu ON wu.id = s.target_work_unit_id AND wu.active = 1
  JOIN divisions dv ON dv.id = wu.division_id AND dv.active = 1
  LEFT JOIN legacy_employee_map lm ON lm.source_nip = s.source_nip
  WHERE s.batch_id = p_batch AND s.validation_errors = '' AND lm.source_nip IS NULL;

  -- Satu salinan terpisah menghindari batas MySQL membuka ulang temp table.
  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_candidate_managers;
  CREATE TEMPORARY TABLE tmp_legacy_candidate_managers AS SELECT * FROM tmp_legacy_candidates;

  SELECT COUNT(*) INTO v_candidates FROM tmp_legacy_candidates;
  SELECT COUNT(*) INTO v_missing_managers
  FROM tmp_legacy_candidates c
  LEFT JOIN employees e ON e.nip = c.manager_nip
  LEFT JOIN tmp_legacy_candidate_managers m ON m.nip = c.manager_nip
  WHERE c.manager_nip IS NOT NULL
    AND ((e.id IS NULL AND m.target_id IS NULL)
         OR COALESCE(e.active, m.target_active, 0) <> 1
         OR BINARY COALESCE(e.role, m.target_role, '') NOT IN ('admin','manager'));

  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_graph;
  CREATE TEMPORARY TABLE tmp_legacy_graph (
    id varchar(191) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    manager_id varchar(191) COLLATE utf8mb4_bin NULL,
    is_new tinyint NOT NULL
  );
  INSERT INTO tmp_legacy_graph (id, manager_id, is_new)
  SELECT id, manager_id, 0 FROM employees;
  INSERT INTO tmp_legacy_graph (id, manager_id, is_new)
  SELECT c.target_id, COALESCE(e.id, m.target_id), 1
  FROM tmp_legacy_candidates c
  LEFT JOIN employees e ON e.nip = c.manager_nip
  LEFT JOIN tmp_legacy_candidate_managers m ON m.nip = c.manager_nip;

  DROP TEMPORARY TABLE IF EXISTS tmp_legacy_graph_next;
  CREATE TEMPORARY TABLE tmp_legacy_graph_next AS SELECT * FROM tmp_legacy_graph;

  WITH RECURSIVE manager_paths AS (
    SELECT id AS origin_id, id AS node_id, manager_id AS next_id,
           JSON_ARRAY(id) AS visited, 0 AS cycle_found, 0 AS depth
    FROM tmp_legacy_graph WHERE is_new = 1
    UNION ALL
    SELECT p.origin_id, g.id, g.manager_id,
           JSON_ARRAY_APPEND(p.visited, '$', g.id),
           JSON_CONTAINS(p.visited, JSON_QUOTE(g.id)), p.depth + 1
    FROM manager_paths p
    JOIN tmp_legacy_graph_next g ON g.id = p.next_id
    WHERE p.cycle_found = 0 AND p.depth < 200
  )
  SELECT COUNT(*) INTO v_cycles FROM manager_paths
  WHERE cycle_found = 1 OR (depth = 200 AND next_id IS NOT NULL);

  -- Ringkasan tidak menampilkan nama, email, source_payload, atau nilai rahasia.
  SELECT CASE WHEN lm.source_nip IS NOT NULL THEN 'already_mapped'
              WHEN s.validation_errors = '' THEN 'reviewed_candidate'
              ELSE 'staged_unresolved' END AS row_state,
         COUNT(*) AS rows_count
  FROM legacy_employee_stage s
  LEFT JOIN legacy_employee_map lm ON lm.source_nip = s.source_nip
  WHERE s.batch_id = p_batch
  GROUP BY row_state;
  SELECT validation_errors, COUNT(*) AS rows_count
  FROM legacy_employee_stage WHERE batch_id = p_batch AND validation_errors <> ''
  GROUP BY validation_errors;
  SELECT v_candidates AS new_candidates,
         v_missing_managers AS missing_inactive_unreviewed_or_staff_managers,
         v_cycles AS cyclic_or_overdeep_manager_paths;

  IF p_apply = 0 THEN
    COMMIT;
    SELECT 'PREVIEW_ONLY_NO_EMPLOYEE_INSERTED' AS result;
    LEAVE main;
  END IF;
  IF v_missing_managers > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Manager missing/inactive/unreviewed or Staff; master commit rolled back.';
  END IF;
  IF v_cycles > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Manager cycle/depth validation failed; entire master commit rolled back.';
  END IF;

  -- Seluruh calon dimasukkan dahulu, baru FK atasan dihubungkan dalam transaksi
  -- yang sama. auth_subject tetap NULL: tidak ada identitas login yang ditebak.
  INSERT INTO employees (
    id, nip, name, email, auth_subject, department, work_unit_id, position, manager_id,
    role, workdays, active, join_date, created_at, updated_at
  )
  SELECT target_id, nip, name, email, NULL, department, target_work_unit_id, position, NULL,
         target_role, target_workdays, target_active, join_date,
         v_migration_now, v_migration_now
  FROM tmp_legacy_candidates;
  SET v_inserted = ROW_COUNT();

  UPDATE employees e
  JOIN tmp_legacy_candidates c ON c.target_id = e.id
  LEFT JOIN employees manager_row ON manager_row.nip = c.manager_nip
  SET e.manager_id = manager_row.id, e.updated_at = v_migration_now;

  INSERT INTO legacy_employee_map
    (source_nip, target_employee_id, migration_batch, migrated_at)
  SELECT source_nip, target_id, p_batch, v_migration_now FROM tmp_legacy_candidates;

  COMMIT;
  SELECT 'MASTER_COMMITTED' AS result, v_inserted AS employees_inserted,
         0 AS accounts_linked, 0 AS balances_created, 0 AS historical_approvals_created;
END$$
DELIMITER ;

CALL migrate_legacy_master_v1(@migration_batch, @migration_apply);

-- PENINJAUAN HR (lakukan terkontrol; contoh template ini tidak dieksekusi):
-- 1. Review source_payload dan koreksi kolom target staging menggunakan binding
--    parameter/GUI DBA; jangan menaruh data pribadi aktual dalam repository.
-- 2. Tetapkan target_work_unit_id dari master work_units aktif (divisi diturunkan
--    dari unit), manager_nip dari NIP yang benar, target_active = 0 atau 1,
--    target_role = admin/manager/employee (employee ditampilkan sebagai Staff),
--    jadwal kerja (Senin-Jumat/Senin-Sabtu), serta tanggal masuk yang diverifikasi.
--    Setiap atasan wajib aktif DAN berlevel admin atau manager.
--    Nilai sumber department/unit_source tetap tersimpan di staging; aplikasi
--    memakai nama unit terpilih sebagai department untuk karyawan baru.
-- 3. Jika karyawan memang tidak mempunyai atasan, isi manager_waived=1 DAN
--    manager_waiver_reason. Hal ini tidak memberi hak auto-approve; aplikasi akan
--    membutuhkan jalur approver/delegasi sesuai aturan bisnis.
-- 4. Tandai reviewed=1, reviewed_by=identitas reviewer, reviewed_at=UTC_TIMESTAMP(3).
-- 5. Jalankan kembali preview: CALL migrate_legacy_master_v1('gamstrlv2-master-v1', 0);
-- 6. Setelah ringkasan sesuai: CALL migrate_legacy_master_v1('gamstrlv2-master-v1', 1);
-- 7. Replay commit tidak menimpa employees yang sudah dipetakan.
--
-- Saldo awal: import terpisah lewat fitur saldo aplikasi/adapter yang sudah
-- dipasang, berdasarkan rekonsiliasi HR. Semua histori staging tetap menunggu.
-- Role saja tidak memberi login: auth_subject ditautkan melalui proses identitas
-- terverifikasi; jangan menyalin nilai contoh atau email ke kolom auth_subject.
