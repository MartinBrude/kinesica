<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/lib.php';
require_once __DIR__ . '/../admin/api/pacientes_helpers.php';
require_once __DIR__ . '/../admin/api/pacientes_ops.php';

$pdo = new PDO("sqlite::memory:");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$pdo->exec("
CREATE TABLE pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefono TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    nombre_pila TEXT NOT NULL,
    dni TEXT,
    email TEXT,
    profesional_habitual TEXT NOT NULL DEFAULT 'indistinto',
    motivo_consulta TEXT,
    notas TEXT,
    origen TEXT NOT NULL DEFAULT 'whatsapp',
    contacto_nombre TEXT,
    contacto_telefono TEXT,
    contacto_email TEXT,
    contacto_notas TEXT,
    dejo_review INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
");

ensure_pacientes_tables($pdo);

// 1. Insertar 3 duplicados de Florencia
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review)
VALUES (1, 'sin-tel-f-101', 'Florencia', 'González', 'González Florencia', 'Florencia', '38123456', 'maria', 1)");

$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review)
VALUES (2, '5491161234567', 'Florencia', 'Gonzalez', 'Florencia Gonzalez', 'Florencia', NULL, 'indistinto', 0)");

$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review)
VALUES (3, 'sin-tel-dni-38123456', 'Florencia', 'González', 'Florencia González', 'Florencia', '38.123.456', 'indistinto', 0)");

$merged = deduplicate_pacientes_table($pdo);
if ($merged !== 2) {
    echo "ERROR: Se esperaban 2 unificaciones, hubo $merged\n";
    exit(1);
}

$rows = $pdo->query("SELECT * FROM pacientes")->fetchAll(PDO::FETCH_ASSOC);
if (count($rows) !== 1) {
    echo "ERROR: Se esperaba 1 fila restante, hay " . count($rows) . "\n";
    exit(1);
}

$p = $rows[0];
// Regla: teléfono real prevalece
if ($p['telefono'] !== '5491161234567') {
    echo "ERROR: El teléfono debe ser el real: " . $p['telefono'] . "\n";
    exit(1);
}
// Regla: si uno dice con review y otro sin, queda que si
if ((int) $p['dejo_review'] !== 1) {
    echo "ERROR: dejo_review debe ser 1 (quedó " . $p['dejo_review'] . ")\n";
    exit(1);
}
// Regla: si uno dice indistinto y otro dice con tal, queda tal
if ($p['profesional_habitual'] !== 'maria') {
    echo "ERROR: profesional_habitual debe ser maria (quedó " . $p['profesional_habitual'] . ")\n";
    exit(1);
}
if ($p['dni'] !== '38123456') {
    echo "ERROR: dni debe ser 38123456 (quedó " . $p['dni'] . ")\n";
    exit(1);
}

// 2. Coincidencia por DNI con nombres ligeramente variados
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review)
VALUES (10, 'sin-tel-f-555', 'Roberto', 'Brude', 'Norberto Roberto Brude', 'Roberto', '12345678', 'indistinto', 0)");

$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review)
VALUES (11, '5491188887777', 'Norberto', 'Brude', 'Norberto Brude', 'Norberto', '12.345.678', 'norberto', 1)");

$merged2 = deduplicate_pacientes_table($pdo);
if ($merged2 !== 1) {
    echo "ERROR: Se esperaba 1 unificación para Norberto, hubo $merged2\n";
    exit(1);
}

$norb = $pdo->query("SELECT * FROM pacientes WHERE id = 11")->fetch(PDO::FETCH_ASSOC);
if (!$norb || (int) $norb['dejo_review'] !== 1 || $norb['profesional_habitual'] !== 'norberto') {
    echo "ERROR: Falla en consolidación de Norberto\n";
    exit(1);
}

// 3. Prevención de duplicación al buscar paciente existente
$match = find_existing_patient_match($pdo, '5491161234567', 'Florencia González', '38123456');
if (!$match || (int) $match['id'] !== 2) {
    echo "ERROR: find_existing_patient_match no encontró a Florencia\n";
    exit(1);
}

// 4. Verificación de reglas de capitalización (solo la inicial en mayúscula)
$capTests = [
    'FLORENCIA GONZALEZ' => 'Florencia Gonzalez',
    'florencia gonzález' => 'Florencia González',
    "ÁLVAREZ, MARÍA LAURA 👍\r\n" => 'Álvarez María Laura',
    'juan-carlos d\'alessandro' => 'Juan-Carlos D\'Alessandro',
    'DE LA TORRE' => 'De La Torre',
];
foreach ($capTests as $input => $expected) {
    $clean = sanitize_patient_name($input);
    if ($clean !== $expected) {
        echo "ERROR: sanitize_patient_name('$input') dió '$clean', se esperaba '$expected'\n";
        exit(1);
    }
}

// 5. Verificación de corrección de lo ya persistido en DB (pacientes, lista_espera, fichas)
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, contacto_nombre)
VALUES (99, '5491199990000', 'CAROLINA', 'MENDEZ', 'CAROLINA MENDEZ', 'CAROLINA', 'LAURA GOMEZ')");

$pdo->exec("INSERT INTO lista_espera (id, paciente_telefono, paciente_nombre)
VALUES (99, '5491199990000', 'ESTEBAN QUITO')");

$pdo->exec("CREATE TABLE IF NOT EXISTS fichas (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    profesional TEXT DEFAULT 'indistinto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

$pdo->exec("INSERT INTO fichas (id, payload, profesional)
VALUES ('f-test-99', '{\"nombre\": \"ANA CLARA PEREZ\", \"dni\": \"40111222\"}', 'maria')");

// Ejecutar ensure_pacientes_tables para disparar la migración y corrección de persistidos
ensure_pacientes_tables($pdo, true);

$p99 = $pdo->query("SELECT * FROM pacientes WHERE id = 99")->fetch(PDO::FETCH_ASSOC);
if (!$p99 || $p99['nombre'] !== 'Carolina' || $p99['apellido'] !== 'Mendez' || $p99['nombre_completo'] !== 'Carolina Mendez' || $p99['nombre_pila'] !== 'Carolina' || $p99['contacto_nombre'] !== 'Laura Gomez') {
    echo "ERROR: Paciente 99 no fue corregido a solo iniciales mayúsculas: " . json_encode($p99) . "\n";
    exit(1);
}

$esp99 = $pdo->query("SELECT * FROM lista_espera WHERE id = 99")->fetch(PDO::FETCH_ASSOC);
if (!$esp99 || $esp99['paciente_nombre'] !== 'Esteban Quito') {
    echo "ERROR: lista_espera 99 no fue corregida: " . json_encode($esp99) . "\n";
    exit(1);
}

$f99 = $pdo->query("SELECT * FROM fichas WHERE id = 'f-test-99'")->fetch(PDO::FETCH_ASSOC);
$payload99 = json_decode($f99['payload'] ?? '{}', true);
if (!$payload99 || ($payload99['nombre'] ?? '') !== 'Ana Clara Perez') {
    echo "ERROR: Ficha payload no fue corregida: " . json_encode($payload99) . "\n";
    exit(1);
}

// 6. Verificación de inferencia de profesionales por horario (regla de 1 sola camilla)
$schedTests = [
    ['2026-11-11', '14:00', null, 'norberto'], // Miércoles 14:00 -> Norberto
    ['2026-11-04', '11:15', null, 'norberto'], // Miércoles 11:15 -> Norberto
    ['2026-11-12', '16:00', null, 'norberto'], // Jueves 16:00 -> Norberto
    ['2026-11-16', '10:00', null, 'maria'],    // Lunes 10:00 -> María
    ['2026-11-16', '11:00', null, 'maria'],    // Lunes 11:00 -> María
    ['2026-11-16', '12:00', null, 'maria'],    // Lunes 12:00 -> María
    ['2026-11-16', '17:30', null, 'norberto'], // Lunes 17:30 -> Norberto
    ['2026-10-13', '18:00', null, 'norberto'], // Martes 18:00 -> Norberto
    ['2026-10-13', '10:00', null, 'maria'],    // Martes 10:00 -> María
    ['2026-11-20', '10:00', null, 'maria'],    // Viernes 10:00 -> María
    ['2026-11-20', '15:00', null, 'norberto'], // Viernes 15:00 -> Norberto
    [null, null, 'Creado por norberto1712@gmail.com', 'norberto'],
    [null, null, 'Turno manosmagicas7116@gmail.com', 'maria'],
];

foreach ($schedTests as [$date, $time, $meta, $expectedProf]) {
    $inferred = infer_practitioner_from_schedule($date, $time, $meta);
    if ($inferred !== $expectedProf) {
        echo "ERROR: infer_practitioner_from_schedule('$date', '$time', '$meta') dio '$inferred', se esperaba '$expectedProf'\n";
        exit(1);
    }
}

// 7. Verificación de resolución de pacientes indistintos de Google Calendar
$indistintoPatients = [
    ['id' => 201, 'tel' => 'sin-tel-gaglio', 'nom' => 'Silvina', 'ape' => 'Gaglio', 'full' => 'Silvina Gaglio', 'exp' => 'norberto'],
    ['id' => 202, 'tel' => 'sin-tel-maldonado', 'nom' => 'Ana', 'ape' => 'Maldonado', 'full' => 'Ana Maldonado', 'exp' => 'maria'],
    ['id' => 203, 'tel' => '5491154562619', 'nom' => 'Augusto', 'ape' => 'Oviedo', 'full' => 'Augusto Oviedo', 'exp' => 'norberto'],
    ['id' => 204, 'tel' => 'sin-tel-rosenfeld', 'nom' => 'Alejandro', 'ape' => 'Rosenfeld', 'full' => 'Alejandro Rosenfeld', 'exp' => 'maria'],
    ['id' => 205, 'tel' => 'sin-tel-lipsyc', 'nom' => 'Silvana', 'ape' => 'Lipsyc', 'full' => 'Silvana Lipsyc', 'exp' => 'maria'],
    ['id' => 206, 'tel' => '5491149927754', 'nom' => 'Jorge', 'ape' => 'Esteban', 'full' => 'Jorge Esteban', 'exp' => 'norberto'],
    ['id' => 207, 'tel' => 'sin-tel-victos', 'nom' => 'Claudia', 'ape' => 'Victos', 'full' => 'Claudia Victos María', 'exp' => 'norberto'],
    ['id' => 208, 'tel' => '5491100000000', 'nom' => 'Pablo', 'ape' => 'SinTurno', 'full' => 'Pablo SinTurno', 'exp' => 'indistinto'],
];

$insStmt = $pdo->prepare("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, profesional_habitual) VALUES (:id, :tel, :nom, :ape, :full, :pila, 'indistinto')");
foreach ($indistintoPatients as $ip) {
    $insStmt->execute([
        'id' => $ip['id'],
        'tel' => $ip['tel'],
        'nom' => $ip['nom'],
        'ape' => $ip['ape'],
        'full' => $ip['full'],
        'pila' => $ip['nom'],
    ]);
}

$resolvedCount = resolve_indistinto_pacientes_from_calendar($pdo);
// Se deben haber resuelto los 7 agendados, y Pablo SinTurno debe permanecer como indistinto
if ($resolvedCount !== 7) {
    echo "ERROR: resolve_indistinto_pacientes_from_calendar resolvió $resolvedCount (se esperaban exactamente 7 de los agendados)\n";
    exit(1);
}

foreach ($indistintoPatients as $ip) {
    $chk = $pdo->query("SELECT profesional_habitual FROM pacientes WHERE id = {$ip['id']}")->fetch(PDO::FETCH_ASSOC);
    if (!$chk || $chk['profesional_habitual'] !== $ip['exp']) {
        echo "ERROR: Paciente {$ip['full']} no quedó en {$ip['exp']} (quedó: " . ($chk['profesional_habitual'] ?? 'null') . ")\n";
        exit(1);
    }
}

// 8. Merge debe conservar la mayor información posible entre ambos
$pdo->exec("DELETE FROM pacientes WHERE id IN (301, 302)");
$pdo->exec("INSERT INTO pacientes (
    id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email,
    profesional_habitual, motivo_consulta, notas, origen,
    contacto_nombre, contacto_telefono, contacto_email, contacto_notas, dejo_review
) VALUES (
    301, 'sin-tel-f-301', 'Maria', 'Lopez', 'Maria Lopez', 'Maria', '40999888', 'maria.lopez@example.com',
    'indistinto', 'Cervicalgia', 'Llega referida por OSDE', 'whatsapp',
    'Juan Lopez', NULL, 'juan.lopez@example.com', 'Hermano', 0
)");
$pdo->exec("INSERT INTO pacientes (
    id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email,
    profesional_habitual, motivo_consulta, notas, origen,
    contacto_nombre, contacto_telefono, contacto_email, contacto_notas, dejo_review
) VALUES (
    302, '5491177788899', 'María', 'López', 'María López', 'María', NULL, NULL,
    'norberto', 'Lumbalgia crónica', 'Alergia a AINEs', 'admin',
    NULL, '5491166677788', NULL, 'Avisar antes', 1
)");

$mergedMax = deduplicate_pacientes_table($pdo);
if ($mergedMax < 1) {
    echo "ERROR: No se unificó el par María López (merged=$mergedMax)\n";
    exit(1);
}
$maria = $pdo->query("SELECT * FROM pacientes WHERE id IN (301, 302) OR telefono = '5491177788899'")->fetch(PDO::FETCH_ASSOC);
if (!$maria || !preg_match('/l[oó]pez/iu', (string) ($maria['nombre_completo'] ?? ''))) {
    echo "ERROR: No quedó ninguna fila de María López tras dedupe: " . json_encode($maria) . "\n";
    exit(1);
}
if ($maria['telefono'] !== '5491177788899') {
    echo "ERROR: Debía conservar el WhatsApp real, quedó: {$maria['telefono']}\n";
    exit(1);
}
if ((int) $maria['dejo_review'] !== 1) {
    echo "ERROR: dejo_review debía quedar en 1\n";
    exit(1);
}
if ($maria['profesional_habitual'] !== 'norberto') {
    echo "ERROR: profesional debía quedar norberto, quedó: {$maria['profesional_habitual']}\n";
    exit(1);
}
if ($maria['dni'] !== '40999888') {
    echo "ERROR: DNI debía conservarse (40999888), quedó: " . ($maria['dni'] ?? 'null') . "\n";
    exit(1);
}
if ($maria['email'] !== 'maria.lopez@example.com') {
    echo "ERROR: Email debía conservarse, quedó: " . ($maria['email'] ?? 'null') . "\n";
    exit(1);
}
if (!str_contains((string) $maria['motivo_consulta'], 'Cervicalgia') || !str_contains((string) $maria['motivo_consulta'], 'Lumbalgia')) {
    echo "ERROR: Motivo debía unir ambos textos, quedó: " . ($maria['motivo_consulta'] ?? '') . "\n";
    exit(1);
}
if (!str_contains((string) $maria['notas'], 'OSDE') || !str_contains((string) $maria['notas'], 'AINEs')) {
    echo "ERROR: Notas debían unir ambos textos, quedó: " . ($maria['notas'] ?? '') . "\n";
    exit(1);
}
if ($maria['origen'] !== 'admin') {
    echo "ERROR: origen debía preferir admin, quedó: {$maria['origen']}\n";
    exit(1);
}
if (($maria['contacto_nombre'] ?? '') !== 'Juan Lopez') {
    echo "ERROR: contacto_nombre debía conservarse\n";
    exit(1);
}
if (($maria['contacto_telefono'] ?? '') !== '5491166677788') {
    echo "ERROR: contacto_telefono debía conservarse\n";
    exit(1);
}
if (($maria['contacto_email'] ?? '') !== 'juan.lopez@example.com') {
    echo "ERROR: contacto_email debía conservarse\n";
    exit(1);
}
if (!preg_match('/[áéíóúÁÉÍÓÚñÑ]/u', (string) $maria['nombre_completo'])) {
    echo "ERROR: Debía preferir el nombre con acentos, quedó: {$maria['nombre_completo']}\n";
    exit(1);
}

// 9. Homónimos con WhatsApp reales distintos NO se unen solo por nombre
$pdo->exec("DELETE FROM pacientes WHERE id IN (401, 402)");
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, profesional_habitual, dejo_review)
VALUES (401, '5491111111111', 'Juan', 'Perez', 'Juan Perez', 'Juan', 'indistinto', 0)");
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, profesional_habitual, dejo_review)
VALUES (402, '5491122222222', 'Juan', 'Perez', 'Juan Perez', 'Juan', 'maria', 1)");

$mergedHom = deduplicate_pacientes_table($pdo);
$juanCount = (int) $pdo->query("SELECT COUNT(*) FROM pacientes WHERE id IN (401, 402)")->fetchColumn();
if ($juanCount !== 2) {
    echo "ERROR: Homónimos con teléfonos distintos debían quedar 2 filas, hay $juanCount (merged=$mergedHom)\n";
    exit(1);
}

// 10. Placeholder + mismo nombre + mismo DNI sí se une; flag campaña se OR-mergea
$pdo->exec("DELETE FROM pacientes WHERE id IN (501, 502)");
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review, encuesta_enviada, viene_de_campana)
VALUES (501, 'sin-tel-f-501', 'Lucia', 'Sosa', 'Lucia Sosa', 'Lucia', '55111222', 'indistinto', 0, 1, 0)");
$pdo->exec("INSERT INTO pacientes (id, telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, dejo_review, encuesta_enviada, viene_de_campana)
VALUES (502, '5491199988877', 'Lucía', 'Sosa', 'Lucía Sosa', 'Lucía', '55111222', 'norberto', 0, 0, 1)");

$mergedLucia = deduplicate_pacientes_table($pdo);
if ($mergedLucia < 1) {
    echo "ERROR: Lucía Sosa (mismo DNI) debía unificarse\n";
    exit(1);
}
$lucia = $pdo->query("SELECT * FROM pacientes WHERE telefono = '5491199988877' OR id IN (501, 502)")->fetch(PDO::FETCH_ASSOC);
if (!$lucia || (int) ($lucia['encuesta_enviada'] ?? 0) !== 1) {
    echo "ERROR: encuesta_enviada debía OR-mergearse a 1\n";
    exit(1);
}
if ((int) ($lucia['viene_de_campana'] ?? 0) !== 1) {
    echo "ERROR: viene_de_campana debía OR-mergearse a 1\n";
    exit(1);
}

echo "OK_PHP_TESTS\n";
