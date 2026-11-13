<?php
declare(strict_types=1);

/**
 * Gastos relacionales (etapa 8) — dual-write con JSON.
 *
 * Tabla: migrations/012_gastos.php
 * IO: gastos_io.php (load DB-first si hay filas; save espeja JSON+DB).
 * Backfill CLI: --only=gastos
 *
 * Docs: docs/etapa8-config-gastos.md · docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

require_once __DIR__ . '/lib_relational_gastos_gastos_ready.php';
require_once __DIR__ . '/lib_relational_gastos_backfill_gastos.php';
