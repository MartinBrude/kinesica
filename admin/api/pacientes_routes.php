<?php
declare(strict_types=1);

/**
 * Rutas pacientes.php.
 */
try {
    $data = null;
    $auth = authenticate_request($data);
    $pdo = db();
    ensure_pacientes_tables($pdo);
    // Mantenimiento pesado (dedupe/sync/indistintos) NO corre en cada request:
    // está throttled dentro de ensure_pacientes_tables y también vía action=deduplicate.
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    require __DIR__ . '/pacientes_routes_get.php';
    require __DIR__ . '/pacientes_routes_post.php';
    require __DIR__ . '/pacientes_routes_put_delete.php';

    json_out(405, ['status' => 'error', 'message' => 'Método HTTP no permitido']);
} catch (Throwable $e) {
    error_log('kinesica admin pacientes.php error: ' . $e->getMessage());
    // REL: FK/UNIQUE → 409/422 sin SQL crudo (lib_relational_integrity.php).
    require_once __DIR__ . '/lib_relational_integrity.php';
    if (kinesica_rel_json_out_if_integrity($e)) {
        // exited via json_out
    }
    json_out(500, ['status' => 'error', 'message' => 'Error al procesar pacientes: ' . $e->getMessage()]);
}
