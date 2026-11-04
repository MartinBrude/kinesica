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

echo "OK_PHP_TESTS\n";
