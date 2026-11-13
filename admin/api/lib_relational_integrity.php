<?php
declare(strict_types=1);

/**
 * Integridad referencial (etapa 9).
 *
 * - Preflight: null huérfanos antes de ADD FK (mig 013).
 * - Soft-delete pacientes (ON DELETE RESTRICT en hijos).
 * - Mapeo PDO 23000 / 1451 / 1452 → respuesta API estable.
 * - Validación app cuando REL_ENFORCE_FK (IDs deben existir).
 *
 * FKs SQL viven en migrations/013_rel_integrity_fks.php (MariaDB).
 * SQLite: PRAGMA foreign_keys + schema de tests; ALTER ADD FK = no-op.
 *
 * Docs: docs/etapa9-integridad-referencial.md
 */

require_once __DIR__ . '/lib_migrations.php';
require_once __DIR__ . '/lib_relational_flags.php';

/**
 * @return list<array{table:string,column:string,parent:string,parent_column:string}>
 */

require_once __DIR__ . '/lib_relational_integrity_integrity_fk_specs.php';
require_once __DIR__ . '/lib_relational_integrity_assert_paciente_id.php';
require_once __DIR__ . '/lib_relational_integrity_integrity_apply_fks.php';
