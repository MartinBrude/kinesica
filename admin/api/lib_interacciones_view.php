<?php
declare(strict_types=1);

/**
 * Vista derivada de interacciones: conversaciones = eventos agrupados por teléfono + día (zona del consultorio)
 * más el estado mutable (respondida / archivada) guardado aparte. Nada de esto borra eventos.
 */

require_once __DIR__ . '/lib_interacciones_store.php';

/** Ventana por defecto del panel (días locales del consultorio). */
const INTERACCIONES_DEFAULT_DAYS = 7;
/** Máximo pedible por query ?days= (evita tirar de todo el historial). */
const INTERACCIONES_MAX_DAYS = 90;
/** Tope de eventos crudos por request (los más recientes dentro de la ventana). */
const INTERACCIONES_MAX_EVENTS = 5000;

function interacciones_phone_format(string $digits): string
{
    $d = interacciones_clean_wa_id($digits);
    if ($d === '') {
        return 'Desconocido';
    }
    if (strncmp($d, '54911', 5) === 0 && strlen($d) === 13) {
        return '(+54) 9 11 ' . substr($d, 5, 4) . ' ' . substr($d, 9);
    }
    if (strncmp($d, '549', 3) === 0 && strlen($d) >= 12) {
        $rest = substr($d, 3);
        if (strlen($rest) === 10) {
            return '(+54) 9 ' . substr($rest, 0, 3) . ' ' . substr($rest, 3, 3) . ' ' . substr($rest, 6);
        }
        if (strlen($rest) >= 8) {
            $p1 = substr($rest, -8, 4);
            $p2 = substr($rest, -4);
            $area = substr($rest, 0, -8);
            return '(+54) 9 ' . $area . ' ' . $p1 . ' ' . $p2;
        }
        return '(+54) 9 ' . $rest;
    }
    if (strncmp($d, '54', 2) === 0 && strlen($d) >= 10) {
        $rest = substr($d, 2);
        if (strncmp($rest, '11', 2) === 0 && strlen($rest) === 10) {
            return '(+54) 11 ' . substr($rest, 2, 4) . ' ' . substr($rest, 6);
        }
        return '(+54) ' . $rest;
    }
    if (strncmp($d, '011', 3) === 0 && strlen($d) === 11) {
        return '(+54) 9 11 ' . substr($d, 3, 4) . ' ' . substr($d, 7);
    }
    if ((strncmp($d, '11', 2) === 0 || strncmp($d, '15', 2) === 0) && strlen($d) === 10) {
        return '(+54) 9 11 ' . substr($d, 2, 4) . ' ' . substr($d, 6);
    }
    if (strncmp($d, '34', 2) === 0 && strlen($d) === 11) {
        return '(+34) ' . substr($d, 2, 3) . ' ' . substr($d, 5, 2) . ' ' . substr($d, 7, 2) . ' ' . substr($d, 9);
    }
    if (strlen($d) === 9 && in_array($d[0], ['6', '7', '8', '9'], true)) {
        return '(+34) ' . substr($d, 0, 3) . ' ' . substr($d, 3, 2) . ' ' . substr($d, 5, 2) . ' ' . substr($d, 7);
    }
    if (strncmp($d, '598', 3) === 0 && strlen($d) >= 11) {
        $rest = substr($d, 3);
        return '(+598) ' . substr($rest, 0, 2) . ' ' . substr($rest, 2, 3) . ' ' . substr($rest, 5);
    }
    if (strncmp($d, '56', 2) === 0 && strlen($d) >= 11) {
        $rest = substr($d, 2);
        return '(+56) ' . substr($rest, 0, 1) . ' ' . substr($rest, 1, 4) . ' ' . substr($rest, 5);
    }
    if (strncmp($d, '1', 1) === 0 && strlen($d) === 11) {
        return '(+1) ' . substr($d, 1, 3) . ' ' . substr($d, 4, 3) . ' ' . substr($d, 7);
    }
    return '+' . $d;
}

/** Números conocidos (dígitos exactos => nombre). Ampliable con cfg()['interacciones_known_numbers']. */
function interacciones_known_names(): array
{
    $known = ['34658444935' => 'Martín Brude'];
    if (function_exists('cfg')) {
        $extra = cfg()['interacciones_known_numbers'] ?? [];
        if (is_array($extra)) {
            foreach ($extra as $num => $name) {
                $digits = interacciones_clean_wa_id((string) $num);
                if ($digits !== '' && is_string($name) && $name !== '') {
                    $known[$digits] = $name;
                }
            }
        }
    }
    return $known;
}

function interacciones_known_name(string $waId): string
{
    $d = ltrim(interacciones_clean_wa_id($waId), '0');
    return interacciones_known_names()[$d] ?? '';
}

/**
 * Clave de cruce teléfono WhatsApp ↔ directorio de pacientes (últimos 10 dígitos).
 * Usa clean_phone_number cuando está disponible para unificar 15… / 11… / 549….
 */
function interacciones_phone_match_key(string $raw): string
{
    $digits = '';
    if (function_exists('clean_phone_number')) {
        $digits = clean_phone_number($raw);
    }
    if ($digits === '') {
        $digits = interacciones_clean_wa_id($raw);
    }
    if ($digits === '') {
        return '';
    }
    $end = substr($digits, -10);
    return strlen($end) >= 8 ? $end : $digits;
}

/**
 * Resuelve nombres del directorio de pacientes por teléfono (match por últimos 10 dígitos).
 *
 * @param list<string> $waIds
 * @return array<string,string> match_key => nombre_completo
 */
function interacciones_lookup_directory_names(PDO $pdo, array $waIds): array
{
    $out = [];
    $ends = [];
    foreach ($waIds as $wa) {
        $key = interacciones_phone_match_key((string) $wa);
        if ($key !== '') {
            $ends[$key] = true;
        }
    }
    if (!$ends) {
        return $out;
    }
    try {
        if (function_exists('ensure_pacientes_tables')) {
            ensure_pacientes_tables($pdo);
        }
        // Match en PHP (clean_phone_number unifica 15…/11…/549…). El directorio es chico.
        $stmt = $pdo->query(
            "SELECT telefono, nombre_completo FROM pacientes
             WHERE telefono IS NOT NULL AND telefono != ''
               AND nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''
             LIMIT 5000"
        );
        if ($stmt === false) {
            return $out;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = interacciones_phone_match_key((string) ($row['telefono'] ?? ''));
            $name = trim((string) ($row['nombre_completo'] ?? ''));
            if ($key !== '' && $name !== '' && isset($ends[$key]) && !isset($out[$key])) {
                $out[$key] = mb_substr($name, 0, 120, 'UTF-8');
            }
        }
    } catch (Throwable $e) {
        // Directorio opcional: no bloquear la vista de interacciones.
    }
    return $out;
}

/**
 * Fallback: nombre desde recordatorios enviados (mismo teléfono, últimos días).
 *
 * @param list<string> $waIds
 * @return array<string,string> match_key => patient_name
 */
function interacciones_lookup_recordatorio_names(PDO $pdo, array $waIds): array
{
    $out = [];
    $ends = [];
    foreach ($waIds as $wa) {
        $key = interacciones_phone_match_key((string) $wa);
        if ($key !== '') {
            $ends[$key] = true;
        }
    }
    if (!$ends) {
        return $out;
    }
    try {
        $exists = $pdo->query("SHOW TABLES LIKE 'recordatorio_eventos'");
        if (!$exists || !$exists->fetchColumn()) {
            return $out;
        }
        $stmt = $pdo->query(
            "SELECT wa_id, patient_name FROM recordatorio_eventos
             WHERE wa_id IS NOT NULL AND wa_id != ''
               AND patient_name IS NOT NULL AND TRIM(patient_name) != ''
               AND status IN ('sent', 'sent_email', 'pending', 'failed', 'missing_phone')
             ORDER BY id DESC
             LIMIT 2000"
        );
        if ($stmt === false) {
            return $out;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = interacciones_phone_match_key((string) ($row['wa_id'] ?? ''));
            $name = trim((string) ($row['patient_name'] ?? ''));
            if ($key !== '' && $name !== '' && isset($ends[$key]) && !isset($out[$key])) {
                $out[$key] = mb_substr($name, 0, 120, 'UTF-8');
            }
        }
    } catch (Throwable $e) {
        // Recordatorios opcionales.
    }
    return $out;
}

/**
 * True si el texto es la confirmación del recordatorio 24h (botón Confirmo / payload).
 * Esas hilos no requieren acción en el panel → van como respondidas.
 */
function interacciones_is_turn_confirmation(string $body): bool
{
    $raw = trim($body);
    if ($raw === '') {
        return false;
    }
    if (preg_match('/^confirmar_turno(?::|$)/i', $raw)) {
        return true;
    }
    $plain = mb_strtolower($raw, 'UTF-8');
    $plain = strtr($plain, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    $plain = preg_replace('/[^a-z0-9\s]/u', ' ', $plain) ?? $plain;
    $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? $plain);
    return (bool) preg_match('/^confirm[oa](?:r)?(?: el turno)?$/u', $plain);
}

/**
 * Hilos de diagnóstico / opciones PRUEBA que no deben quedar pendientes en el panel.
 *
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_diagnostic_noise(array $messages, string $patientName = ''): bool
{
    if (preg_match('/^test$/iu', trim($patientName))) {
        return true;
    }
    $patientTexts = [];
    $claraTexts = [];
    foreach ($messages as $m) {
        $text = trim((string) ($m['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        if (($m['from'] ?? '') === 'patient') {
            $patientTexts[] = $text;
        } elseif (($m['from'] ?? '') === 'clara') {
            $claraTexts[] = $text;
        }
    }
    if (!$patientTexts) {
        return false;
    }
    $allPatientDiagnostic = true;
    foreach ($patientTexts as $text) {
        if (!preg_match('/^test(?:\s+de\s+diagn[oó]stico)?$/iu', $text)
            && !preg_match('/^PRUEBA[-\s]?\d+/iu', $text)) {
            $allPatientDiagnostic = false;
            break;
        }
    }
    if ($allPatientDiagnostic) {
        return true;
    }
    foreach ($claraTexts as $text) {
        if (preg_match('/^respuesta\s+de\s+prueba\b/iu', $text) || preg_match('/\bPRUEBA-\d+/u', $text)) {
            return true;
        }
    }
    return false;
}

/**
 * @param list<array{from?:string,text?:string}> $messages
 */
function interacciones_thread_is_turn_confirmation(array $messages): bool
{
    $patientTexts = [];
    foreach ($messages as $m) {
        if (($m['from'] ?? '') !== 'patient') {
            continue;
        }
        $text = trim((string) ($m['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $patientTexts[] = $text;
    }
    if (!$patientTexts) {
        return false;
    }
    foreach ($patientTexts as $text) {
        if (!interacciones_is_turn_confirmation($text)) {
            return false;
        }
    }
    return true;
}

/** @return array{0:string,1:string} [category, label] */
function interacciones_classify(string $firstPatientBody, string $waId): array
{
    if (interacciones_is_turn_confirmation($firstPatientBody)) {
        return ['confirmacion_turno', '✅ Confirmación de turno'];
    }
    $lower = mb_strtolower($firstPatientBody, 'UTF-8');
    if (strpos($lower, 'osde') !== false || strpos($lower, 'obra social') !== false) {
        return ['cobertura', '💳 Cobertura OSDE / Prepaga'];
    }
    if (strpos($lower, 'precio') !== false || strpos($lower, 'honorario') !== false || $lower === 'c') {
        return ['honorarios', '💰 Honorarios y Aranceles'];
    }
    if (interacciones_known_name($waId) !== '') {
        return ['prueba_admin', '🧪 Prueba Técnica'];
    }
    return ['consulta_general', 'Consulta WhatsApp'];
}

function interacciones_iso(?string $utc): ?string
{
    return ($utc === null || $utc === '') ? null : str_replace(' ', 'T', $utc) . 'Z';
}

/**
 * Construye el descriptor de archivo adjunto para un mensaje a partir de la BD y/o el sidecar en disco.
 *
 * @return array{media_id:string,type:string,mime:string,filename:string,available:bool,url:string,download_url:string}|null
 */
function interacciones_build_attachment_view(?string $mediaId, ?string $mediaType, ?string $mediaMime, ?string $mediaFilename): ?array
{
    $mid = interacciones_clean_media_id((string) ($mediaId ?? ''));
    if ($mid === '') {
        return null;
    }
    $type = trim((string) ($mediaType ?? ''));
    $mime = trim((string) ($mediaMime ?? ''));
    $filename = trim((string) ($mediaFilename ?? ''));
    $available = false;

    $dir = interacciones_media_dir();
    $metaFile = $dir . '/' . $mid . '.json';
    if (is_file($metaFile)) {
        $meta = json_decode((string) @file_get_contents($metaFile), true);
        if (is_array($meta)) {
            if ($mime === '' && !empty($meta['mime_type'])) {
                $mime = (string) $meta['mime_type'];
            }
            if ($filename === '' && !empty($meta['filename'])) {
                $filename = (string) $meta['filename'];
            }
            if ($type === '' && !empty($meta['media_type'])) {
                $type = (string) $meta['media_type'];
            }
            $storedFile = isset($meta['stored_file']) ? basename((string) $meta['stored_file']) : '';
            if ($storedFile !== '' && is_file($dir . '/' . $storedFile)) {
                $available = true;
            }
        }
    }

    if ($type === '') {
        if (str_starts_with($mime, 'image/')) {
            $type = 'imagen';
        } elseif (str_starts_with($mime, 'audio/')) {
            $type = 'audio';
        } elseif (str_starts_with($mime, 'video/')) {
            $type = 'video';
        } else {
            $type = 'documento';
        }
    }
    if ($mime === '') {
        $mime = match ($type) {
            'imagen' => 'image/jpeg',
            'audio' => 'audio/ogg',
            'video' => 'video/mp4',
            default => 'application/pdf',
        };
    }
    if ($filename === '') {
        $filename = match ($type) {
            'imagen' => 'imagen_adjunta.jpg',
            'audio' => 'audio_voz.ogg',
            'video' => 'video_adjunto.mp4',
            default => 'documento.pdf',
        };
    }

    $q = rawurlencode($mid);
    return [
        'media_id' => $mid,
        'type' => $type,
        'mime' => $mime,
        'filename' => $filename,
        'available' => $available,
        'url' => '/admin/api/interacciones_media.php?media_id=' . $q,
        'download_url' => '/admin/api/interacciones_media.php?media_id=' . $q . '&download=1',
    ];
}

/**
 * Oculta (solo en la vista) eventos "gemelos": el mismo mensaje registrado por una fuente sin id de WhatsApp
 * y por otra con id. Empareja 1 a 1; nada se borra.
 *
 * @param list<array> $events
 * @return array<int,true> ids de eventos ocultos
 */
function interacciones_hidden_twins(array $events): array
{
    $hidden = [];
    foreach ($events as $a) {
        if (strncmp($a['event_key'], 'wa:', 3) !== 0) {
            continue;
        }
        $bestId = null;
        $bestDiff = 181;
        foreach ($events as $b) {
            if (isset($hidden[$b['id']]) || strncmp($b['event_key'], 'wa:', 3) === 0) {
                continue;
            }
            if ($b['direction'] !== $a['direction'] || $b['body'] !== $a['body']) {
                continue;
            }
            $diff = abs($b['ts'] - $a['ts']);
            if ($diff < $bestDiff) {
                $bestDiff = $diff;
                $bestId = $b['id'];
            }
        }
        if ($bestId !== null) {
            $hidden[$bestId] = true;
        }
    }
    return $hidden;
}

/**
 * Vista de conversaciones. $days = null deja el historial completo (tests / dump);
 * con entero aplica ventana acotada al inicio del día local (consultorio).
 *
 * @return array{items:list<array>,answered_count:int,unanswered_count:int,archived_count:int,grouped:array,days:?int,since_utc:?string,events_capped:bool}
 */
function interacciones_load_view(?PDO $pdo = null, ?int $days = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $tz = interacciones_tz();
    $sinceUtc = null;
    $daysOut = null;
    if ($days !== null) {
        $daysOut = max(1, min(INTERACCIONES_MAX_DAYS, $days));
        // Inicio del día local hace (N-1) días → N días calendario completos, sin partir conversaciones.
        $sinceLocal = (new DateTimeImmutable('today', $tz))->modify('-' . ($daysOut - 1) . ' days');
        $sinceUtc = $sinceLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    // Más recientes primero + tope; luego se reordenan ASC para armar el hilo.
    $hasPacienteCol = false;
    try {
        require_once __DIR__ . '/lib_migrations.php';
        $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id');
    } catch (Throwable) {
    }
    $sql = 'SELECT id, event_key, wa_id, direction, body, ts_utc, patient_name, media_id, media_type, media_mime, media_filename'
        . ($hasPacienteCol ? ', paciente_id' : '')
        . ' FROM interaccion_eventos';
    $params = [];
    if ($sinceUtc !== null) {
        $sql .= ' WHERE ts_utc >= :since';
        $params['since'] = $sinceUtc;
    }
    $sql .= ' ORDER BY ts_utc DESC, id DESC LIMIT ' . (int) INTERACCIONES_MAX_EVENTS;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $eventsCapped = count($rows) >= INTERACCIONES_MAX_EVENTS;
    $rows = array_reverse($rows);

    // REL: nombres canónicos por paciente_id si REL_READ_IDS (lib_relational_read.php).
    $pacienteIdsForRead = [];
    $pacientesById = [];
    try {
        require_once __DIR__ . '/lib_relational_read.php';
        if (kinesica_rel_read_ids() && $hasPacienteCol) {
            foreach ($rows as $row) {
                $pid = isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
                if ($pid > 0) {
                    $pacienteIdsForRead[] = $pid;
                }
            }
            $pacientesById = kinesica_rel_fetch_pacientes_map($pdo, $pacienteIdsForRead);
        }
    } catch (Throwable) {
        $pacientesById = [];
    }

    $convs = [];
    foreach ($rows as $row) {
        $ts = (new DateTimeImmutable((string) $row['ts_utc'], new DateTimeZone('UTC')))->getTimestamp();
        $local = (new DateTimeImmutable('@' . $ts))->setTimezone($tz);
        // Canonicaliza 54 11… → 549 11… para no duplicar el mismo contacto el mismo día.
        $wa = interacciones_clean_wa_id((string) $row['wa_id']);
        if ($wa === '') {
            $wa = (string) $row['wa_id'];
        }
        $key = $wa . '_' . $local->format('Y-m-d');
        $convs[$key]['wa_id'] = $wa;
        $convs[$key]['date'] = $local->format('Y-m-d');
        $eventName = (string) $row['patient_name'];
        $pid = $hasPacienteCol && isset($row['paciente_id']) ? (int) $row['paciente_id'] : 0;
        if ($pid > 0 && isset($pacientesById[$pid])) {
            $disp = kinesica_rel_display_from_paciente($pacientesById[$pid]);
            if ($disp['name'] !== '') {
                $eventName = $disp['name'];
            }
            $convs[$key]['paciente_id'] = $pid;
        }
        $convs[$key]['events'][] = [
            'id' => (int) $row['id'], 'event_key' => (string) $row['event_key'], 'direction' => (string) $row['direction'],
            'body' => (string) $row['body'], 'ts' => $ts, 'name' => $eventName,
            'media_id' => isset($row['media_id']) ? (string) $row['media_id'] : '',
            'media_type' => isset($row['media_type']) ? (string) $row['media_type'] : '',
            'media_mime' => isset($row['media_mime']) ? (string) $row['media_mime'] : '',
            'media_filename' => isset($row['media_filename']) ? (string) $row['media_filename'] : '',
        ];
    }

    $estado = [];
    foreach ($pdo->query('SELECT * FROM interaccion_estado') as $st) {
        $estado[(string) $st['conversation_key']] = $st;
    }

    $dirNames = [];
    $reminderNames = [];
    try {
        if (!function_exists('clean_phone_number') || !function_exists('ensure_pacientes_tables')) {
            $helpers = __DIR__ . '/pacientes_helpers.php';
            if (is_file($helpers)) {
                require_once $helpers;
            }
        }
        $waList = array_values(array_unique(array_map(static fn(array $c): string => (string) $c['wa_id'], $convs)));
        $dirNames = interacciones_lookup_directory_names($pdo, $waList);
        $reminderNames = interacciones_lookup_recordatorio_names($pdo, $waList);
    } catch (Throwable $e) {
        $dirNames = [];
        $reminderNames = [];
    }

    $items = [];
    $counts = ['answered' => 0, 'unanswered' => 0, 'archived' => 0];
    foreach ($convs as $key => $c) {
        $hidden = interacciones_hidden_twins($c['events']);
        $messages = [];
        $firstPatient = '';
        $lastName = '';
        $lastTs = 0;
        $hasAttachment = false;
        foreach ($c['events'] as $ev) {
            if (isset($hidden[$ev['id']])) {
                continue;
            }
            $msgItem = [
                'from' => $ev['direction'],
                'time' => (new DateTimeImmutable('@' . $ev['ts']))->setTimezone($tz)->format('H:i'),
                'text' => $ev['body'],
                'ts' => gmdate('Y-m-d\TH:i:s\Z', $ev['ts']),
            ];
            if ($ev['direction'] === 'patient' && !empty($ev['media_id'])) {
                $att = interacciones_build_attachment_view(
                    $ev['media_id'],
                    $ev['media_type'] ?? '',
                    $ev['media_mime'] ?? '',
                    $ev['media_filename'] ?? ''
                );
                if ($att !== null) {
                    $msgItem['attachment'] = $att;
                    $hasAttachment = true;
                }
            }
            $messages[] = $msgItem;
            if ($firstPatient === '' && $ev['direction'] === 'patient') {
                $firstPatient = $ev['body'];
            }
            if ($ev['name'] !== '') {
                $lastName = $ev['name'];
            }
            $lastTs = max($lastTs, $ev['ts']);
        }
        $st = $estado[$key] ?? [];
        $isTurnConfirm = interacciones_thread_is_turn_confirmation($messages);
        $name = '';
        $convPid = isset($c['paciente_id']) ? (int) $c['paciente_id'] : 0;
        if ($convPid > 0 && isset($pacientesById[$convPid])) {
            $name = kinesica_rel_display_from_paciente($pacientesById[$convPid])['name'];
        }
        if ($name === '') {
            if (function_exists('kinesica_rel_read_ids') && kinesica_rel_read_ids()) {
                kinesica_rel_note_read_fallback('interacciones', 'sin_paciente_id');
            }
            $name = interacciones_known_name((string) $c['wa_id']);
        }
        if ($name === '') {
            $name = (string) (($st['patient_name'] ?? '') !== '' ? $st['patient_name'] : $lastName);
        }
        if ($name === '') {
            $matchKey = interacciones_phone_match_key((string) $c['wa_id']);
            $name = (string) ($dirNames[$matchKey] ?? $reminderNames[$matchKey] ?? '');
        }
        $isDiagNoise = interacciones_thread_is_diagnostic_noise($messages, $name);
        [$cat, $catLabel] = interacciones_classify($firstPatient, (string) $c['wa_id']);
        if ($isTurnConfirm) {
            $cat = 'confirmacion_turno';
            $catLabel = '✅ Confirmación de turno';
        } elseif ($isDiagNoise) {
            $cat = 'prueba_admin';
            $catLabel = '🧪 Prueba Técnica';
        }
        $archived = !empty($st['archived']);
        // Confirmación del recordatorio o ruido de prueba: no quedan pendientes.
        $answered = !empty($st['answered']) || $isTurnConfirm || $isDiagNoise;
        $counts[$archived ? 'archived' : ($answered ? 'answered' : 'unanswered')]++;
        $items[] = [
            'id' => $key,
            'wa_id' => $c['wa_id'],
            'phone_formatted' => interacciones_phone_format((string) $c['wa_id']),
            'patient_name' => $name,
            'date' => $c['date'],
            'time' => (new DateTimeImmutable('@' . $lastTs))->setTimezone($tz)->format('H:i'),
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z', $lastTs),
            'answered' => $answered,
            'answered_at' => interacciones_iso($st['answered_at'] ?? null),
            'archived' => $archived,
            'archived_at' => interacciones_iso($st['archived_at'] ?? null),
            'category' => (string) (($st['category'] ?? '') !== '' ? $st['category'] : $cat),
            'category_label' => (string) (($st['category_label'] ?? '') !== '' ? $st['category_label'] : $catLabel),
            'summary' => (string) (($st['summary'] ?? '') !== '' ? $st['summary'] : mb_substr($firstPatient, 0, 120, 'UTF-8')),
            'has_attachment' => $hasAttachment,
            'messages' => $messages,
        ];
    }
    usort($items, static fn(array $a, array $b): int => strcmp($b['timestamp'], $a['timestamp']));
    $grouped = [];
    foreach ($items as $it) {
        $grouped[$it['date']][] = $it;
    }
    return [
        'items' => $items,
        'answered_count' => $counts['answered'],
        'unanswered_count' => $counts['unanswered'],
        'archived_count' => $counts['archived'],
        'grouped' => $grouped,
        'days' => $daysOut,
        'since_utc' => $sinceUtc,
        'events_capped' => $eventsCapped,
    ];
}

/**
 * Cambia el estado de una conversación (archive|unarchive|toggle_answered). Solo toca flags: nunca eventos.
 * Acepta la clave nueva o un id legado (exec_NNN) de una pestaña abierta antes de la migración.
 */
/** Estado de salud para mostrar en la vista (no expone contenido). */
