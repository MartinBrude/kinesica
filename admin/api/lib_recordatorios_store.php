<?php
declare(strict_types=1);

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/calendar_event_parse.php';

/**
 * Almacén durable de outcomes de recordatorios WhatsApp 24h (ingest desde n8n).
 * Solo se AGREGA: claves únicas = idempotencia ante reintentos del workflow.
 */

const RECORDATORIOS_MAX_BATCH = 200;
const RECORDATORIOS_STATUSES = ['pending', 'sent', 'sent_email', 'failed', 'missing_phone', 'skipped', 'run_skipped'];
const RECORDATORIOS_SKIP_REASONS = [
    'clara_inactive', 'cancelled', 'blocked', 'waitlist', 'non_appointment',
    'duplicate', 'not_tomorrow', 'already_sent', 'too_soon', 'past_appointment',
    'same_day_catchup', 'other',
];

/**
 * True si este calendar_event_id ya tuvo un envío exitoso (WA o email).
 * Usado por catch-up same-day para garantizar 1 solo recordatorio por turno.
 */

require_once __DIR__ . '/lib_recordatorios_store_recordatorios_was_sent_for_event.php';
require_once __DIR__ . '/lib_recordatorios_store_recordatorios_normalize_item.php';
require_once __DIR__ . '/lib_recordatorios_store_recordatorios_store_items.php';
