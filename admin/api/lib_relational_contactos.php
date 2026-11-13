<?php
declare(strict_types=1);

/**
 * paciente_contactos — teléfonos/emails multi-valor.
 *
 * Modelo:
 * - Un es_principal=1 por (paciente_id, tipo); varios secundarios permitidos.
 * - Sin UNIQUE global de valor_normalizado (teléfonos de familia).
 * - Sync desde pacientes.telefono/email (principal) y contacto_* (secundarios).
 *
 * Enganche: kinesica_pacientes_upsert / update (safe, no rompe el request).
 * Backfill: backfill_relational.php --only=paciente_contactos
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/lib_migrations.php';

require_once __DIR__ . '/lib_relational_contactos_contactos_ready.php';
require_once __DIR__ . '/lib_relational_contactos_backfill_paciente_contactos.php';
