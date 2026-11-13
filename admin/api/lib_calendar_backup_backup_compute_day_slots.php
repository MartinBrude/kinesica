<?php
declare(strict_types=1);


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
