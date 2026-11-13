<?php
declare(strict_types=1);

/**
 * Catch-up de recordatorios el mismo día del turno.
 * Solo envía si aún no hubo sent/sent_email para ese calendar_event_id.
 */

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/campana_turnos.php';
require_once __DIR__ . '/lib_whatsapp_template.php';
require_once __DIR__ . '/lib_mail.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

/** Margen mínimo (minutos) entre ahora y el inicio del turno para enviar catch-up. */
const RECORDATORIOS_SAMEDAY_MIN_LEAD_MINUTES = 60;

/**
 * Modo del parámetro {{3}} de la plantilla Meta recordatorio_turno_kinesica.
 * - legacy: plantilla dice "mañana a las {{3}}" → {{3}} = "16:00 hs" (catch-up WA no apto)
 * - when_phrase: plantilla dice "programada para {{3}}" → {{3}} = "hoy|mañana a las 16:00 hs"
 */

require_once __DIR__ . '/lib_recordatorios_sameday_recordatorios_template_when_mode.php';
require_once __DIR__ . '/lib_recordatorios_sameday_recordatorios_sameday_process_appointment.php';
require_once __DIR__ . '/lib_recordatorios_sameday_recordatorios_sameday_run.php';
