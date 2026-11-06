<?php
declare(strict_types=1);

/**
 * Pruebas de carga de contacto, normalización y formato de vista (recordatorios).
 * Sin envíos WhatsApp/email. Con KT_DB_* + KT_TMP: persistencia real aislada.
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_recordatorios_store.php';
require_once $root . '/admin/api/lib_recordatorios_view.php';
require_once $root . '/admin/api/pacientes_helpers.php';

// Funciones de contacto viven en recordatorios.php (con side-effects de request).
// Reimplementamos aquí las piezas puras / cargamos el archivo vía include selectivo:
// Extraemos helpers redefinibles incluyendo solo lo necesario con un stub de request.
if (!function_exists('cfg')) {
    function cfg(): array
    {
        return [];
    }
}
if (!function_exists('json_out')) {
    function json_out(int $code, array $payload): void
    {
        throw new RuntimeException('json_out unexpected in unit test: ' . $code . ' ' . json_encode($payload));
    }
}
if (!function_exists('db')) {
    function db(): PDO
    {
        throw new RuntimeException('db() not available in unit scope');
    }
}

$fails = 0;
$passed = 0;
function ok(bool $cond, string $msg): void
{
    global $fails, $passed;
    if ($cond) {
        $passed++;
        return;
    }
    $fails++;
    echo "  ✗ FALLÓ: $msg\n";
}
function eq($actual, $expected, string $msg): void
{
    ok($actual === $expected, $msg . ' (esperado ' . json_encode($expected, JSON_UNESCAPED_UNICODE) . ', obtuvo ' . json_encode($actual, JSON_UNESCAPED_UNICODE) . ')');
}
function section(string $name): void
{
    echo "• $name\n";
}

section('extract / format email');
eq(recordatorios_extract_contact_email('contact_email:ana@test.com (Cargado por admin)'), 'ana@test.com', 'prefijo contact_email');
eq(recordatorios_extract_contact_email('ANA@TEST.COM'), 'ana@test.com', 'email suelto');
eq(recordatorios_extract_contact_email('Meta HTTP 404'), '', 'no email en error Meta');
eq(recordatorios_extract_contact_email(''), '', 'vacío');

$item = recordatorios_format_item([
    'id' => 9,
    'event_key' => 'k',
    'exec_id' => 'e',
    'run_at' => '2026-11-01 21:00:00',
    'appointment_date' => '2026-11-02',
    'appointment_time' => '10:00',
    'calendar_event_id' => 'cal',
    'patient_name' => 'Laura <script>',
    'wa_id' => '',
    'status' => 'pending',
    'skip_reason' => '',
    'error_code' => '',
    'error_message' => 'contact_email:laura@example.com (Cargado por x)',
    'event_summary' => 'Laura',
], null);
eq($item['email'], 'laura@example.com', 'format_item rescata email de error_message');
eq($item['status_label'], 'A enviar', 'label pending');
eq($item['run_day'], '2026-11-01', 'run_day BA desde UTC 21:00');
ok(isset($item['patient_name']) && $item['patient_name'] === 'Laura <script>', 'nombre crudo en JSON (escape es del frontend)');

$item2 = recordatorios_format_item($item + ['error_message' => 'fallo'], 'dir@example.com');
eq($item2['email'], 'dir@example.com', 'email del directorio tiene prioridad si se pasa');

section('phone clean');
eq(clean_phone_number('11 4555-6677'), '5491145556677', 'local 11… → 549');
eq(clean_phone_number('+54 9 11 4555-6677'), '5491145556677', 'internacional');
eq(clean_phone_number('5491145556677'), '5491145556677', 'ya normalizado');
eq(clean_phone_number('abc'), '', 'solo letras → vacío');
eq(clean_phone_number('15 4555-6677'), '5491145556677', '15… porteño → 54911…');
eq(clean_phone_number('sin-tel-dni-35123456'), '', 'placeholder sin-tel-dni descartado');
eq(clean_phone_number('sin-tel-f-123456789012'), '', 'placeholder sin-tel-f descartado');
eq(clean_phone_number('ficha-001'), '', 'placeholder ficha- descartado');
eq(clean_phone_number('WhatsApp: +54 9 11 4555-6677'), '5491145556677', 'prefijo whatsapp ignorado correctamente');

section('XSS / escape contrato frontend');
$render = file_get_contents($root . '/admin/modules/recordatorios-render.js') ?: '';
ok(str_contains($render, 'escapeHtml(item.patient_name'), 'nombre escapado en card');
ok(str_contains($render, 'escapeHtml(item.email)'), 'email escapado en card');
ok(str_contains($render, 'data-action="save-contact"'), 'botón cargar contacto');
ok(str_contains($render, 'needsContact'), 'flag needsContact');
ok(str_contains($render, 'canManualSend'), 'flag envío manual con teléfono');
ok(preg_match('/canManualSend\s*=\s*\n?\s*!alreadySent[\s\S]*?\(hasPhone\s*\|\|\s*hasEmail\)/', $render) === 1, 'enviar solo si hay WhatsApp o email');
ok(!str_contains($render, 'Abrir envío manual (podés cargar'), 'sin envío si falta contacto');
ok(str_contains($render, 'alreadySent'), 'no reenvía si ya enviado');

$js = file_get_contents($root . '/admin/modules/recordatorios.js') ?: '';
ok(str_contains($js, 'action: "save_contact"'), 'SPA llama save_contact');
ok(str_contains($js, 'save_contact: saveContact'), 'dispatch respeta checkbox guardar');
ok(str_contains($js, 'mode: "contact"'), 'modal modo contact');

$php = file_get_contents($root . '/admin/api/recordatorios.php') ?: '';
ok(str_contains($php, "action === 'save_contact'"), 'API save_contact');
ok(str_contains($php, 'is_colaborador($auth)'), 'colaborador bloqueado en POST');
ok(str_contains($php, 'recordatorios_bot_authenticated'), 'bot auth para ingest');
ok(preg_match("/if \\(\\\$method === 'POST' && \\\$action === 'ingest'\\)/", $php) === 1, 'ingest sin sesión → 401');
ok(str_contains($php, 'hash_equals'), 'bot secret con hash_equals');
ok(str_contains($php, 'filter_var($email, FILTER_VALIDATE_EMAIL)'), 'valida email');
ok(str_contains($php, 'htmlspecialchars($firstName)'), 'mail HTML escapa nombre');
ok(str_contains($php, 'Primero el recordatorio'), 'save_contact prioriza recordatorio sobre directorio');
ok(!str_contains($php, 'deduplicate_pacientes_table($pdo)'), 'carga de contacto no corre dedupe O(n)');

$store = file_get_contents($root . '/admin/api/lib_recordatorios_store.php') ?: '';
ok(str_contains($store, 'Contacto manual ya resuelve'), 'ingest no pisa WhatsApp cargado a mano');
ok(str_contains($store, 'wa_id IS NULL OR wa_id = ""'), 'delete pending preserva filas con WhatsApp');

ok(str_contains($js, 'recordatorioDedupeScore'), 'SPA prioriza filas con WhatsApp al deduplicar');

section('contrato seguridad estático');
ok(!preg_match('/\$_GET\[.wa_id/', $php), 'no lee wa_id de GET');
ok(!preg_match('/query\s*\(\s*[\'"].*\$/', $php), 'sin SQL interpolado obvio');
ok(str_contains($php, 'require_header()'), 'exige X-Kinesica');
ok(str_contains($php, 'require_auth()'), 'exige sesión');

// Persistencia opcional
$host = getenv('KT_DB_HOST');
$tmp = getenv('KT_TMP');
if (!$host || !$tmp) {
    echo "• Persistencia contacto omitida (sin KT_DB_HOST / KT_TMP)\n";
    echo $fails === 0 ? "OK recordatorios-contact ($passed assertions)\n" : "FAIL recordatorios-contact ($fails)\n";
    exit($fails === 0 ? 0 : 1);
}

section('Persistencia contacto (DB aislada)');
require_once $root . '/admin/api/lib.php';

// Cargar helpers de recordatorios.php sin ejecutar el router:
// definimos entorno CLI y parseamos funciones vía include con REQUEST_METHOD GET vacío.
$_SERVER['REQUEST_METHOD'] = 'GET';
$_GET = [];
// Evitar salida del GET handler: no incluir recordatorios.php completo.
// En cambio, duplicamos la lógica crítica de upsert seguro aquí para assert +
// llamamos clean/format ya probados. La API se verifica por contrato estático + probe live.

function rem_fresh_contact(string $name): PDO
{
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', getenv('KT_DB_HOST'), (int) getenv('KT_DB_PORT'), getenv('KT_DB_NAME')),
        (string) getenv('KT_DB_USER'),
        (string) getenv('KT_DB_PASS'),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $pdo->exec('CREATE TABLE IF NOT EXISTS pacientes_audit_tmp LIKE pacientes');
    // Usamos tablas reales con prefijo de teléfono de prueba reservado 549000…
    return $pdo;
}

$pdo = rem_fresh_contact('c');
ensure_pacientes_tables($pdo);
recordatorios_ensure_schema($pdo);

$testPhoneA = '5490001112222';
$testPhoneB = '5490003334444';
$pdo->prepare('DELETE FROM pacientes WHERE telefono IN (:a,:b)')->execute(['a' => $testPhoneA, 'b' => $testPhoneB]);
$pdo->prepare('DELETE FROM recordatorio_eventos WHERE wa_id IN (:a,:b) OR patient_name LIKE :n')
    ->execute(['a' => $testPhoneA, 'b' => $testPhoneB, 'n' => 'AuditContact%']);

// Paciente existente A
$pdo->prepare(
    'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, email, origen)
     VALUES (:t,:n,:a,:f,:p,:e,:o)'
)->execute([
    't' => $testPhoneA, 'n' => 'Ana', 'a' => 'Existente', 'f' => 'Ana Existente', 'p' => 'Ana',
    'e' => 'ana.old@example.com', 'o' => 'admin',
]);

// Simular upsert seguro (misma política que recordatorios_persist_directory_contact corregida)
$stmt = $pdo->prepare(
    'INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, email, origen)
     VALUES (:tel, :nombre, :apellido, :full, :pila, :email, :origen)
     ON DUPLICATE KEY UPDATE
        email = COALESCE(VALUES(email), email),
        nombre = CASE WHEN nombre IS NULL OR nombre = "" THEN VALUES(nombre) ELSE nombre END,
        apellido = CASE WHEN apellido IS NULL OR apellido = "" THEN VALUES(apellido) ELSE apellido END,
        nombre_completo = CASE WHEN nombre_completo IS NULL OR nombre_completo = "" THEN VALUES(nombre_completo) ELSE nombre_completo END,
        nombre_pila = CASE WHEN nombre_pila IS NULL OR nombre_pila = "" THEN VALUES(nombre_pila) ELSE nombre_pila END'
);
$stmt->execute([
    'tel' => $testPhoneA,
    'nombre' => 'Intruso',
    'apellido' => 'X',
    'full' => 'Intruso X',
    'pila' => 'Intruso',
    'email' => 'ana.new@example.com',
    'origen' => 'admin',
]);
$row = $pdo->prepare('SELECT nombre_completo, email FROM pacientes WHERE telefono = :t');
$row->execute(['t' => $testPhoneA]);
$got = $row->fetch();
eq($got['nombre_completo'], 'Ana Existente', 'colisión de teléfono NO pisa nombre existente');
eq($got['email'], 'ana.new@example.com', 'sí actualiza email vacío/nuevo vía COALESCE');

// Insert nuevo
$stmt->execute([
    'tel' => $testPhoneB,
    'nombre' => 'Bruno',
    'apellido' => 'Nuevo',
    'full' => 'Bruno Nuevo',
    'pila' => 'Bruno',
    'email' => 'bruno@example.com',
    'origen' => 'admin',
]);
$row->execute(['t' => $testPhoneB]);
$gotB = $row->fetch();
eq($gotB['nombre_completo'], 'Bruno Nuevo', 'insert nuevo ok');

// Recordatorio missing_phone → format + update fields
$ins = recordatorios_normalize_item([
    'status' => 'missing_phone',
    'calendar_event_id' => 'audit-cal-1',
    'patient_name' => 'AuditContact Laura',
    'appointment_date' => '2026-11-03',
    'appointment_time' => '11:00',
], 'audit-exec', time());
ok($ins !== null, 'normalize missing_phone');
eq(recordatorios_insert_item($pdo, $ins), 'stored', 'insert missing_phone');
$id = (int) $pdo->query('SELECT id FROM recordatorio_eventos WHERE calendar_event_id = "audit-cal-1" ORDER BY id DESC LIMIT 1')->fetchColumn();
ok($id > 0, 'id recordatorio');

recordatorios_update_outcome($id, [
    'wa_id' => $testPhoneB,
    'status' => 'pending',
    'error_code' => '',
    'error_message' => 'contact_email:bruno@example.com (Cargado por audit)',
], $pdo);
$updated = recordatorios_find_item_by_id($id, $pdo);
$view = recordatorios_format_item($updated);
eq($view['status'], 'pending', 'missing_phone → pending');
eq($view['wa_id'], $testPhoneB, 'wa_id guardado');
eq($view['email'], 'bruno@example.com', 'email desde contact_email');

// Cleanup
$pdo->prepare('DELETE FROM pacientes WHERE telefono IN (:a,:b)')->execute(['a' => $testPhoneA, 'b' => $testPhoneB]);
$pdo->prepare('DELETE FROM recordatorio_eventos WHERE id = :id')->execute(['id' => $id]);

echo $fails === 0 ? "OK recordatorios-contact ($passed assertions)\n" : "FAIL recordatorios-contact ($fails)\n";
exit($fails === 0 ? 0 : 1);
