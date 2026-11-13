<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/calendar_event_parse.php';

const RECORDATORIOS_DEFAULT_DAYS = 14;

require_once __DIR__ . '/lib_recordatorios_view_recordatorios_tz.php';
require_once __DIR__ . '/lib_recordatorios_view_recordatorios_is_appointment_past.php';
require_once __DIR__ . '/lib_recordatorios_view_recordatorios_load_view.php';
