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
