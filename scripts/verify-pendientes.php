<?php
declare(strict_types=1);

/**
 * Tests de tareas pendientes del admin (validación, edición de texto, persistencia y contratos UI).
 * Ejecución: php scripts/verify-pendientes.php
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/pendientes_io.php';

$n = 0;
function check(bool $cond, string $msg): void
{
    global $n;
    if (!$cond) {
        fwrite(STDERR, "FAIL: {$msg}\n");
        exit(1);
    }
    $n++;
}

// 1. Validación de título
$vEmpty = kinesica_pendientes_validate_titulo('');
check(!$vEmpty['ok'], 'título vacío rechazado');

$vSpaces = kinesica_pendientes_validate_titulo("   \t\n  ");
check(!$vSpaces['ok'], 'título con solo espacios rechazado');

$exact255 = str_repeat('á', 255);
$v255 = kinesica_pendientes_validate_titulo($exact255);
check($v255['ok'] && $v255['titulo'] === $exact255, '255 caracteres UTF-8 con acento aceptados');

$over255 = str_repeat('á', 256);
$v256 = kinesica_pendientes_validate_titulo($over255);
check(!$v256['ok'], '256 caracteres UTF-8 rechazados');

$vTrim = kinesica_pendientes_validate_titulo('  Actualizar precios de sesiones  ');
check($vTrim['ok'] && $vTrim['titulo'] === 'Actualizar precios de sesiones', 'título recortado correctamente');

// 2. Edición de título en memoria (pendiente y resuelto)
$fixtures = [
    [
        'id' => 'pend_a',
        'titulo' => 'Texto original A',
        'estado' => 'pendiente',
        'prioridad' => 1,
        'created_at' => '2026-03-20T12:00:00Z',
        'created_by' => 'martin',
        'resolved_at' => null,
        'resolved_by' => null,
    ],
    [
        'id' => 'pend_b',
        'titulo' => 'Texto original B',
        'estado' => 'pendiente',
        'prioridad' => 2,
        'created_at' => '2026-03-21T12:00:00Z',
        'created_by' => 'norberto',
        'resolved_at' => null,
        'resolved_by' => null,
    ],
    [
        'id' => 'pend_c',
        'titulo' => 'Texto resuelto C',
        'estado' => 'resuelto',
        'prioridad' => 0,
        'created_at' => '2026-03-19T12:00:00Z',
        'created_by' => 'martin',
        'resolved_at' => '2026-03-22T15:00:00Z',
        'resolved_by' => 'norberto',
    ],
];

$resOpen = kinesica_pendientes_update_titulo($fixtures, 'pend_b', 'Texto editado B', 'norberto');
check($resOpen !== null, 'edición de pendiente existente devuelve resultado');
check($resOpen['pendiente']['titulo'] === 'Texto editado B', 'título actualizado');
check($resOpen['pendiente']['prioridad'] === 2, 'prioridad preservada tras edición');
check($resOpen['pendiente']['estado'] === 'pendiente', 'estado pendiente preservado');
check($resOpen['pendiente']['created_by'] === 'norberto', 'created_by preservado');
check(($resOpen['pendiente']['updated_by'] ?? '') === 'norberto', 'updated_by registrado');
check(!empty($resOpen['pendiente']['updated_at']), 'updated_at registrado');
check($resOpen['pendientes'][0]['titulo'] === 'Texto original A', 'otros ítems intactos');

$resResolved = kinesica_pendientes_update_titulo($resOpen['pendientes'], 'pend_c', 'Texto resuelto editado C', '');
check($resResolved !== null, 'edición de ítem resuelto permitida');
check($resResolved['pendiente']['estado'] === 'resuelto', 'estado resuelto preservado');
check($resResolved['pendiente']['prioridad'] === 0, 'prioridad 0 preservada en resuelto');
check($resResolved['pendiente']['resolved_at'] === '2026-03-22T15:00:00Z', 'resolved_at preservado');
check(($resResolved['pendiente']['updated_by'] ?? '') === 'admin', 'fallback actor admin');

$resMissing = kinesica_pendientes_update_titulo($fixtures, 'pend_inexistente', 'Algo', 'martin');
check($resMissing === null, 'ID inexistente devuelve null');

// 3. Roundtrip de persistencia (save + load preserva updated_at/updated_by sin alterar datos locales)
$runtimeFile = kinesica_pendientes_runtime_file();
$hadRuntime = is_file($runtimeFile);
$backupRaw = $hadRuntime ? file_get_contents($runtimeFile) : null;

try {
    $normalized = kinesica_pendientes_normalize_priorities($resResolved['pendientes']);
    kinesica_pendientes_save($normalized);
    $reloaded = kinesica_pendientes_load();

    check(count($reloaded) === 3, 'roundtrip conserva cantidad de ítems');
    check($reloaded[1]['id'] === 'pend_b' && $reloaded[1]['titulo'] === 'Texto editado B', 'roundtrip conserva título editado');
    check(($reloaded[1]['updated_by'] ?? '') === 'norberto', 'roundtrip conserva updated_by');
    check(!empty($reloaded[1]['updated_at']), 'roundtrip conserva updated_at');
    check($reloaded[2]['id'] === 'pend_c' && $reloaded[2]['titulo'] === 'Texto resuelto editado C', 'roundtrip conserva resuelto editado');
} finally {
    if ($hadRuntime && $backupRaw !== false && $backupRaw !== null) {
        file_put_contents($runtimeFile, $backupRaw);
    } elseif (!$hadRuntime && is_file($runtimeFile)) {
        @unlink($runtimeFile);
    }
}

// 4. Contratos de endpoint y UI
$apiPhp = (string) file_get_contents($root . '/admin/api/pendientes.php');
check(str_contains($apiPhp, "\$action === 'update'"), 'pendientes.php soporta action=update');
check(str_contains($apiPhp, 'kinesica_pendientes_update_titulo'), 'pendientes.php usa helper de actualización');

$html = (string) file_get_contents($root . '/admin/index.html');
check(str_contains($html, 'id="admin-pendiente-posicion-group"'), 'index.html incluye wrapper de prioridad inicial');

$modalJs = (string) file_get_contents($root . '/admin/modules/admin-pendientes-modal.js');
check(str_contains($modalJs, 'export function openEditPendienteModal'), 'modal exporta openEditPendienteModal');
check(str_contains($modalJs, 'action: "update"'), 'modal envía action update');

$renderJs = (string) file_get_contents($root . '/admin/modules/admin-pendientes-render.js');
check(str_contains($renderJs, 'onEdit?.(item)'), 'render conecta botón Editar con onEdit');
check(str_contains($renderJs, 'btn-prof-edit'), 'render usa estilo consistente de botón Editar');

// Alineación de ?v= para evitar instancias duplicadas de módulos ES
$panelJs = (string) file_get_contents($root . '/admin/modules/admin-panel.js');
$tabsJs = (string) file_get_contents($root . '/admin/modules/app-tabs.js');
preg_match('/admin-pendientes\.js\?v=(\d+)/', $panelJs, $mPanel);
preg_match('/admin-pendientes\.js\?v=(\d+)/', $tabsJs, $mTabs);
check(!empty($mPanel[1]) && $mPanel[1] === ($mTabs[1] ?? ''), 'versión de admin-pendientes.js alineada en admin-panel y app-tabs');

echo "verify-pendientes: ok ({$n} checks)\n";
