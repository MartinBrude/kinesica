<?php
declare(strict_types=1);

/**
 * Kinésica - Motor de Respaldo de Calendario y Auditoría
 * ======================================================
 * Mantiene un espejo ligero de ocupación (busy_intervals + reservas en tránsito)
 * para responder de forma 100% transparente al paciente si Google Calendar / GAS
 * falla o da timeout, notificando exclusivamente a Norberto para auditoría.
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

const KINESICA_BACKUP_MAX_AGE_SECONDS = 86400; // 24 horas de vigencia máxima de seguridad
// Las lecturas de horarios caen al respaldo con frecuencia por timeouts/cold-start de GAS.
// No spamear por eso: la alerta externa es solo al AGENDAR en modo respaldo (auditoría).
// Opt-in de diagnóstico: KINESICA_BACKUP_READ_ALERTS=1 (máx. 1 cada 24 h).
const KINESICA_BACKUP_READ_ALERT_COOLDOWN = 86400;
const KINESICA_BACKUP_SESSION_DURATION_MIN = 60;
const KINESICA_BACKUP_SLOT_STEP_MIN = 30;
const KINESICA_BACKUP_BUFFER_HOURS = 2;
const KINESICA_BACKUP_MAX_DAYS = 60;

const KINESICA_BACKUP_DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec';

const KINESICA_BACKUP_HOLIDAYS = [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02',
    '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20',
    '2026-07-09', '2026-08-17', '2026-10-12', '2026-11-23', '2026-12-08',
    '2026-12-25', '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-24',
    '2027-03-26', '2027-04-02', '2027-05-01', '2027-05-25', '2027-06-20',
    '2027-07-09', '2027-08-16', '2027-10-11', '2027-11-20', '2027-12-08',
    '2027-12-25',
];

const KINESICA_BACKUP_DEFAULT_HOURS = [
    'norberto' => [
        '1' => [['start' => '17:30', 'end' => '19:30']],
        '2' => [['start' => '16:30', 'end' => '19:30']],
        '3' => [['start' => '09:00', 'end' => '16:30']],
        '4' => [['start' => '15:00', 'end' => '19:00']],
        '5' => [['start' => '13:30', 'end' => '19:30']],
    ],
    'maria' => [
        '1' => [['start' => '09:00', 'end' => '17:00']],
        '2' => [['start' => '09:00', 'end' => '16:00']],
        '5' => [['start' => '09:00', 'end' => '13:00']],
    ],
];

require_once __DIR__ . '/lib_calendar_backup_backup_file.php';
require_once __DIR__ . '/lib_calendar_backup_backup_compute_day_slots.php';
require_once __DIR__ . '/lib_calendar_backup_backup_notify_norberto_audit.php';
require_once __DIR__ . '/lib_calendar_backup_backup_try_push_booking_to_gas.php';
