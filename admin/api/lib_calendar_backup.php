<?php
declare(strict_types=1);

/**
 * Kinésica - Motor de Respaldo de Calendario y Auditoría
 * ======================================================
 * Mantiene un espejo ligero de ocupación (busy_intervals + reservas en tránsito)
 * para responder de forma 100% transparente al paciente si Google Calendar / GAS
 * falla o da timeout, notificando exclusivamente a Norberto para auditoría.
 */

require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

const KINESICA_BACKUP_MAX_AGE_SECONDS = 86400; // 24 horas de vigencia máxima de seguridad
// Las lecturas de horarios caen al respaldo con frecuencia por timeouts/cold-start de GAS.
// No spamear por eso: la alerta externa es solo al AGENDAR en modo respaldo (auditoría).
// Opt-in de diagnóstico: KINESICA_BACKUP_READ_ALERTS=1 (máx. 1 cada 24 h).
const KINESICA_BACKUP_READ_ALERT_COOLDOWN = 86400;
const KINESICA_BACKUP_SESSION_DURATION_MIN = 60;
const KINESICA_BACKUP_SLOT_STEP_MIN = 30;
const KINESICA_BACKUP_BUFFER_HOURS = 2;
const KINESICA_BACKUP_MAX_DAYS = 60;

const KINESICA_BACKUP_DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec';

const KINESICA_BACKUP_HOLIDAYS = [
    '2026-01-01', '2026-02-16', '2026-02-17', '2026-03-24', '2026-04-02',
    '2026-04-03', '2026-05-01', '2026-05-25', '2026-06-15', '2026-06-20',
    '2026-07-09', '2026-08-17', '2026-10-12', '2026-11-23', '2026-12-08',
    '2026-12-25', '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-24',
    '2027-03-26', '2027-04-02', '2027-05-01', '2027-05-25', '2027-06-20',
    '2027-07-09', '2027-08-16', '2027-10-11', '2027-11-20', '2027-12-08',
    '2027-12-25',
];

const KINESICA_BACKUP_DEFAULT_HOURS = [
    'norberto' => [
        '1' => [['start' => '17:30', 'end' => '19:30']],
        '2' => [['start' => '16:30', 'end' => '19:30']],
        '3' => [['start' => '09:00', 'end' => '16:30']],
        '4' => [['start' => '15:00', 'end' => '19:00']],
        '5' => [['start' => '13:30', 'end' => '19:30']],
    ],
    'maria' => [
        '1' => [['start' => '09:00', 'end' => '17:00']],
        '2' => [['start' => '09:00', 'end' => '16:00']],
        '5' => [['start' => '09:00', 'end' => '13:00']],
    ],
];

function kinesica_backup_file(): string
{
    $custom = getenv('KINESICA_CALENDAR_BACKUP_FILE');
    if (is_string($custom) && trim($custom) !== '') {
        return trim($custom);
    }
    return __DIR__ . '/data/calendar_backup.json';
}

function kinesica_backup_default_state(): array
{
    return [
        'version' => 1,
        'updated_at' => null,
        'updated_ts' => 0,
        'source' => 'none',
        'busy_intervals' => [],
        'client_days' => [],
        'pending_bookings' => [],
        'last_read_alert_ts' => 0,
    ];
}

function kinesica_backup_read(): array
{
    $file = kinesica_backup_file();
    if (!is_file($file)) {
        return kinesica_backup_default_state();
    }
    $raw = @file_get_contents($file);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;
    if (!is_array($decoded)) {
        return kinesica_backup_default_state();
    }
    return array_merge(kinesica_backup_default_state(), $decoded);
}

/**
 * Ejecuta una mutación sobre calendar_backup.json con bloqueo exclusivo (flock) y escritura atómica.
 */
function kinesica_backup_mutate(callable $mutator): array
{
    $file = kinesica_backup_file();
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos de respaldo.');
    }
    $lockFile = $dir . '/.calendar_backup.lock';
    $lock = @fopen($lockFile, 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear el archivo de respaldo.');
    }
    try {
        $current = kinesica_backup_read();
        $next = $mutator($current);
        if (!is_array($next)) {
            $next = $current;
        }
        $tmp = $file . '.tmp.' . getmypid() . '.' . mt_rand(1000, 9999);
        $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $file)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo persistir el respaldo de calendario.');
        }
        return $next;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/**
 * Obtiene los horarios vigentes por profesional desde settings.json del admin (o el fallback por defecto).
 */
function kinesica_backup_active_hours(): array
{
    try {
        $settings = kinesica_settings_raw(kinesica_settings_source_file());
        $hours = $settings['practitioner_hours'] ?? null;
        if (is_array($hours) && (!empty($hours['norberto']) || !empty($hours['maria']))) {
            return $hours;
        }
    } catch (Throwable $e) {
    }
    return KINESICA_BACKUP_DEFAULT_HOURS;
}

/**
 * Devuelve las franjas horarias de atención para un día de semana (1..5) y profesional opcional.
 */
function kinesica_backup_working_windows(string $practitionerId, int $dayOfWeek, ?array $hoursOverride = null): array
{
    if ($dayOfWeek <= 0 || $dayOfWeek >= 6) {
        return [];
    }
    $activeHours = $hoursOverride ?? kinesica_backup_active_hours();
    $dayKey = (string) $dayOfWeek;
    $pid = strtolower(trim($practitionerId));
    if ($pid !== '' && isset($activeHours[$pid]) && is_array($activeHours[$pid])) {
        $list = $activeHours[$pid][$dayKey] ?? $activeHours[$pid][$dayOfWeek] ?? [];
        return is_array($list) ? $list : [];
    }
    $combined = [];
    foreach (['maria', 'norberto'] as $p) {
        $pMap = $activeHours[$p] ?? [];
        $list = is_array($pMap) ? ($pMap[$dayKey] ?? $pMap[$dayOfWeek] ?? []) : [];
        if (is_array($list)) {
            foreach ($list as $w) {
                if (is_array($w) && isset($w['start'], $w['end'])) {
                    $combined[] = $w;
                }
            }
        }
    }
    return $combined;
}

/**
 * Convierte YYYY-MM-DD y HH:mm en timestamp en milisegundos en hora de Argentina (-03:00).
 */
function kinesica_backup_parse_arg_ms(string $dateStr, string $timeStr = '00:00'): int
{
    $time = strlen($timeStr) === 5 ? ($timeStr . ':00') : $timeStr;
    $dt = DateTimeImmutable::createFromFormat('Y-m-d H:i:sP', "{$dateStr} {$time}-03:00");
    if ($dt === false) {
        return 0;
    }
    return $dt->getTimestamp() * 1000;
}

/**
 * Verifica si el estado del respaldo es utilizable (no está vacío ni vencido).
 */
function kinesica_backup_is_fresh(array $state, ?int $nowSec = null): bool
{
    $now = $nowSec ?? time();
    $updatedTs = (int) ($state['updated_ts'] ?? 0);
    if ($updatedTs <= 0) {
        return false;
    }
    return ($now - $updatedTs) <= KINESICA_BACKUP_MAX_AGE_SECONDS;
}

/**
 * Reúne todos los intervalos ocupados: los sincronizados desde Google + las reservas pendientes en modo respaldo.
 *
 * @return list<array{start: int, end: int}>
 */
function kinesica_backup_all_busy_intervals(array $state): array
{
    $out = [];
    foreach (($state['busy_intervals'] ?? []) as $b) {
        if (is_array($b) && isset($b['start'], $b['end'])) {
            $s = (int) $b['start'];
            $e = (int) $b['end'];
            if ($e > $s) {
                $out[] = ['start' => $s, 'end' => $e];
            }
        }
    }
    foreach (($state['pending_bookings'] ?? []) as $p) {
        if (!is_array($p)) {
            continue;
        }
        if (!empty($p['canceled'])) {
            continue;
        }
        $s = (int) ($p['start'] ?? 0);
        $e = (int) ($p['end'] ?? 0);
        if ($e > $s) {
            $out[] = ['start' => $s, 'end' => $e];
        }
    }
    return $out;
}

/**
 * Calcula los horarios disponibles para un día YYYY-MM-DD a partir del respaldo local.
 *
 * @return list<array{time: string, startIso: string, endIso: string}>
 */
function kinesica_backup_compute_day_slots(
    string $dateStr,
    array $state,
    string $practitionerId = '',
    ?int $nowMsOverride = null,
    ?array $hoursOverride = null
): array {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
        return [];
    }
    if (in_array($dateStr, KINESICA_BACKUP_HOLIDAYS, true)) {
        return [];
    }

    $middayMs = kinesica_backup_parse_arg_ms($dateStr, '12:00');
    if ($middayMs <= 0) {
        return [];
    }
    $tzArg = new DateTimeZone('America/Argentina/Buenos_Aires');
    $targetDt = (new DateTimeImmutable('@' . (int) floor($middayMs / 1000)))->setTimezone($tzArg);
    $dayOfWeek = (int) $targetDt->format('w'); // 0 dom .. 6 sab
    if ($dayOfWeek === 0 || $dayOfWeek === 6) {
        return [];
    }

    $nowMs = $nowMsOverride ?? (int) round(microtime(true) * 1000);
    $nowDt = (new DateTimeImmutable('@' . (int) floor($nowMs / 1000)))->setTimezone($tzArg);
    $todayInArg = $nowDt->format('Y-m-d');

    $todayStartMs = kinesica_backup_parse_arg_ms($todayInArg, '00:00');
    $targetStartMs = kinesica_backup_parse_arg_ms($dateStr, '00:00');
    $diffDays = (int) round(($targetStartMs - $todayStartMs) / (86400 * 1000));
    if ($diffDays < 0 || $diffDays > KINESICA_BACKUP_MAX_DAYS) {
        return [];
    }

    $windows = kinesica_backup_working_windows($practitionerId, $dayOfWeek, $hoursOverride);
    if ($windows === []) {
        return [];
    }

    $busy = kinesica_backup_all_busy_intervals($state);
    $dayStartMs = kinesica_backup_parse_arg_ms($dateStr, '08:00');
    $isToday = ($todayInArg === $dateStr);
    $minAllowedMs = $isToday
        ? ($nowMs + KINESICA_BACKUP_BUFFER_HOURS * 3600 * 1000)
        : $dayStartMs;

    // Si existe caché de slots provista por un cliente más reciente que busy_intervals y no hay snapshot directo de ese día,
    // también filtramos contra esa lista para no ofrecer un hueco que ya estaba ocupado en Google.
    $clientDay = $state['client_days'][$dateStr] ?? null;
    $allowedTimesFromClient = null;
    if (is_array($clientDay) && isset($clientDay['slots']) && is_array($clientDay['slots'])) {
        $clientAt = (int) ($clientDay['at'] ?? 0);
        $busySource = (string) ($state['source'] ?? '');
        if ($busySource === 'client_slots' || $clientAt >= (int) ($state['updated_ts'] ?? 0)) {
            $allowedTimesFromClient = [];
            foreach ($clientDay['slots'] as $s) {
                $t = is_array($s) ? trim((string) ($s['time'] ?? '')) : '';
                if ($t !== '') {
                    $allowedTimesFromClient[$t] = true;
                }
            }
        }
    }

    $durationMin = KINESICA_BACKUP_SESSION_DURATION_MIN;
    $stepMin = KINESICA_BACKUP_SLOT_STEP_MIN;
    $availableSlots = [];
    $seenTimes = [];

    foreach ($windows as $win) {
        $sParts = array_map('intval', explode(':', (string) ($win['start'] ?? '00:00')));
        $eParts = array_map('intval', explode(':', (string) ($win['end'] ?? '00:00')));
        if (count($sParts) < 2 || count($eParts) < 2) {
            continue;
        }
        $winStartMin = $sParts[0] * 60 + $sParts[1];
        $winEndMin = $eParts[0] * 60 + $eParts[1];

        for ($m = $winStartMin; $m + $durationMin <= $winEndMin; $m += $stepMin) {
            $hh = str_pad((string) floor($m / 60), 2, '0', STR_PAD_LEFT);
            $mm = str_pad((string) ($m % 60), 2, '0', STR_PAD_LEFT);
            $timeSlotStr = "{$hh}:{$mm}";
            if (isset($seenTimes[$timeSlotStr])) {
                continue;
            }

            if ($allowedTimesFromClient !== null && !isset($allowedTimesFromClient[$timeSlotStr])) {
                continue;
            }

            $slotStartMs = kinesica_backup_parse_arg_ms($dateStr, $timeSlotStr);
            $slotEndMs = $slotStartMs + ($durationMin * 60 * 1000);
            if ($slotStartMs < $minAllowedMs) {
                continue;
            }

            $collision = false;
            foreach ($busy as $b) {
                if ($slotStartMs < $b['end'] && $slotEndMs > $b['start']) {
                    $collision = true;
                    break;
                }
            }

            if (!$collision) {
                $seenTimes[$timeSlotStr] = true;
                $startIso = gmdate('Y-m-d\TH:i:s.000\Z', (int) floor($slotStartMs / 1000));
                $endIso = gmdate('Y-m-d\TH:i:s.000\Z', (int) floor($slotEndMs / 1000));
                $availableSlots[] = [
                    'time' => $timeSlotStr,
                    'startIso' => $startIso,
                    'endIso' => $endIso,
                ];
            }
        }
    }

    usort($availableSlots, static fn(array $a, array $b): int => strcmp($a['time'], $b['time']));
    return $availableSlots;
}

/**
 * Formatea una fecha YYYY-MM-DD en español amigable (ej: "Jueves 12/11").
 */
function kinesica_backup_friendly_date(string $dateStr): string
{
    $ms = kinesica_backup_parse_arg_ms($dateStr, '12:00');
    if ($ms <= 0) {
        return $dateStr;
    }
    $tzArg = new DateTimeZone('America/Argentina/Buenos_Aires');
    $dt = (new DateTimeImmutable('@' . (int) floor($ms / 1000)))->setTimezone($tzArg);
    $dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    $dow = (int) $dt->format('w');
    return ($dias[$dow] ?? '') . ' ' . $dt->format('d/m');
}

/**
 * Construye el título canónico del evento de Google Calendar igual que google-apps-script.js.
 */
function kinesica_backup_build_summary(array $payload): string
{
    $practitionerId = strtolower(trim((string) ($payload['practitionerId'] ?? '')));
    $practitionerNames = ['norberto' => 'Norberto', 'maria' => 'María'];
    $whoName = $practitionerNames[$practitionerId] ?? '';
    $whoTag = $whoName !== '' ? ('[' . mb_strtoupper($whoName, 'UTF-8') . '] ') : '';

    $nombre = trim((string) ($payload['nombre'] ?? ''));
    $isMenor = !empty($payload['isMenor']) && $payload['isMenor'] !== 'false';
    $esParaTercero = !empty($payload['esParaTercero']) || !empty($payload['contactoNombre']);
    $familiarTitle = trim((string) ($payload['contactoNombre'] ?? $payload['nombreFamiliar'] ?? ''));

    if ($isMenor && $familiarTitle !== '') {
        return "🩺 {$whoTag}[MENOR] {$nombre} (Familiar: {$familiarTitle})";
    }
    if ($esParaTercero && $familiarTitle !== '') {
        return "🩺 {$whoTag}{$nombre} (Agendó: {$familiarTitle})";
    }
    return "🩺 {$whoTag}{$nombre}";
}

/**
 * Envía alerta de auditoría EXCLUSIVAMENTE a Norberto (WhatsApp + Email de resguardo).
 * Nunca se notifica a María ni al paciente que se usó el modo respaldo.
 */
function kinesica_backup_notify_norberto_audit(array $bookingEntry, array $backupState, array $syncOutcome): array
{
    $norbertoPhone = (string) (
        getenv('NORBERTO_PHONE')
        ?: ($_SERVER['NORBERTO_PHONE'] ?? $_ENV['NORBERTO_PHONE'] ?? cfg()['norberto_phone'] ?? '541161564311')
    );
    $norbertoEmail = (string) (
        getenv('NORBERTO_EMAIL')
        ?: ($_SERVER['NORBERTO_EMAIL'] ?? $_ENV['NORBERTO_EMAIL'] ?? cfg()['norberto_email'] ?? 'norberto1712@gmail.com')
    );

    $payload = is_array($bookingEntry['payload'] ?? null) ? $bookingEntry['payload'] : [];
    $practitionerId = strtolower(trim((string) ($payload['practitionerId'] ?? '')));
    $practitionerLabel = match ($practitionerId) {
        'maria' => 'Lic. María Gulín',
        'norberto' => 'Lic. Norberto Brude',
        default => 'Indistinto (según horario)',
    };

    $nombre = trim((string) ($payload['nombre'] ?? 'Paciente'));
    $telefono = trim((string) ($payload['telefono'] ?? ''));
    $cleanPhone = preg_replace('/\D+/', '', $telefono) ?? '';
    $waLink = $cleanPhone !== '' ? ("wa.me/{$cleanPhone}") : 'No provisto';
    $dni = trim((string) ($payload['dni'] ?? 'No provisto')) ?: 'No provisto';
    $email = trim((string) ($payload['email'] ?? 'No provisto')) ?: 'No provisto';
    $dateStr = (string) ($bookingEntry['date'] ?? '');
    $timeStr = (string) ($bookingEntry['time'] ?? '');
    $fechaAmigable = kinesica_backup_friendly_date($dateStr);
    $especialidad = trim((string) ($payload['especialidad'] ?? $payload['motivo'] ?? $payload['techniqueId'] ?? 'No especifica')) ?: 'No especifica';

    $updatedTs = (int) ($backupState['updated_ts'] ?? 0);
    $ageMin = $updatedTs > 0 ? max(0, (int) round((time() - $updatedTs) / 60)) : null;
    $ageLabel = $ageMin !== null ? "hace {$ageMin} min" : 'sin marca previa';

    $syncedOk = !empty($syncOutcome['synced']);
    $syncStatusLine = $syncedOk
        ? '✅ Se reintentó desde el servidor y ya quedó agendado en Google Calendar (ID: ' . ($syncOutcome['google_event_id'] ?? 'OK') . ').'
        : '⏳ Google Calendar sigue sin responder. Quedó bloqueado en el respaldo y se agendará automáticamente al reconectar (o verificalo manualmente en tu Google Calendar).';

    $message = "⚠️ *[AUDITORÍA · TURNO EN MODO RESPALDO]*\n"
        . "El paciente agendó normalmente sin notar ninguna falla, pero *Google Calendar no respondió* y se utilizó la copia de respaldo.\n\n"
        . "• *Profesional del turno:* {$practitionerLabel}\n"
        . "• *Paciente:* {$nombre}\n"
        . "• *Fecha y Hora:* {$fechaAmigable} ({$dateStr}) a las {$timeStr} hs\n"
        . "• *WhatsApp:* {$waLink}\n"
        . "• *Email:* {$email}\n"
        . "• *DNI:* {$dni}\n"
        . "• *Especialidad:* {$especialidad}\n"
        . "• *Copia de respaldo actualizada:* {$ageLabel}\n"
        . "• *Estado Google Calendar:* {$syncStatusLine}\n\n"
        . "🔍 *Acción sugerida:* Auditar en Google Calendar que el horario del {$fechaAmigable} a las {$timeStr} hs esté correctamente reflejado.";

    $waResult = ['ok' => false];
    $mailSent = false;
    $skipNetwork = getenv('KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS') === '1';

    if (!$skipNetwork) {
        try {
            $waResult = send_whatsapp_alert_payload([
                'to' => $norbertoPhone,
                'body' => $message,
            ]);
        } catch (Throwable $e) {
            $waResult = ['ok' => false, 'error' => $e->getMessage()];
        }

        try {
            $subject = "⚠️ [AUDITORÍA RESPALDO] Turno {$nombre} - {$fechaAmigable} {$timeStr} hs ({$practitionerLabel})";
            $plainBody = str_replace('*', '', $message);
            $htmlBody = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px">'
                . '<h2 style="color:#b45309;margin-top:0">⚠️ Auditoría: Turno agendado en Modo Respaldo</h2>'
                . '<p>El paciente completó su reserva de forma transparente, pero <strong>Google Calendar no respondió a tiempo</strong> y se utilizó la copia de respaldo del servidor.</p>'
                . '<ul style="line-height:1.7">'
                . '<li><strong>Profesional del turno:</strong> ' . htmlspecialchars($practitionerLabel, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Paciente:</strong> ' . htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Fecha y Hora:</strong> ' . htmlspecialchars("{$fechaAmigable} ({$dateStr}) a las {$timeStr} hs", ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>WhatsApp:</strong> ' . htmlspecialchars($waLink, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Email:</strong> ' . htmlspecialchars($email, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>DNI:</strong> ' . htmlspecialchars($dni, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Especialidad:</strong> ' . htmlspecialchars($especialidad, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Antigüedad de la copia:</strong> ' . htmlspecialchars($ageLabel, ENT_QUOTES, 'UTF-8') . '</li>'
                . '<li><strong>Estado en Google Calendar:</strong> ' . htmlspecialchars($syncStatusLine, ENT_QUOTES, 'UTF-8') . '</li>'
                . '</ul>'
                . '<p style="background:#fffbeb;padding:12px;border-left:4px solid #f59e0b;margin-bottom:0">'
                . '<strong>Acción requerida:</strong> Por favor, auditá en Google Calendar que el turno esté libre y correctamente cargado.'
                . '</p></div>';
            $mailSent = send_html_mail($norbertoEmail, $subject, $htmlBody, $plainBody);
        } catch (Throwable $e) {
            $mailSent = false;
        }
    }

    return [
        'notified_to' => 'norberto_only',
        'recipient_phone' => $norbertoPhone,
        'recipient_email' => $norbertoEmail,
        'whatsapp_ok' => (bool) ($waResult['ok'] ?? false),
        'email_ok' => $mailSent,
        'message' => $message,
    ];
}

/**
 * Registra que una lectura de horarios se sirvió desde el respaldo.
 * Por defecto NO avisa por mail/WhatsApp: timeouts intermitentes de GAS (cold start)
 * activan el respaldo sin que el calendario esté caído. La alerta útil es la de
 * auditoría al agendar (`kinesica_backup_notify_norberto_audit`).
 *
 * Diagnóstico opcional: KINESICA_BACKUP_READ_ALERTS=1 (máx. 1 mail/WA cada 24 h).
 */
function kinesica_backup_notify_norberto_read_fallback(string $contextInfo = ''): void
{
    $ageMin = null;
    $updatedTs = 0;
    try {
        $state = kinesica_backup_read();
        $updatedTs = (int) ($state['updated_ts'] ?? 0);
        $ageMin = $updatedTs > 0 ? max(0, (int) round((time() - $updatedTs) / 60)) : null;
    } catch (Throwable $e) {
        // seguir con log
    }

    $ageText = $ageMin !== null ? "actualizada hace {$ageMin} min" : 'activa';
    error_log(
        'kinesica calendar backup read-fallback'
        . ($contextInfo !== '' ? " ({$contextInfo})" : '')
        . "; copia {$ageText}"
    );

    if (getenv('KINESICA_BACKUP_SKIP_EXTERNAL_ALERTS') === '1') {
        return;
    }
    // Opt-in explícito: no molestar en producción salvo diagnóstico.
    $allowExternal = getenv('KINESICA_BACKUP_READ_ALERTS');
    if ($allowExternal !== '1' && $allowExternal !== 'true') {
        return;
    }

    $shouldAlert = false;
    try {
        kinesica_backup_mutate(function (array $state) use (&$shouldAlert, &$ageMin): array {
            $now = time();
            $last = (int) ($state['last_read_alert_ts'] ?? 0);
            if ($now - $last >= KINESICA_BACKUP_READ_ALERT_COOLDOWN) {
                $state['last_read_alert_ts'] = $now;
                $shouldAlert = true;
                $updatedTs = (int) ($state['updated_ts'] ?? 0);
                $ageMin = $updatedTs > 0 ? max(0, (int) round(($now - $updatedTs) / 60)) : null;
            }
            return $state;
        });
    } catch (Throwable $e) {
        return;
    }

    if (!$shouldAlert) {
        return;
    }

    $norbertoPhone = (string) (
        getenv('NORBERTO_PHONE')
        ?: ($_SERVER['NORBERTO_PHONE'] ?? $_ENV['NORBERTO_PHONE'] ?? cfg()['norberto_phone'] ?? '541161564311')
    );
    $norbertoEmail = (string) (
        getenv('NORBERTO_EMAIL')
        ?: ($_SERVER['NORBERTO_EMAIL'] ?? $_ENV['NORBERTO_EMAIL'] ?? cfg()['norberto_email'] ?? 'norberto1712@gmail.com')
    );
    $ageLabel = $ageMin !== null ? "actualizada hace {$ageMin} min" : 'activa';

    $msg = "⚠️ *[AVISO · MODO RESPALDO DE CALENDARIO ACTIVO]*\n"
        . "Una consulta de horarios en la web no obtuvo respuesta de Google Calendar a tiempo y fue respondida automáticamente con la copia de respaldo ({$ageLabel}).\n"
        . ($contextInfo !== '' ? "• *Detalle:* {$contextInfo}\n" : '')
        . "El paciente vio los horarios normalmente. Si concreta la reserva en modo respaldo, recibirás la alerta de auditoría con todos sus datos.";

    try {
        send_whatsapp_alert_payload(['to' => $norbertoPhone, 'body' => $msg]);
    } catch (Throwable $e) {
    }
    try {
        send_mail($norbertoEmail, '⚠️ [KINÉSICA] Lectura de turnos servida desde Modo Respaldo', str_replace('*', '', $msg));
    } catch (Throwable $e) {
    }
}

/**
 * Intenta sincronizar inmediatamente desde el servidor una reserva tomada en modo respaldo hacia Google Apps Script.
 *
 * @return array{synced: bool, google_event_id?: string, error?: string}
 */
function kinesica_backup_try_push_booking_to_gas(array $payload): array
{
    $gasUrl = trim((string) (
        getenv('KINESICA_GAS_BOOKING_URL')
        ?: ($_SERVER['KINESICA_GAS_BOOKING_URL'] ?? $_ENV['KINESICA_GAS_BOOKING_URL'] ?? cfg()['gas_booking_url'] ?? KINESICA_BACKUP_DEFAULT_GAS_URL)
    ));
    if ($gasUrl === '' || $gasUrl === 'none' || !function_exists('curl_init')) {
        return ['synced' => false, 'error' => 'GAS URL no disponible'];
    }

    $forwardPayload = array_merge($payload, [
        'action' => 'book',
        'from_backup_server' => true,
    ]);

    $ch = curl_init($gasUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_HTTPHEADER => ['Content-Type: text/plain;charset=utf-8'],
        CURLOPT_POSTFIELDS => json_encode($forwardPayload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 12,
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);

    if ($err || $httpCode < 200 || $httpCode >= 300 || !is_string($raw)) {
        return ['synced' => false, 'error' => $err ?: ("HTTP {$httpCode}")];
    }
    $decoded = json_decode($raw, true);
    if (is_array($decoded) && ($decoded['status'] ?? '') === 'success') {
        return [
            'synced' => true,
            'google_event_id' => (string) ($decoded['eventId'] ?? 'OK'),
        ];
    }
    return [
        'synced' => false,
        'error' => is_array($decoded) ? (string) ($decoded['message'] ?? 'Error GAS') : 'Respuesta inválida',
    ];
}
