<?php
declare(strict_types=1);

/**
 * Kinésica Admin — Listado de turnos de campaña (fuente: Google Calendar vía GAS).
 * Solo administradores.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/calendar_event_parse.php';
require_once __DIR__ . '/lib_calendar_backup.php';

require_header();
$auth = require_auth();
if (!is_admin($auth)) {
    json_out(403, ['error' => 'Acceso denegado. Se requieren permisos de administrador.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$pdo = db();
ensure_pacientes_tables($pdo);

/**
 * @return array{0:string,1:string} [from, to] YYYY-MM-DD
 */

require_once __DIR__ . '/campana_turnos_campana_default_date_range.php';
require_once __DIR__ . '/campana_turnos_campana_build_rows.php';
require_once __DIR__ . '/campana_turnos_campana_upsert_flag.php';
