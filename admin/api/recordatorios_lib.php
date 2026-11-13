<?php
declare(strict_types=1);

/**
 * Normaliza teléfono vía fuente de verdad compartida (no argentiniza extranjeros).
 */

require_once __DIR__ . '/recordatorios_lib_recordatorios_normalize_phone_input.php';
require_once __DIR__ . '/recordatorios_lib_recordatorios_persist_directory_contact.php';
require_once __DIR__ . '/recordatorios_lib_recordatorios_request_secret.php';
