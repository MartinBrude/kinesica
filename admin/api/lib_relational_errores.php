<?php
declare(strict_types=1);

/**
 * Reporte de Errores relacional — dual-write con JSON.
 *
 * Tabla: migrations/015_errores.php
 * IO: errores_io.php (load DB-first si hay filas; save espeja JSON+DB).
 * Backfill CLI: --only=errores
 */

require_once __DIR__ . '/lib_migrations.php';

require_once __DIR__ . '/lib_relational_errores_errores_table.php';
require_once __DIR__ . '/lib_relational_errores_error_upsert.php';
