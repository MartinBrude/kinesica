<?php
declare(strict_types=1);

/**
 * Puente columnas relacionales en fichas (migraciones 002/004).
 * Idempotente (ADD IF MISSING). No se apaga: red de seguridad productiva.
 */

require_once __DIR__ . '/fichas_ops_fichas_ensure_rel_columns.php';
require_once __DIR__ . '/fichas_ops_fichas_save_record.php';
