<?php
declare(strict_types=1);

/**
 * Lecturas con REL_READ_IDS: preferir paciente canónico por ID.
 *
 * Si el flag está off → no-op (devuelve filas/payloads tal cual).
 * Si está on y hay paciente_id → overlay nombre/dni/tel/email desde pacientes.
 * Si falta ID → fallback legacy + línea en rel_read_fallback.jsonl.
 *
 * Usado por: fichas_ops (GET), pacientes waitlist, vistas WA/recordatorios.
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_relational_flags.php';
require_once __DIR__ . '/lib_migrations.php';

require_once __DIR__ . '/lib_relational_read_read_fallback_log_path.php';
require_once __DIR__ . '/lib_relational_read_map_ficha_rows.php';
