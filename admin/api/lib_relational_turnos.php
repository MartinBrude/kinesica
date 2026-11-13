<?php
declare(strict_types=1);

/**
 * Turnos sombra (espejo local de Google Calendar).
 *
 * Tabla: migrations/006_turnos.php — UNIQUE(calendar_event_id).
 * Upsert idempotente; no pisa paciente_id/profesional_id existentes con NULL.
 * Fuentes: campaña GAS, recordatorios, booking (admin/backup), mirror GAS → turnos.php.
 * Cancelar turno marca status=cancelled y anula recordatorios pending.
 *
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

/** @var list<string> */
const KINESICA_REL_TURNO_STATUSES = ['scheduled', 'cancelled', 'completed', 'unknown'];

/** @var list<string> */
const KINESICA_REL_TURNO_SOURCES = ['gas', 'recordatorio', 'manual', 'backfill', 'booking', 'backup'];

require_once __DIR__ . '/lib_relational_turnos_turnos_ready.php';
require_once __DIR__ . '/lib_relational_turnos_upsert_turno_from_campana_row.php';
require_once __DIR__ . '/lib_relational_turnos_backfill_recordatorios_turno_id.php';
require_once __DIR__ . '/lib_relational_turnos_cancel_turno.php';
