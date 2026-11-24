<?php
declare(strict_types=1);

/**
 * Markers anti-doble-envío por canal y semana ISO.
 */

function kinesica_digest_marker_file(string $channelId): string
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', $channelId) ?? '';
    if ($id === '') {
        throw new InvalidArgumentException('channelId inválido para marker de digesto.');
    }
    return __DIR__ . '/data/digest_' . $id . '_sent.json';
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
    if ($payload === false || @file_put_contents($file, $payload) === false) {
        throw new RuntimeException('No se pudo guardar el marker del digesto.');
    }
}
