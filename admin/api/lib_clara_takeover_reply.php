<?php
declare(strict_types=1);

/**
 * Reply como Clara + helpers de índice para la bandeja.
 * Depende de lib_clara_takeover.php (CRUD / schema).
 */

/**
 * Indexa takeovers activos por wa_id completo y last-8.
 *
 * @return array<string, array{wa_id:string,paused_at:string,paused_until:string,paused_by:string,updated_at?:string}>
 */
function clara_takeover_index_active(?PDO $pdo = null): array
{
    $map = [];
    foreach (clara_takeover_list_active($pdo) as $row) {
        if (!is_array($row)) {
            continue;
        }
        $wa = (string) ($row['wa_id'] ?? '');
        if ($wa === '') {
            continue;
        }
        $map[$wa] = $row;
        $k8 = clara_takeover_match_key($wa);
        if ($k8 !== '') {
            $map[$k8] = $row;
        }
    }
    return $map;
}

function clara_takeover_lookup_in_index(string $waId, array $index): ?array
{
    $wa = clara_takeover_normalize_wa_id($waId);
    if ($wa === '') {
        return null;
    }
    if (isset($index[$wa]) && is_array($index[$wa])) {
        return $index[$wa];
    }
    $k8 = clara_takeover_match_key($wa);
    if ($k8 !== '' && isset($index[$k8]) && is_array($index[$k8])) {
        return $index[$k8];
    }
    return null;
}

function clara_takeover_format_send_error(array $send): string
{
    $raw = (string) ($send['error'] ?? 'No se pudo enviar por WhatsApp');
    $code = (int) ($send['response']['error']['code'] ?? 0);
    $lower = strtolower($raw);
    if (
        $code === 131047
        || str_contains($lower, '24 hour')
        || str_contains($lower, 'outside the allowed window')
        || str_contains($lower, 're-engagement')
    ) {
        return 'Fuera de la ventana de 24 h de Meta: el paciente debe escribir primero, o usá una plantilla aprobada.';
    }
    return $raw !== '' ? $raw : 'No se pudo enviar por WhatsApp';
}

/**
 * Envía texto como Clara y lo registra en interaccion_eventos.
 * Renueva (o inicia) el takeover 30 min para que Clara siga en silencio.
 *
 * @return array{ok:bool,wa_id:string,http_code?:int,error?:string,event_key?:string,takeover?:array}
 */
function clara_takeover_reply(string $waId, string $body, string $by = '', ?PDO $pdo = null): array
{
    $wa = clara_takeover_normalize_wa_id($waId);
    $text = trim($body);
    if (strlen($wa) < 6 || $text === '') {
        return ['ok' => false, 'wa_id' => $wa, 'error' => 'wa_id o body inválido'];
    }
    $pdo = $pdo ?? db();
    $actor = trim($by) !== '' ? trim($by) : 'admin-reply';

    require_once __DIR__ . '/lib_whatsapp.php';
    require_once __DIR__ . '/lib_interacciones_store.php';

    // Primero Meta; solo si llega renovamos/iniciamos el silencio (evita pausar si el envío falla).
    $send = function_exists('clara_takeover_test_send')
        ? clara_takeover_test_send($wa, $text, false)
        : send_whatsapp_text($wa, $text, false);
    if (empty($send['ok'])) {
        return [
            'ok' => false,
            'wa_id' => $wa,
            'http_code' => (int) ($send['http_code'] ?? 0),
            'error' => clara_takeover_format_send_error($send),
        ];
    }

    $takeover = null;
    try {
        $takeover = clara_takeover_start($wa, $actor, null, $pdo);
    } catch (InvalidArgumentException $e) {
        // Mensaje ya salió; el takeover puede faltar si wa_id quedó inválido (no debería).
        $takeover = null;
    }

    $metaId = '';
    if (is_array($send['response'] ?? null)) {
        $metaId = (string) ($send['response']['messages'][0]['id'] ?? '');
    }
    $ev = interacciones_normalize_event([
        'wa_id' => $wa,
        'direction' => 'clara',
        'body' => $text,
        'message_id' => $metaId !== '' ? $metaId : ('admin-reply-' . bin2hex(random_bytes(8))),
        'patient_name' => '',
        'source' => 'admin-reply',
        'ts' => time(),
    ], 'admin-reply');
    if ($ev === null) {
        return [
            'ok' => true,
            'wa_id' => $wa,
            'http_code' => (int) ($send['http_code'] ?? 200),
            'error' => 'Enviado pero no se pudo normalizar el evento de auditoría',
            'takeover' => $takeover,
        ];
    }
    $stored = interacciones_store_events([$ev], $pdo);
    return [
        'ok' => true,
        'wa_id' => $wa,
        'http_code' => (int) ($send['http_code'] ?? 200),
        'event_key' => $ev['event_key'],
        'stored' => $stored,
        'takeover' => $takeover,
        'body' => $text,
        'ts' => time(),
    ];
}
