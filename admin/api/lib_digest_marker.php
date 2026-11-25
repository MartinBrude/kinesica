<?php
declare(strict_types=1);

/**
 * Markers anti-doble-envío por canal y semana ISO (lock + escritura atómica).
 */

function kinesica_digest_marker_file(string $channelId): string
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        throw new InvalidArgumentException('channelId inválido para marker de digesto.');
    }
    return __DIR__ . '/data/digest_' . $id . '_sent.json';
}

function kinesica_digest_lock_file(string $channelId): string
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        throw new InvalidArgumentException('channelId inválido para lock de digesto.');
    }
    return __DIR__ . '/data/digest_' . $id . '_send.lock';
}

function kinesica_digest_already_sent(string $channelId, string $weekKey): bool
{
    if (!preg_match('/^\d{4}-W\d{2}$/', $weekKey)) {
        return false;
    }
    $file = kinesica_digest_marker_file($channelId);
    if (!is_file($file)) {
        return false;
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    if (!is_array($data)) {
        return false;
    }
    return ($data['week'] ?? '') === $weekKey && is_string($data['sent_at'] ?? null) && $data['sent_at'] !== '';
}

/**
 * @return resource|false
 */
function kinesica_digest_acquire_send_lock(string $channelId)
{
    $file = kinesica_digest_lock_file($channelId);
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        return false;
    }
    if (!flock($fh, LOCK_EX | LOCK_NB)) {
        fclose($fh);
        return false;
    }
    return $fh;
}

/** @param resource $fh */
function kinesica_digest_release_send_lock($fh): void
{
    if (is_resource($fh)) {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

function kinesica_digest_mark_sent(string $channelId, string $weekKey, string $to): void
{
    if (!preg_match('/^\d{4}-W\d{2}$/', $weekKey)) {
        throw new InvalidArgumentException('weekKey inválida.');
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('destinatario inválido al marcar digesto.');
    }
    $file = kinesica_digest_marker_file($channelId);
    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de markers de digesto.');
    }
    $payload = json_encode([
        'week' => $weekKey,
        'sent_at' => gmdate('c'),
        'to' => $to,
        'channel' => $channelId,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('No se pudo serializar el marker del digesto.');
    }
    $tmp = $file . '.tmp-' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, $payload, LOCK_EX) !== strlen($payload)) {
        @unlink($tmp);
        throw new RuntimeException('No se pudo guardar el marker del digesto.');
    }
    if (!@rename($tmp, $file)) {
        @unlink($tmp);
        throw new RuntimeException('No se pudo publicar el marker del digesto.');
    }
}

/** Último recurso tras un envío OK: evita reintento aunque falle la escritura atómica. */
function kinesica_digest_mark_sent_best_effort(string $channelId, string $weekKey, string $to): bool
{
    try {
        kinesica_digest_mark_sent($channelId, $weekKey, $to);
        return true;
    } catch (Throwable $e) {
        $file = kinesica_digest_marker_file($channelId);
        $payload = json_encode([
            'week' => $weekKey,
            'sent_at' => gmdate('c'),
            'to' => $to,
            'channel' => $channelId,
            'best_effort' => true,
        ]);
        return is_string($payload) && @file_put_contents($file, $payload) !== false;
    }
}

/** Ruta del archivo marker de pausa voluntaria por canal. */
function kinesica_digest_pause_file(string $channelId): string
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        throw new InvalidArgumentException('channelId inválido para pause de digesto.');
    }
    return __DIR__ . '/data/digest_' . $id . '_paused';
}

/**
 * Determina si un canal de digesto está pausado.
 * Prioridades:
 * 1. Runtime override explícito en data/: digest_{id}_active (fuerza activo) o digest_{id}_paused (fuerza pausa)
 * 2. Variable de entorno: DIGEST_{ID}_PAUSED=1 o DIGEST_PAUSED=1
 * 3. Configuración cfg(): digest_{id}_paused = true o digest_paused = true o digest_channels_paused list
 */
function kinesica_digest_is_paused(string $channelId): bool
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        return false;
    }

    // 1. Runtime overrides explícitos desde UI / data
    $activeFile = __DIR__ . '/data/digest_' . $id . '_active';
    if (is_file($activeFile)) {
        return false;
    }
    $pauseFile = kinesica_digest_pause_file($id);
    if (is_file($pauseFile)) {
        return true;
    }

    // 2. Variables de entorno
    $envVar = getenv('DIGEST_' . strtoupper($id) . '_PAUSED');
    if ($envVar !== false && $envVar !== '') {
        $v = strtolower(trim((string) $envVar));
        if ($v === '1' || $v === 'true' || $v === 'yes') {
            return true;
        }
    }
    $envAll = getenv('DIGEST_PAUSED');
    if ($envAll !== false && $envAll !== '') {
        $v = strtolower(trim((string) $envAll));
        if ($v === '1' || $v === 'true' || $v === 'yes') {
            return true;
        }
    }

    // 3. Configuración php
    if (function_exists('cfg')) {
        $cfg = cfg();
        if (isset($cfg['digest_' . $id . '_paused'])) {
            return (bool) $cfg['digest_' . $id . '_paused'];
        }
        if (!empty($cfg['digest_paused'])) {
            return true;
        }
        $pausedList = $cfg['digest_channels_paused'] ?? null;
        if (is_array($pausedList)) {
            return in_array($id, $pausedList, true);
        }
    }

    // 4. Default seguro por canal: 'pendientes' inicia pausado hasta activación explícita
    if ($id === 'pendientes') {
        return true;
    }

    return false;
}

/**
 * Establece el estado de pausa voluntaria para un canal desde la UI o API.
 */
function kinesica_digest_set_paused(string $channelId, bool $paused): void
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        throw new InvalidArgumentException('channelId inválido.');
    }
    $pauseFile = kinesica_digest_pause_file($id);
    $activeFile = __DIR__ . '/data/digest_' . $id . '_active';
    $dir = dirname($pauseFile);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear data dir de digestos.');
    }
    if ($paused) {
        @unlink($activeFile);
        @touch($pauseFile);
    } else {
        @unlink($pauseFile);
        @touch($activeFile);
    }
}
