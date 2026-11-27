<?php
declare(strict_types=1);

/**
 * One-shot: limpia fichas basura creadas por probes de confirmación WA
 * (teléfonos 34658444936–34658444942) y restaura "Martín Brude" canónico.
 *
 * GET /api/pacientes-cleanup-probe-dupes.php?k=KIN_CLEAN_BRUDE_20261127
 * Borrar este archivo tras usarlo.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_GET['k'] ?? '') !== 'KIN_CLEAN_BRUDE_20261127') {
    http_response_code(404);
    echo json_encode(['ok' => false]);
    exit;
}

require_once dirname(__DIR__) . '/admin/api/lib.php';
require_once dirname(__DIR__) . '/admin/api/lib_relational_integrity.php';
require_once dirname(__DIR__) . '/admin/api/pacientes_helpers_search_key.php';

$pdo = db();
$junkPhones = [
    '34658444936',
    '34658444937',
    '34658444938',
    '34658444939',
    '34658444940',
    '34658444941',
    '34658444942',
];
$keepPhone = '34658444935';
$keepDni = '34534337';

$alive = function_exists('kinesica_rel_pacientes_not_deleted_sql')
    ? kinesica_rel_pacientes_not_deleted_sql($pdo)
    : '1=1';

$softDeleted = [];
$renamed = [];
$kept = null;

// 1) Soft-delete junk phones (probe numbers).
$placeholders = implode(',', array_fill(0, count($junkPhones), '?'));
$stmt = $pdo->prepare("SELECT id, nombre_completo, telefono, dni FROM pacientes WHERE {$alive} AND telefono IN ({$placeholders})");
$stmt->execute($junkPhones);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
foreach ($rows as $row) {
    $id = (int) ($row['id'] ?? 0);
    if ($id <= 0) {
        continue;
    }
    $res = kinesica_rel_paciente_soft_delete($pdo, $id);
    $softDeleted[] = [
        'id' => $id,
        'nombre' => $row['nombre_completo'] ?? '',
        'telefono' => $row['telefono'] ?? '',
        'ok' => !empty($res['ok']),
        'message' => $res['message'] ?? null,
    ];
}

// 2) Soft-delete other "Martín Brude" without DNI/keep phone (name clones).
$stmt = $pdo->prepare(
    "SELECT id, nombre_completo, telefono, dni FROM pacientes
     WHERE {$alive}
       AND (
         LOWER(nombre_completo) LIKE '%brude%'
         OR LOWER(CONCAT(IFNULL(nombre,''),' ',IFNULL(apellido,''))) LIKE '%brude%'
       )"
);
$stmt->execute();
$brudeRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

foreach ($brudeRows as $row) {
    $id = (int) ($row['id'] ?? 0);
    $tel = clean_phone_number((string) ($row['telefono'] ?? ''));
    $dni = preg_replace('/\D+/', '', (string) ($row['dni'] ?? '')) ?: '';
    $name = trim((string) ($row['nombre_completo'] ?? ''));

    if ($tel === $keepPhone || $dni === $keepDni) {
        // Canonical keep — fix name if it was renamed to "Test".
        if ($id > 0 && (strcasecmp($name, 'Test') === 0 || $name === '' || !preg_match('/brude/i', $name))) {
            $pdo->prepare(
                'UPDATE pacientes SET
                    nombre = :nom,
                    apellido = :ape,
                    nombre_completo = :full,
                    nombre_pila = :pila,
                    telefono = :tel,
                    dni = COALESCE(NULLIF(dni, \"\"), :dni)
                 WHERE id = :id'
            )->execute([
                'nom' => 'Martín',
                'ape' => 'Brude',
                'full' => 'Martín Brude',
                'pila' => 'Martín',
                'tel' => $keepPhone,
                'dni' => $keepDni,
                'id' => $id,
            ]);
            $renamed[] = ['id' => $id, 'from' => $name, 'to' => 'Martín Brude', 'telefono' => $keepPhone];
        }
        $kept = [
            'id' => $id,
            'nombre' => 'Martín Brude',
            'telefono' => $keepPhone,
            'dni' => $dni !== '' ? $dni : $keepDni,
        ];
        continue;
    }

    // Extra Brude clones without the canonical phone/DNI → soft-delete.
    if ($id > 0 && preg_match('/brude/i', $name)) {
        $already = false;
        foreach ($softDeleted as $sd) {
            if ((int) $sd['id'] === $id) {
                $already = true;
                break;
            }
        }
        if (!$already) {
            $res = kinesica_rel_paciente_soft_delete($pdo, $id);
            $softDeleted[] = [
                'id' => $id,
                'nombre' => $name,
                'telefono' => $tel,
                'ok' => !empty($res['ok']),
                'message' => $res['message'] ?? null,
                'reason' => 'brude_clone',
            ];
        }
    }
}

// 3) If canonical missing, revive/create from soft-deleted keep phone.
if ($kept === null) {
    $find = $pdo->prepare('SELECT id, nombre_completo, telefono, dni, deleted_at FROM pacientes WHERE telefono = :tel ORDER BY id ASC LIMIT 1');
    $find->execute(['tel' => $keepPhone]);
    $row = $find->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $id = (int) $row['id'];
        $pdo->prepare(
            'UPDATE pacientes SET
                deleted_at = NULL,
                nombre = :nom,
                apellido = :ape,
                nombre_completo = :full,
                nombre_pila = :pila,
                dni = COALESCE(NULLIF(dni, \"\"), :dni)
             WHERE id = :id'
        )->execute([
            'nom' => 'Martín',
            'ape' => 'Brude',
            'full' => 'Martín Brude',
            'pila' => 'Martín',
            'dni' => $keepDni,
            'id' => $id,
        ]);
        $kept = ['id' => $id, 'nombre' => 'Martín Brude', 'telefono' => $keepPhone, 'dni' => $keepDni, 'revived' => true];
        $renamed[] = ['id' => $id, 'from' => $row['nombre_completo'] ?? '', 'to' => 'Martín Brude', 'revived' => true];
    }
}

// Remaining active Brude-like after cleanup.
$stmt = $pdo->prepare(
    "SELECT id, nombre_completo, telefono, dni FROM pacientes
     WHERE {$alive}
       AND (
         LOWER(nombre_completo) LIKE '%brude%'
         OR telefono = :tel
         OR REPLACE(IFNULL(dni,''), ' ', '') = :dni
       )
     ORDER BY id ASC"
);
$stmt->execute(['tel' => $keepPhone, 'dni' => $keepDni]);
$remaining = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

echo json_encode([
    'ok' => true,
    'kept' => $kept,
    'soft_deleted' => $softDeleted,
    'renamed' => $renamed,
    'remaining' => $remaining,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
