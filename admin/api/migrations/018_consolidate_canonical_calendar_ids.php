<?php
declare(strict_types=1);

/**
 * Migración 018 — Consolidación canónica de calendar_event_id.
 * Unifica identificadores de Google Calendar eliminando el sufijo '@google.com'
 * tanto en 'turnos' como en 'recordatorio_eventos', fusionando duplicados.
 */

return [
    'id' => '018_consolidate_canonical_calendar_ids',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__, 3) . '/scripts/consolidate-canonical-calendar-ids.php';
        kinesica_consolidate_calendar_ids($pdo, true);
    },
];
