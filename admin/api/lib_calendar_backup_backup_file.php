<?php
declare(strict_types=1);


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
