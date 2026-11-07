<?php
declare(strict_types=1);

/**
 * API de Recordatorios WhatsApp 24h.
 *  POST action=ingest     outcomes desde n8n (secreto del bot); idempotente
 *  POST action=reconcile  fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  GET                    listado (sesión); colaborador puede leer; housekeeping reconcile
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer el historial.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/lib_recordatorios_n8n.php';
require_once __DIR__ . '/lib_whatsapp.php';
require_once __DIR__ . '/lib_mail.php';
require_once __DIR__ . '/pacientes_helpers.php';

/**
 * Normaliza teléfono a dígitos E.164-ish.
 * AR → 549…; ES y otros internacionales se preservan (no forzar 549).
 */
function recordatorios_normalize_phone_input(string $raw): string
{
    $digits = recordatorios_clean_wa_id($raw);
    if ($digits === '') {
        return '';
    }
    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
    }
    // España (+34) y locales 6/7/8/9…
    if (str_starts_with($digits, '34') && strlen($digits) === 11) {
        return $digits;
    }
    if (strlen($digits) === 9 && preg_match('/^[6789]/', $digits)) {
        return '34' . $digits;
    }
    // Otros internacionales conocidos (no AR)
    if (
        (str_starts_with($digits, '598') && strlen($digits) >= 11)
        || (str_starts_with($digits, '56') && strlen($digits) >= 11)
        || (str_starts_with($digits, '1') && strlen($digits) === 11)
    ) {
        return $digits;
    }
    if (function_exists('clean_phone_number')) {
        return clean_phone_number($raw);
    }
    if (strlen($digits) === 10 && str_starts_with($digits, '11')) {
        return '549' . $digits;
    }
    if (strlen($digits) === 11 && str_starts_with($digits, '54') && !str_starts_with($digits, '549')) {
        return '549' . substr($digits, 2);
    }
    return $digits;
}

/** Caso de prueba manual: Martín @ +34 658 44 49 35 */
const RECORDATORIOS_TEST_WA = '34658444935';
const RECORDATORIOS_TEST_NAME = 'Martín Brude';

function recordatorios_is_test_case(array $item): bool
{
    $cal = (string) ($item['calendar_event_id'] ?? '');
    return str_starts_with($cal, 'test:');
}

/**
 * Crea (o reutiliza) un recordatorio pending para probar el envío manual a Martín.
 *
 * @return array{ok:bool,item?:array,created?:bool,error?:string}
 */
function recordatorios_create_manual_test_case(array $auth): array
{
    $user = (string) ($auth['username'] ?? '');
    $role = (string) ($auth['role'] ?? '');
    if ($role !== 'admin' && $user !== 'martin') {
        return ['ok' => false, 'error' => 'Solo admin puede crear el caso de prueba'];
    }

    try {
        $pdo = recordatorios_pdo();
        recordatorios_ensure_schema($pdo);

        // Reutilizar un pending de prueba aún no enviado (evita acumular filas).
        $stmt = $pdo->prepare(
            'SELECT * FROM recordatorio_eventos
             WHERE calendar_event_id LIKE :pfx
               AND status = \'pending\'
               AND wa_id = :wa
             ORDER BY id DESC
             LIMIT 1'
        );
        $stmt->execute([
            'pfx' => 'test:martin:%',
            'wa' => RECORDATORIOS_TEST_WA,
        ]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            return [
                'ok' => true,
                'created' => false,
                'message' => 'Ya tenés un caso de prueba pendiente. Usá «Enviar ahora».',
                'item' => recordatorios_format_item($existing),
            ];
        }

        $tz = recordatorios_tz();
        $nowLocal = new DateTimeImmutable('now', $tz);
        $apptDate = $nowLocal->modify('+1 day')->format('Y-m-d');
        $apptTime = '11:00';
        $stamp = $nowLocal->format('Ymd-His');
        $calId = 'test:martin:' . $stamp;
        $eventKey = 'test:martin:' . bin2hex(random_bytes(8));
        $runAt = time();

        $ev = [
            'event_key' => $eventKey,
            'exec_id' => 'manual-test',
            'run_at' => $runAt,
            'appointment_date' => $apptDate,
            'appointment_time' => $apptTime,
            'calendar_event_id' => $calId,
            'patient_name' => RECORDATORIOS_TEST_NAME,
            'wa_id' => RECORDATORIOS_TEST_WA,
            'status' => 'pending',
            'skip_reason' => '',
            'error_code' => '',
            'error_message' => 'Caso de prueba manual',
            'event_summary' => '[PRUEBA] ' . RECORDATORIOS_TEST_NAME,
        ];
        $outcome = recordatorios_insert_item($pdo, $ev);
        if ($outcome === 'duplicate') {
            return ['ok' => false, 'error' => 'No se pudo crear el caso de prueba (clave duplicada). Reintentá.'];
        }

        $created = recordatorios_find_item_by_id((int) $pdo->lastInsertId());
        if (!$created) {
            // Fallback por event_key
            $q = $pdo->prepare('SELECT * FROM recordatorio_eventos WHERE event_key = :k LIMIT 1');
            $q->execute(['k' => $eventKey]);
            $created = $q->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if (!$created) {
            return ['ok' => false, 'error' => 'Se insertó el caso pero no se pudo releer'];
        }

        return [
            'ok' => true,
            'created' => true,
            'message' => 'Caso de prueba listo: Martín · +34 658 44 49 35. Usá «Enviar ahora».',
            'item' => recordatorios_format_item($created),
        ];
    } catch (Throwable $e) {
        error_log('recordatorios create_test_case: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'Error al crear el caso de prueba'];
    }
}

/**
 * Guarda teléfono/email en el directorio de pacientes (sin cortar la request).
 *
 * @return array{ok:bool, phone?:string, email?:string, error?:string}
 */
function recordatorios_persist_directory_contact(string $patientName, string $phone, string $email): array
{
    $phone = recordatorios_normalize_phone_input($phone);
    $email = strtolower(trim($email));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'El correo electrónico no es válido'];
    }
    if ($phone === '' && $email === '') {
        return ['ok' => false, 'error' => 'Ingresá un teléfono o un correo'];
    }

    $name = trim($patientName);
    if ($name === '') {
        $name = 'Paciente';
    }
    if (is_tk3_or_blocked_name($name)) {
        return ['ok' => false, 'error' => 'El contacto no corresponde a un paciente válido'];
    }
    $parts = preg_split('/\s+/u', $name, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    $nombre = $parts[0] ?? $name;
    $apellido = $parts[1] ?? '';

    try {
        $pdo = recordatorios_pdo();
        ensure_pacientes_tables($pdo);

        if ($phone !== '') {
            if (strlen($phone) < 6 || strlen($phone) > 16) {
                return ['ok' => false, 'error' => 'Número de WhatsApp inválido o incompleto'];
            }
            $existing = function_exists('find_existing_patient_match')
                ? find_existing_patient_match($pdo, $phone, $name)
                : null;

            if ($existing) {
                $existingId = (int) $existing['id'];
                $targetPhone = function_exists('kinesica_resolve_merge_phone')
                    ? kinesica_resolve_merge_phone($pdo, $existing, $phone)
                    : $phone;
                // Cargar WhatsApp desde recordatorios debe reflejarse en el directorio.
                try {
                    if ($targetPhone !== '' && $targetPhone !== (string) ($existing['telefono'] ?? '')) {
                        $pdo->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id')
                            ->execute(['tel' => $targetPhone, 'id' => $existingId]);
                    }
                } catch (Throwable $dup) {
                    error_log('recordatorios persist contact phone collision: ' . $dup->getMessage());
                }
                if ($email !== '' && empty($existing['email'])) {
                    $pdo->prepare('UPDATE pacientes SET email = :email WHERE id = :id')
                        ->execute(['email' => $email, 'id' => $existingId]);
                }
                error_log('recordatorios persist contact merged id=' . $existingId . ' phone=' . $targetPhone);
                return ['ok' => true, 'phone' => $targetPhone !== '' ? $targetPhone : $phone, 'email' => $email, 'id' => $existingId];
            }

            // En colisión de teléfono: NO pisar nombre de un paciente existente; solo completar vacíos y email.
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
            $cleanNom = function_exists('sanitize_patient_name') ? sanitize_patient_name($nombre) : $nombre;
            $cleanApe = function_exists('sanitize_patient_name') ? sanitize_patient_name($apellido) : $apellido;
            $cleanFull = function_exists('sanitize_patient_name') ? sanitize_patient_name($name) : $name;
            $stmt->execute([
                'tel' => $phone,
                'nombre' => mb_substr($cleanNom, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($cleanApe, 0, 60, 'UTF-8'),
                'full' => mb_substr($cleanFull, 0, 120, 'UTF-8'),
                'pila' => mb_substr($cleanNom !== '' ? $cleanNom : $nombre, 0, 60, 'UTF-8'),
                'email' => $email !== '' ? $email : null,
                'origen' => 'admin',
            ]);
            $newId = (int) $pdo->lastInsertId();
            if ($newId <= 0) {
                $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
                $find->execute(['tel' => $phone]);
                $newId = (int) ($find->fetchColumn() ?: 0);
            }
            error_log('recordatorios persist contact inserted id=' . $newId . ' phone=' . $phone);
            // No correr deduplicate_pacientes_table acá: es O(n) sobre todo el directorio
            // y en la carga manual de WhatsApp puede colgar/timeout el request.
            return ['ok' => true, 'phone' => $phone, 'email' => $email, 'id' => $newId];
        }

        // Solo email: actualizar paciente existente por nombre o crear placeholder no es posible sin teléfono único.
        $stmt = $pdo->prepare(
            'UPDATE pacientes SET email = :email
             WHERE LOWER(nombre_completo) = LOWER(:full) AND (email IS NULL OR email = "")
             LIMIT 1'
        );
        $stmt->execute(['email' => $email, 'full' => $name]);
        if ($stmt->rowCount() < 1) {
            $stmt2 = $pdo->prepare(
                'UPDATE pacientes SET email = :email WHERE LOWER(nombre_completo) = LOWER(:full) LIMIT 1'
            );
            $stmt2->execute(['email' => $email, 'full' => $name]);
            if ($stmt2->rowCount() < 1) {
                return [
                    'ok' => false,
                    'error' => 'Para guardar solo el mail, el paciente debe existir en el directorio o cargá también un WhatsApp',
                ];
            }
        }
        return ['ok' => true, 'phone' => '', 'email' => $email];
    } catch (Throwable $e) {
        error_log('recordatorios persist contact: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'No se pudo guardar el contacto en el directorio'];
    }
}

/**
 * Actualiza el recordatorio con el contacto cargado desde el admin.
 *
 * @return array{ok:bool, item?:array, message?:string, error?:string, directory?:array}
 */
function recordatorios_save_contact(int $id, array $input, array $auth): array
{
    $item = recordatorios_find_item_by_id($id);
    if (!$item) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado'];
    }

    $rawPhone = trim((string) ($input['wa_id'] ?? $input['phone'] ?? ''));
    $phone = recordatorios_normalize_phone_input($rawPhone);
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'error' => 'El correo electrónico no es válido'];
    }
    if ($phone === '' && $email === '') {
        return ['ok' => false, 'error' => 'Ingresá un número de WhatsApp o un correo electrónico'];
    }

    // Validar WhatsApp acá para fallar claro antes de tocar directorio/recordatorio.
    if ($phone !== '' && (strlen($phone) < 6 || strlen($phone) > 16)) {
        return ['ok' => false, 'error' => 'Número de WhatsApp inválido o incompleto'];
    }

    // 1) Primero el recordatorio (lo que el usuario ve). El directorio es secundario.
    $updates = [];
    if ($phone !== '') {
        $updates['wa_id'] = $phone;
    }
    $user = preg_replace('/[^\p{L}\p{N}._@\-\s]/u', '', (string) ($auth['username'] ?? $auth['name'] ?? 'admin')) ?: 'admin';
    $user = mb_substr($user, 0, 40, 'UTF-8');
    $status = (string) ($item['status'] ?? '');
    $prevErr = (string) ($item['error_message'] ?? '');
    if ($email !== '') {
        // Guardar email en el registro sin borrar el error Meta de un fallo previo.
        if (in_array($status, ['pending', 'missing_phone', 'skipped'], true)) {
            $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
        } elseif ($status === 'failed') {
            if (str_starts_with($prevErr, 'contact_email:')) {
                $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
            } elseif ($prevErr === '') {
                $updates['error_message'] = 'contact_email:' . $email . ' (Cargado por ' . $user . ')';
            }
            // Si había un error Meta, se conserva; el email queda en el directorio / campo email de la vista.
        }
    } elseif ($phone !== '' && str_starts_with($prevErr, 'contact_email:')) {
        $updates['error_message'] = 'WhatsApp cargado por ' . $user;
    }

    if ($status === 'missing_phone' && ($phone !== '' || $email !== '')) {
        $updates['status'] = 'pending';
        $updates['error_code'] = '';
        if ($phone !== '' && empty($updates['error_message'])) {
            $updates['error_message'] = 'Contacto cargado por ' . $user;
        }
    }

    if ($updates) {
        $saved = recordatorios_update_outcome($id, $updates);
        if (!$saved) {
            return ['ok' => false, 'error' => 'No se pudo actualizar el recordatorio'];
        }
    }

    // 2) Directorio (best-effort): no debe tumbar la carga del WhatsApp en el turno.
    $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: ''));
    $dir = recordatorios_persist_directory_contact($patientName, $phone, $email);
    $dirOk = !empty($dir['ok']);

    $updated = recordatorios_find_item_by_id($id);
    $viewItem = recordatorios_format_item($updated ?: $item, $email !== '' ? $email : null);
    if ($phone !== '') {
        $viewItem['wa_id'] = $phone;
    }
    if ($email !== '') {
        $viewItem['email'] = $email;
    }

    $parts = [];
    if ($phone !== '') {
        $parts[] = 'WhatsApp ' . $phone;
    }
    if ($email !== '') {
        $parts[] = 'email ' . $email;
    }
    $msg = 'Contacto guardado (' . implode(' · ', $parts) . ') en este recordatorio';
    $msg .= $dirOk ? ' y en el directorio de pacientes.' : '.';
    if (!$dirOk && !empty($dir['error'])) {
        $msg .= ' Aviso: ' . $dir['error'] . '.';
    }
    return [
        'ok' => true,
        'status' => 'success',
        'message' => $msg,
        'item' => $viewItem,
        'directory' => $dir,
    ];
}

function recordatorios_request_secret(): string
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $secret = (string) ($headers['X-Kinesica-Bot-Secret'] ?? $headers['x-kinesica-bot-secret'] ?? $_SERVER['HTTP_X_KINESICA_BOT_SECRET'] ?? '');
    if ($secret === '' && preg_match('/^Bearer\s+(.+)$/i', (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''), $m)) {
        $secret = trim($m[1]);
    }
    return $secret;
}

function recordatorios_bot_authenticated(): bool
{
    $given = recordatorios_request_secret();
    if ($given === '') {
        return false;
    }
    $valid = [];
    foreach (['webhook_secret', 'bot_token'] as $k) {
        $v = trim((string) (cfg()[$k] ?? ''));
        if ($v !== '' && $v !== 'CAMBIAR') {
            $valid[] = $v;
        }
    }
    if ((cfg()['allow_legacy_bot_secret'] ?? false) === true) {
        $legacy = trim((string) (cfg()['legacy_bot_secret'] ?? ''));
        if ($legacy !== '' && $legacy !== 'CAMBIAR') {
            $valid[] = $legacy;
        }
    }
    foreach ($valid as $secret) {
        if (hash_equals($secret, $given)) {
            return true;
        }
    }
    return false;
}

function recordatorios_handle_ingest(array $input): void
{
    $raw = $input['items'] ?? [];
    if (!is_array($raw) || count($raw) > RECORDATORIOS_MAX_BATCH) {
        json_out(413, ['error' => 'items debe ser un arreglo de hasta ' . RECORDATORIOS_MAX_BATCH]);
    }
    $execId = trim((string) ($input['exec_id'] ?? $input['execution_id'] ?? ''));
    $runAt = recordatorios_parse_run_at($input['run_at'] ?? null, time());
    $items = [];
    $invalid = 0;
    foreach ($raw as $r) {
        if (!is_array($r)) {
            $invalid++;
            continue;
        }
        $n = recordatorios_normalize_item($r, $execId, $runAt);
        if ($n === null) {
            $invalid++;
            continue;
        }
        $items[] = $n;
    }
    if (!$items) {
        json_out(400, ['error' => 'Sin items válidos (status + calendar_event_id o run_skipped)', 'invalid' => $invalid]);
    }
    $res = recordatorios_store_items($items);
    if ($res['failed'] > 0) {
        json_out(500, ['error' => 'No se pudo guardar; reintentar', 'invalid' => $invalid] + $res);
    }
    json_out(200, ['ok' => true, 'invalid' => $invalid] + $res);
}

function recordatorios_run_housekeeping(bool $force): array
{
    $out = ['reconcile' => null, 'prevision' => null];
    try {
        if (recordatorios_reconcile_due($force ? 10 : 60)) {
            $out['reconcile'] = recordatorios_reconcile(null, 6);
        }
    } catch (Throwable $e) {
        error_log('recordatorios housekeeping: ' . $e->getMessage());
    }
    try {
        if ($force || recordatorios_prevision_due(300)) {
            $out['prevision'] = recordatorios_trigger_prevision();
        }
    } catch (Throwable $e) {
        error_log('recordatorios prevision: ' . $e->getMessage());
    }
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? read_json() : [];
$action = (string) ($input['action'] ?? '');

if ($method === 'POST' && in_array($action, ['ingest', 'reconcile'], true) && recordatorios_bot_authenticated()) {
    if ($action === 'ingest') {
        recordatorios_handle_ingest($input);
    }
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($method === 'POST' && $action === 'ingest') {
    json_out(401, ['error' => 'No autorizado']);
}

require_header();
$auth = require_auth();

if ($method === 'GET') {
    $house = recordatorios_run_housekeeping(!empty($_GET['sync']));
    try {
        $days = isset($_GET['days']) ? (int) $_GET['days'] : RECORDATORIOS_DEFAULT_DAYS;
        $view = recordatorios_load_view(null, $days);
    } catch (Throwable $e) {
        error_log('recordatorios GET: ' . $e->getMessage());
        json_out(503, ['error' => 'Base de datos no disponible']);
    }
    $st = recordatorios_reconcile_state();
    json_out(200, [
        'ok' => true,
        'status' => 'success',
        'total' => $view['total'],
        'days' => $view['days'],
        'counts' => $view['counts'],
        'items' => $view['items'],
        'grouped' => $view['grouped'],
        'sync' => $house['reconcile'],
        'reconcile' => [
            'status' => $st['status'] ?? null,
            'last_run' => $st['last_run'] ?? null,
            'last_ok' => $st['last_ok'] ?? null,
            'imported_last_run' => $st['imported_last_run'] ?? null,
            'message' => $st['message'] ?? null,
            'baseline_ts' => $st['baseline_ts'] ?? null,
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

if (is_colaborador($auth)) {
    json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
}

function recordatorios_dispatch_manual(int $id, array $input, array $auth): array
{
    $item = recordatorios_find_item_by_id($id);
    if (!$item) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado'];
    }

    $rawPhone = trim((string) ($input['wa_id'] ?? $input['phone'] ?? $item['wa_id'] ?? ''));
    $phone = recordatorios_normalize_phone_input($rawPhone);

    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email === '') {
        $email = recordatorios_extract_contact_email((string) ($item['error_message'] ?? ''));
    }
    if ($email === '' && $item['status'] === 'sent_email') {
        $email = strtolower(trim((string) $item['error_message']));
    }
    if ($email === '' && !empty($item['patient_name'])) {
        try {
            $pdo = recordatorios_pdo();
            $stmt = $pdo->prepare('SELECT email FROM pacientes WHERE (nombre_completo LIKE :nc OR (telefono != "" AND telefono = :tel)) AND email != "" LIMIT 1');
            $stmt->execute(['nc' => '%' . $item['patient_name'] . '%', 'tel' => $phone]);
            $foundEmail = $stmt->fetchColumn();
            if ($foundEmail) {
                $email = strtolower(trim((string) $foundEmail));
            }
        } catch (Throwable $e) {}
    }

    // Persistir contacto cargado en el modal para próximas corridas / directorio.
    // Los casos de prueba (test:…) no escriben en el directorio de pacientes.
    $saveContact = !isset($input['save_contact']) || !empty($input['save_contact']);
    if ($saveContact && !recordatorios_is_test_case($item) && ($phone !== '' || $email !== '')) {
        $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: ''));
        recordatorios_persist_directory_contact($patientName, $phone, $email);
    }

    $channel = strtolower(trim((string) ($input['channel'] ?? 'auto')));
    if (!in_array($channel, ['auto', 'whatsapp', 'email'], true)) {
        $channel = 'auto';
    }

    $patientName = trim((string) ($item['patient_name'] ?: $item['event_summary'] ?: 'Estimado/a paciente'));
    $apptTime = trim((string) ($item['appointment_time'] ?? ''));
    $apptDate = trim((string) ($item['appointment_date'] ?? ''));
    $summary = trim((string) ($item['event_summary'] ?? ''));
    $user = (string) ($auth['username'] ?? $auth['name'] ?? 'admin');

    $isCall = stripos($summary, 'llamada') !== false;
    $tipoCita = $isCall ? 'llamada de orientación de 10 minutos' : 'sesión en el consultorio';
    $indicaciones = $isCall
        ? '📞 Norberto se comunicará con vos puntualmente a este número de WhatsApp.'
        : '📍 Te esperamos en Charcas 3889, 5º, B (Palermo).\n⚠️ Te recordamos puntualidad estricta para evitar esperas y no concurrir con acompañantes (salvo menores o asistencia directa).';

    $firstName = $patientName;
    $clean = preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/i', '', $patientName);
    $parts = preg_split('/\s+/', trim((string) $clean));
    if (!empty($parts[0]) && mb_strlen($parts[0]) >= 2) {
        $firstName = $parts[0];
    }

    $isTestCase = recordatorios_is_test_case($item);

    // Regla estricta: No debe intentar enviarse recordatorio más de una vez por día a nadie
    if (in_array($item['status'], ['sent', 'sent_email'], true)) {
        return ['ok' => false, 'error' => 'Este recordatorio ya fue enviado exitosamente hoy.'];
    }

    // Regla: No tiene sentido enviar recordatorio si el turno ya pasó
    // (los casos de prueba usan turno de mañana; se permiten reintentos).
    if (
        !$isTestCase
        && function_exists('recordatorios_is_appointment_past')
        && recordatorios_is_appointment_past($apptDate, $apptTime)
    ) {
        return ['ok' => false, 'error' => 'El horario del turno ya pasó. No se puede enviar un recordatorio.'];
    }

    // Deduplicación diaria: no aplica a casos de prueba (test:…) para poder reintentar a mano.
    if (!$isTestCase) {
        try {
            $pdo = recordatorios_pdo();
            $cleanPhoneEnd = $phone !== '' ? substr(recordatorios_clean_wa_id($phone), -10) : '';
            $pName = trim((string) ($item['patient_name'] ?? ''));
            // La regla de un envío diario usa el día local de la clínica (Buenos Aires),
            // aunque received_at se persista en UTC.
            $localTz = recordatorios_tz();
            $localDayStart = new DateTimeImmutable('now', $localTz)
                ->setTime(0, 0, 0)
                ->setTimezone(new DateTimeZone('UTC'));
            $localDayEnd = $localDayStart->modify('+1 day');

            $conds = [];
            $chkParams = [
                'id' => $id,
                'day_start' => $localDayStart->format('Y-m-d H:i:s'),
                'day_end' => $localDayEnd->format('Y-m-d H:i:s'),
            ];
            if ($cleanPhoneEnd !== '') {
                $conds[] = 'RIGHT(wa_id, 10) = :phone_end';
                $chkParams['phone_end'] = $cleanPhoneEnd;
            }
            if ($email !== '') {
                $conds[] = 'LOWER(error_message) LIKE :email_match';
                $chkParams['email_match'] = '%' . $email . '%';
            }
            if ($pName !== '' && $pName !== 'Estimado/a paciente') {
                $conds[] = 'LOWER(patient_name) = LOWER(:pname)';
                $chkParams['pname'] = $pName;
            }

            if (!empty($conds)) {
                $chkSql = 'SELECT id, status, appointment_time, received_at FROM recordatorio_eventos
                    WHERE id != :id
                      AND status IN ("sent", "sent_email")
                      AND received_at >= :day_start
                      AND received_at < :day_end
                      AND calendar_event_id NOT LIKE \'test:%\'
                      AND (' . implode(' OR ', $conds) . ')
                    LIMIT 1';
                $stmt = $pdo->prepare($chkSql);
                $stmt->execute($chkParams);
                $alreadySent = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($alreadySent) {
                    return [
                        'ok' => false,
                        'error' => 'Ya se envió un recordatorio hoy a este paciente (' . ($alreadySent['status'] === 'sent' ? 'WhatsApp' : 'Email') . '). Máximo 1 envío por día.',
                    ];
                }
            }
        } catch (Throwable $e) {}
    }

    // 1. Enviar por Email si el canal elegido es 'email' o si 'auto' sin teléfono pero con email
    if ($channel === 'email' || ($channel === 'auto' && $phone === '' && $email !== '')) {
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Email no válido para el envío'];
        }

        $subject = 'Recordatorio de turno — Kinésica';
        $when = trim($apptDate . ' ' . $apptTime);
        $html = '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">'
            . '<h2 style="color:#0b2545;">Recordatorio de turno — Kinésica</h2>'
            . '<p>¡Hola <strong>' . htmlspecialchars($firstName) . '</strong>! Te escribimos para recordarte tu turno:</p>'
            . '<ul>'
            . '<li><strong>Tipo:</strong> ' . htmlspecialchars($tipoCita) . '</li>'
            . '<li><strong>Horario:</strong> ' . htmlspecialchars($when !== '' ? $when : $apptTime) . '</li>'
            . ($isCall ? '<li><strong>Modalidad:</strong> Llamada por WhatsApp</li>' : '<li><strong>Ubicación:</strong> Charcas 3889, 5º, B (Palermo)</li>')
            . '</ul>'
            . '<p>' . nl2br(htmlspecialchars($indicaciones)) . '</p>'
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor respondé a este correo o escribinos por WhatsApp.</p>'
            . '</div>';
        $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} - {$when}.\n{$indicaciones}\nKinésica";

        $mailSent = send_html_mail($email, $subject, $html, $text);
        if ($mailSent) {
            $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent_email:' . time();
            recordatorios_update_outcome($id, [
                'status' => 'sent_email',
                'error_code' => '',
                'error_message' => $email . ' (Manual por ' . $user . ')',
                'run_at' => gmdate('Y-m-d H:i:s'),
                'received_at' => gmdate('Y-m-d H:i:s'),
                'event_key' => $newKey,
            ]);
            $updated = recordatorios_find_item_by_id($id);
            return [
                'ok' => true,
                'status' => 'success',
                'message' => 'Recordatorio enviado por correo a ' . $email,
                'channel' => 'email',
                'item' => recordatorios_format_item($updated ?: $item, $email),
            ];
        }
        return ['ok' => false, 'error' => 'No se pudo enviar el correo a ' . $email];
    }

    // 2. Enviar por WhatsApp
    if ($phone === '') {
        return ['ok' => false, 'error' => 'Se requiere un número de WhatsApp válido para el envío'];
    }

    $waRes = send_whatsapp_reminder_template($phone, [
        'patient_name' => $firstName,
        'tipo_cita' => $tipoCita,
        'formatted_time' => $apptTime !== '' ? $apptTime : 'horario convenido',
        'indicaciones' => $indicaciones,
        'event_id' => (string) ($item['calendar_event_id'] ?? ''),
    ]);

    if (!empty($waRes['ok'])) {
        $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent:' . time();
        recordatorios_update_outcome($id, [
            'status' => 'sent',
            'wa_id' => $phone,
            'error_code' => '',
            'error_message' => 'Disparado manual por ' . $user,
            'run_at' => gmdate('Y-m-d H:i:s'),
            'received_at' => gmdate('Y-m-d H:i:s'),
            'event_key' => $newKey,
        ]);
        $updated = recordatorios_find_item_by_id($id);
        return [
            'ok' => true,
            'status' => 'success',
            'message' => 'Recordatorio enviado por WhatsApp a ' . $phone,
            'channel' => 'whatsapp',
            'item' => recordatorios_format_item($updated ?: $item, $email !== '' ? $email : null),
        ];
    }

    if ($channel === 'auto' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $subject = 'Recordatorio de turno — Kinésica';
        $when = trim($apptDate . ' ' . $apptTime);
        $html = '<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">'
            . '<h2 style="color:#0b2545;">Recordatorio de turno — Kinésica</h2>'
            . '<p>¡Hola <strong>' . htmlspecialchars($firstName) . '</strong>! Te escribimos para recordarte tu turno:</p>'
            . '<ul>'
            . '<li><strong>Tipo:</strong> ' . htmlspecialchars($tipoCita) . '</li>'
            . '<li><strong>Horario:</strong> ' . htmlspecialchars($when !== '' ? $when : $apptTime) . '</li>'
            . ($isCall ? '<li><strong>Modalidad:</strong> Llamada por WhatsApp</li>' : '<li><strong>Ubicación:</strong> Charcas 3889, 5º, B (Palermo)</li>')
            . '</ul>'
            . '<p>' . nl2br(htmlspecialchars($indicaciones)) . '</p>'
            . '<p style="margin-top:20px;color:#6b7280;font-size:13px;">Si necesitás reprogramar o cancelar, por favor respondé a este correo o escribinos por WhatsApp.</p>'
            . '</div>';
        $text = "Hola {$firstName},\nRecordatorio de tu turno: {$tipoCita} - {$when}.\n{$indicaciones}\nKinésica";
        if (send_html_mail($email, $subject, $html, $text)) {
            $newKey = 'rem:' . $item['exec_id'] . ':' . $item['calendar_event_id'] . ':sent_email:' . time();
            recordatorios_update_outcome($id, [
                'status' => 'sent_email',
                'wa_id' => $phone,
                'error_code' => '',
                'error_message' => $email . ' (Fallback manual por ' . $user . ')',
                'run_at' => gmdate('Y-m-d H:i:s'),
                'received_at' => gmdate('Y-m-d H:i:s'),
                'event_key' => $newKey,
            ]);
            $updated = recordatorios_find_item_by_id($id);
            return [
                'ok' => true,
                'status' => 'success',
                'message' => 'WhatsApp no entregó, pero se envió exitosamente por correo a ' . $email,
                'channel' => 'email',
                'item' => recordatorios_format_item($updated ?: $item, $email),
            ];
        }
    }

    $errMsg = (string) ($waRes['error'] ?? 'No se pudo entregar el mensaje por WhatsApp');
    recordatorios_update_outcome($id, [
        'wa_id' => $phone,
        'error_code' => 'manual_failed',
        'error_message' => substr($errMsg, 0, 500),
    ]);
    return [
        'ok' => false,
        'error' => 'No se pudo enviar el recordatorio: ' . $errMsg,
    ];
}

if ($action === 'reconcile') {
    json_out(200, ['ok' => true] + recordatorios_reconcile(null, 8));
}

if ($action === 'save_contact' || $action === 'update_contact') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_out(400, ['error' => 'ID de recordatorio inválido']);
    }
    $res = recordatorios_save_contact($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    json_out(400, $res);
}

if ($action === 'create_test_case' || $action === 'seed_test') {
    $res = recordatorios_create_manual_test_case($auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    }
    json_out(isset($res['error']) && str_contains((string) $res['error'], 'Solo admin') ? 403 : 400, $res);
}

if ($action === 'dispatch' || $action === 'retry' || $action === 'send_manual') {
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        json_out(400, ['error' => 'ID de recordatorio inválido']);
    }
    $res = recordatorios_dispatch_manual($id, $input, $auth);
    if (!empty($res['ok'])) {
        json_out(200, $res);
    } else {
        json_out(400, $res);
    }
}

json_out(400, ['error' => 'Acción no soportada']);
