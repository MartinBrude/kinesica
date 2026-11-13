<?php
declare(strict_types=1);

/**
 * Despacho try/catch de calendar_backup.
 */
try {
    require __DIR__ . '/calendar_backup_action_push_snapshot.php';
    require __DIR__ . '/calendar_backup_action_sync_client_slots.php';
    require __DIR__ . '/calendar_backup_action_slots.php';
    require __DIR__ . '/calendar_backup_action_book.php';

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Acción no reconocida']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error interno en el servicio de respaldo']);
}
