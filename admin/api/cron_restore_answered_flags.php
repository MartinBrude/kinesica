<?php
declare(strict_types=1);

/**
 * One-shot CLI: reaplica answered/archived=1 desde el backup diario.
 * Seguro re-ejecutar (marcador interacciones.answered_restored.json).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_migrate.php';

$out = interacciones_restore_answered_flags_once();
fwrite(STDOUT, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
