<?php
declare(strict_types=1);

/**
 * Suite de Tests Backend PHP: Cesión de Horarios y Cierres de Consultorio
 * Valida validación, aritmética de franjas horarias, resolución de agendas,
 * detección de turnos en conflicto y casos límite de tipo y seguridad.
 */

require_once __DIR__ . '/../admin/api/lib_horarios_cesiones.php';

function assert_true(bool $cond, string $msg): void {
    if (!$cond) {
        fwrite(STDERR, "❌ FALLO: {$msg}\n");
        exit(1);
    }
}

function assert_equals(mixed $actual, mixed $expected, string $msg): void {
    if ($actual !== $expected) {
        fwrite(STDERR, "❌ FALLO: {$msg} | Esperado: " . json_encode($expected) . " | Obtenido: " . json_encode($actual) . "\n");
        exit(1);
    }
}

echo "  --- 1. Validación de fechas ISO y formatos de hora ---\n";
assert_true(is_valid_iso_date('2026-11-25'), '2026-11-25 debe ser válida');
assert_true(is_valid_iso_date('2024-02-29'), '2024-02-29 bisiesto debe ser válida');
assert_true(!is_valid_iso_date('2026-02-29'), '2026-02-29 no bisiesto debe ser inválida');
assert_true(!is_valid_iso_date('2026-02-30'), '2026-02-30 debe ser inválida');
assert_true(!is_valid_iso_date('2026-13-01'), '2026-13-01 mes 13 debe ser inválida');
assert_true(!is_valid_iso_date(''), 'Fecha vacía debe ser inválida');
assert_true(!is_valid_iso_date('fecha-invalida'), 'String corrupto debe ser inválido');

echo "  --- 2. Validación de borradores de cesión y cierre ---\n";
// Cesión válida
$validTransfer = validate_schedule_override([
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'maria',
    'period_type' => 'single_day',
    'start_date' => '2026-11-25',
    'time_scope' => 'all_day',
    'reason' => 'Congreso anual',
]);
assert_true($validTransfer['isValid'], 'Cesión válida debe pasar validación');
assert_equals($validTransfer['normalized']['to_practitioner'], 'maria', 'to_practitioner normalizado');
assert_equals($validTransfer['normalized']['end_date'], '2026-11-25', 'end_date igual a start_date en single_day');

// Cierre total válido
$validClosure = validate_schedule_override([
    'action' => 'closure',
    'period_type' => 'date_range',
    'start_date' => '2026-12-01',
    'end_date' => '2026-12-05',
    'time_scope' => 'all_day',
]);
assert_true($validClosure['isValid'], 'Cierre total debe ser válido');
assert_equals($validClosure['normalized']['action'], 'closure', 'Acción normalizada');

// Cierre parcial con franja válida
$validPartialClosure = validate_schedule_override([
    'action' => 'closure',
    'period_type' => 'single_day',
    'start_date' => '2026-11-25',
    'time_scope' => 'custom_hours',
    'custom_range' => ['start' => '14:00', 'end' => '16:00'],
]);
assert_true($validPartialClosure['isValid'], 'Cierre parcial con 2hs válidas debe pasar');

// Rechazo: Ceder a uno mismo
$selfTransfer = validate_schedule_override([
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'norberto',
    'start_date' => '2026-11-25',
]);
assert_true(!$selfTransfer['isValid'], 'No se puede ceder a uno mismo');

// Rechazo: Fecha fin anterior a fecha inicio
$invertedRange = validate_schedule_override([
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'maria',
    'period_type' => 'date_range',
    'start_date' => '2026-11-25',
    'end_date' => '2026-11-20',
]);
assert_true(!$invertedRange['isValid'], 'Rango con fin anterior a inicio debe rechazarse');

// Rechazo: Franja horaria menor a 60 minutos
$tooShortRange = validate_schedule_override([
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'maria',
    'start_date' => '2026-11-25',
    'time_scope' => 'custom_hours',
    'custom_range' => ['start' => '14:00', 'end' => '14:30'],
]);
assert_true(!$tooShortRange['isValid'], 'Franja menor a 60 min debe ser rechazada');

// Rechazo: Franja fuera del horario de consultorio (08:00 a 20:00)
$outOfBoundsRange = validate_schedule_override([
    'action' => 'closure',
    'start_date' => '2026-11-25',
    'time_scope' => 'custom_hours',
    'custom_range' => ['start' => '07:00', 'end' => '09:00'],
]);
assert_true(!$outOfBoundsRange['isValid'], 'Franja antes de 08:00 debe ser rechazada');

echo "  --- 3. Aritmética de franjas horarias: subtract_time_window ---\n";
$baseWin = [['start' => '09:00', 'end' => '17:00']];

// Corte al inicio
$cutStart = subtract_time_window($baseWin, '09:00', '11:00');
assert_equals($cutStart, [['start' => '11:00', 'end' => '17:00']], 'Corte al inicio');

// Corte al final
$cutEnd = subtract_time_window($baseWin, '15:00', '17:00');
assert_equals($cutEnd, [['start' => '09:00', 'end' => '15:00']], 'Corte al final');

// Corte al medio (divide en 2)
$cutMiddle = subtract_time_window($baseWin, '12:00', '14:00');
assert_equals($cutMiddle, [
    ['start' => '09:00', 'end' => '12:00'],
    ['start' => '14:00', 'end' => '17:00'],
], 'Corte al medio divide en 2 franjas');

// Corte total
$cutAll = subtract_time_window($baseWin, '08:00', '18:00');
assert_equals($cutAll, [], 'Corte total vacía las ventanas');

// Corte que deja un fragmento inútil de 30 min (<60 min)
$cutResidual = subtract_time_window([['start' => '09:00', 'end' => '12:00']], '09:00', '11:30');
assert_equals($cutResidual, [], 'Fragmento residual < 60 min se descarta de forma segura');

echo "  --- 4. Fusión de franjas horarias: merge_time_windows ---\n";
// Franjas adyacentes continuas
$adjacent = merge_time_windows(
    [['start' => '09:00', 'end' => '12:00']],
    [['start' => '12:00', 'end' => '15:00']]
);
assert_equals($adjacent, [['start' => '09:00', 'end' => '15:00']], 'Franjas continuas se fusionan');

// Franjas solapadas
$overlapping = merge_time_windows(
    [['start' => '09:00', 'end' => '13:00']],
    [['start' => '11:00', 'end' => '16:00']]
);
assert_equals($overlapping, [['start' => '09:00', 'end' => '16:00']], 'Franjas solapadas se unifican');

// Franjas disjuntas separadas
$disjoint = merge_time_windows(
    [['start' => '09:00', 'end' => '12:00']],
    [['start' => '15:00', 'end' => '18:00']]
);
assert_equals($disjoint, [
    ['start' => '09:00', 'end' => '12:00'],
    ['start' => '15:00', 'end' => '18:00'],
], 'Franjas disjuntas se conservan ordenadas');

echo "  --- 5. Resolución de agendas por fecha: resolve_practitioner_windows_for_date ---\n";
$baseHours = [
    'maria' => [
        '1' => [['start' => '09:00', 'end' => '17:00']],
        '2' => [['start' => '09:00', 'end' => '16:00']],
        '5' => [['start' => '09:00', 'end' => '13:00']],
    ],
    'norberto' => [
        '1' => [['start' => '17:30', 'end' => '19:30']],
        '2' => [['start' => '16:30', 'end' => '19:30']],
        '3' => [['start' => '09:00', 'end' => '16:30']],
        '4' => [['start' => '15:00', 'end' => '19:00']],
        '5' => [['start' => '13:30', 'end' => '19:30']],
    ],
];

$testWed = '2026-11-25'; // Miércoles

// Base normal de miércoles
$wedNorbertoBase = resolve_practitioner_windows_for_date($baseHours, [], $testWed, 'norberto');
assert_equals($wedNorbertoBase, [['start' => '09:00', 'end' => '16:30']], 'Norberto atiende miércoles base');

$wedMariaBase = resolve_practitioner_windows_for_date($baseHours, [], $testWed, 'maria');
assert_equals($wedMariaBase, [], 'María no atiende miércoles base');

// Cesión completa Norberto -> María
$overridesTransfer = [[
    'id' => 'ov_1',
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'maria',
    'start_date' => $testWed,
    'end_date' => $testWed,
    'time_scope' => 'all_day',
    'active' => true,
]];
$wedNorbertoCeded = resolve_practitioner_windows_for_date($baseHours, $overridesTransfer, $testWed, 'norberto');
$wedMariaCeded = resolve_practitioner_windows_for_date($baseHours, $overridesTransfer, $testWed, 'maria');
assert_equals($wedNorbertoCeded, [], 'Norberto queda con 0 ventanas al ceder');
assert_equals($wedMariaCeded, [['start' => '09:00', 'end' => '16:30']], 'María recibe jornada de Norberto');

// Si la cesión está anulada (active = false), se ignora
$overridesAnnulled = [[
    'id' => 'ov_annulled',
    'action' => 'transfer',
    'from_practitioner' => 'norberto',
    'to_practitioner' => 'maria',
    'start_date' => $testWed,
    'end_date' => $testWed,
    'time_scope' => 'all_day',
    'active' => false,
]];
$wedNorbertoRestored = resolve_practitioner_windows_for_date($baseHours, $overridesAnnulled, $testWed, 'norberto');
assert_equals($wedNorbertoRestored, [['start' => '09:00', 'end' => '16:30']], 'Excepción anulada restaura horario');

// Cierre total de consultorio
$overridesClosure = [[
    'id' => 'ov_close',
    'action' => 'closure',
    'start_date' => $testWed,
    'end_date' => $testWed,
    'time_scope' => 'all_day',
    'active' => true,
]];
$closedN = resolve_practitioner_windows_for_date($baseHours, $overridesClosure, $testWed, 'norberto');
$closedM = resolve_practitioner_windows_for_date($baseHours, $overridesClosure, $testWed, 'maria');
$closedGeneral = resolve_practitioner_windows_for_date($baseHours, $overridesClosure, $testWed, null);
assert_equals($closedN, [], 'Cierre total bloquea a Norberto');
assert_equals($closedM, [], 'Cierre total bloquea a María');
assert_equals($closedGeneral, [], 'Cierre total bloquea consultorio general');

// Fines de semana siempre retornan vacío
$satWindows = resolve_practitioner_windows_for_date($baseHours, $overridesTransfer, '2026-11-28', 'maria');
assert_equals($satWindows, [], 'Sábados devuelven 0 ventanas siempre');

echo "  --- 6. Consulta de turnos en conflicto (SQLite in-memory) ---\n";
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('CREATE TABLE turnos (
    id TEXT PRIMARY KEY,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    practitioner_id TEXT NOT NULL,
    status TEXT NOT NULL
)');

$stmt = $pdo->prepare('INSERT INTO turnos VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute(['t1', '2026-11-25', '10:00', 'Carlos Gómez', 'norberto', 'confirmed']);
$stmt->execute(['t2', '2026-11-25', '15:00', 'Ana Ruiz', 'norberto', 'cancelled']); // cancelado
$stmt->execute(['t3', '2026-11-26', '16:00', 'Pedro Soler', 'norberto', 'pending']);

$conflicts = fetch_conflicting_turnos($pdo, '2026-11-25', '2026-11-25', 'norberto');
assert_equals(count($conflicts), 1, 'Solo debe detectar el turno confirmado activo');
assert_equals($conflicts[0]['id'], 't1', 'ID del turno en conflicto coincide');

$conflictsRange = fetch_conflicting_turnos($pdo, '2026-11-25', '2026-11-26', 'norberto');
assert_equals(count($conflictsRange), 2, 'En el rango detecta los 2 turnos activos');

echo "✅ Todos los tests unitarios de backend PHP superados con éxito.\n";
