<?php
declare(strict_types=1);

/**
 * Backfill de IDs en filas históricas (etapa 3–4).
 *
 * - Dry-run (apply=false): solo cuenta matched/ambiguous/unmatched.
 * - Apply: UPDATE solo donde paciente_id / profesional_id IS NULL.
 * - Ambiguos no se tocan (revisión manual).
 * - No requiere REL_WRITE_IDS (resolve con ignore_flag).
 * - Orquesta también paciente_contactos y profesional_id.
 *
 * CLI: php admin/api/backfill_relational.php --dry-run|--apply [--only=...]
 *
 * Slices etapa 8 en `kinesica_rel_backfill_run`: profesionales_contactos,
 * configuraciones, gastos. Etapa 9 no añade backfill (FKs = migrate 013).
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/runbook-datos-relacionales-antigravity.md
 */

require_once __DIR__ . '/lib_relational_resolve.php';
require_once __DIR__ . '/lib_migrations.php';

/**
 * @return array{
 *   table:string,scanned:int,already_set:int,updated:int,matched:int,
 *   ambiguous:int,unmatched:int,skipped_no_column:bool,samples:list<array>
 * }
 */

require_once __DIR__ . '/lib_relational_backfill_backfill_empty_stats.php';
require_once __DIR__ . '/lib_relational_backfill_backfill_interacciones.php';
