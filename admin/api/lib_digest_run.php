<?php
declare(strict_types=1);

/**
 * Motor genérico: decide / arma / envía un canal de digesto semanal.
 */

require_once __DIR__ . '/lib_digest_schedule.php';
require_once __DIR__ . '/lib_digest_marker.php';
require_once __DIR__ . '/lib_digest_mail.php';
require_once __DIR__ . '/lib_digest_channels.php';

/**
 * @param array<string,mixed> $channel
 * @param array{now?:DateTimeImmutable,dry_run?:bool,force?:bool,preview?:bool,items?:list<array>} $opts
 * @return array{ok:bool,action:string,channel:string,week:?string,first_business_day:?string,today:?string,count:int,to:?string,subject:?string,html:?string,text:?string,message:string,error?:string}
 */
function kinesica_digest_run(array $channel, array $opts = []): array
{
    $id = preg_replace('/[^a-z0-9_\\-]/i', '', (string) ($channel['id'] ?? '')) ?? '';
    if ($id === '') {
        return [
            'ok' => false, 'action' => 'invalid_channel', 'channel' => '',
            'week' => null, 'first_business_day' => null, 'today' => null,
            'count' => 0, 'to' => null, 'subject' => null, 'html' => null, 'text' => null,
            'message' => 'Canal de digesto inválido.', 'error' => 'missing id',
        ];
    }

    $now = kinesica_digest_ar_now($opts['now'] ?? null);
    $dry = !empty($opts['dry_run']);
    $force = !empty($opts['force']);
    $preview = !empty($opts['preview']);
    $today = $now->setTime(0, 0, 0);
    $first = kinesica_digest_first_business_day($now);
    $weekKey = kinesica_digest_week_key($now);

    if (isset($opts['items']) && is_array($opts['items'])) {
        $rawItems = $opts['items'];
    } else {
        $loader = $channel['load_items'] ?? null;
        $rawItems = is_callable($loader)
            ? $loader()
            : (is_string($loader) && function_exists($loader) ? $loader() : []);
        if (!is_array($rawItems)) {
            $rawItems = [];
        }
    }
    $items = [];
    foreach ($rawItems as $row) {
        if (!is_array($row) || trim((string) ($row['title'] ?? '')) === '') {
            continue;
        }
        $items[] = $row;
    }
    $count = count($items);

    $base = [
        'ok' => true,
        'channel' => $id,
        'week' => $weekKey,
        'first_business_day' => $first->format('Y-m-d'),
        'today' => $today->format('Y-m-d'),
        'count' => $count,
        'to' => null,
        'subject' => null,
        'html' => null,
        'text' => null,
    ];

    $resolveAndBuild = static function () use ($channel, $items, $now): array {
        $to = kinesica_digest_resolve_email(
            is_array($channel['email_env'] ?? null) ? $channel['email_env'] : [],
            is_array($channel['email_cfg_paths'] ?? null) ? $channel['email_cfg_paths'] : [],
            (string) ($channel['email_fallback'] ?? '')
        );
        return [$to, kinesica_digest_build_mail($channel, $items, $now)];
    };

    if ($preview) {
        try {
            [$to, $mail] = $resolveAndBuild();
        } catch (Throwable $e) {
            return array_merge($base, [
                'ok' => false, 'action' => 'config_error',
                'message' => "Config digesto {$id}: " . $e->getMessage(),
                'error' => $e->getMessage(),
            ]);
        }
        return array_merge($base, [
            'to' => $to, 'subject' => $mail['subject'],
            'html' => $mail['html'], 'text' => $mail['text'],
            'action' => 'preview', 'message' => "Preview digesto {$id} (sin envío).",
        ]);
    }

    $notBefore = kinesica_digest_not_before();
    $todayIso = $today->format('Y-m-d');
    if (!$force && $notBefore !== null && $todayIso < $notBefore) {
        return array_merge($base, [
            'action' => 'skip_too_early',
            'message' => "Digesto aún no inicia (desde {$notBefore}).",
        ]);
    }
    if (!$force && !kinesica_digest_may_send_today($today, $first, $notBefore)) {
        return array_merge($base, [
            'action' => 'skip_not_first_business_day',
            'message' => 'Hoy no es día de envío del digesto; no se envía.',
        ]);
    }
    if (!$force && !empty($channel['skip_if_empty']) && $count === 0) {
        return array_merge($base, [
            'action' => 'skip_empty',
            'message' => "Sin ítems abiertos en {$id}; no se envía.",
        ]);
    }
    if (!$force && kinesica_digest_already_sent($id, $weekKey)) {
        return array_merge($base, [
            'action' => 'skip_already_sent',
            'message' => "Digesto {$id} de {$weekKey} ya enviado.",
        ]);
    }
    if (!$force && kinesica_digest_is_paused($id)) {
        return array_merge($base, [
            'action' => 'skip_paused',
            'message' => "Digesto {$id} pausado por configuración.",
        ]);
    }

    try {
        [$to, $mail] = $resolveAndBuild();
    } catch (Throwable $e) {
        return array_merge($base, [
            'ok' => false, 'action' => 'config_error',
            'message' => "Config digesto {$id}: " . $e->getMessage(),
            'error' => $e->getMessage(),
        ]);
    }
    $base['to'] = $to;
    $base['subject'] = $mail['subject'];
    $base['html'] = $mail['html'];
    $base['text'] = $mail['text'];

    if ($dry) {
        return array_merge($base, ['action' => 'dry_run', 'message' => "Dry-run: se habría enviado a {$to}."]);
    }

    $lock = kinesica_digest_acquire_send_lock($id);
    if ($lock === false) {
        return array_merge($base, [
            'ok' => false, 'action' => 'lock_busy',
            'html' => null, 'text' => null,
            'message' => "Otro proceso está enviando digesto {$id}.",
            'error' => 'lock_busy',
        ]);
    }

    try {
        if (!$force && kinesica_digest_already_sent($id, $weekKey)) {
            return array_merge($base, [
                'action' => 'skip_already_sent',
                'html' => null, 'text' => null,
                'message' => "Digesto {$id} de {$weekKey} ya enviado.",
            ]);
        }
        if (!function_exists('send_html_mail') || !send_html_mail($to, $mail['subject'], $mail['html'], $mail['text'])) {
            return array_merge($base, [
                'ok' => false, 'action' => 'send_failed',
                'message' => "No se pudo enviar digesto {$id}.",
                'error' => 'send_html_mail failed',
            ]);
        }
        try {
            kinesica_digest_mark_sent($id, $weekKey, $to);
        } catch (Throwable $markErr) {
            $marked = kinesica_digest_mark_sent_best_effort($id, $weekKey, $to);
            error_log('[digest] sent_unmarked channel=' . $id . ' week=' . $weekKey
                . ' best_effort=' . ($marked ? '1' : '0') . ' err=' . $markErr->getMessage());
            return array_merge($base, [
                'ok' => false, 'action' => 'sent_unmarked',
                'message' => "Digesto {$id} enviado a {$to} pero el marker falló"
                    . ($marked ? ' (best-effort OK; no reintentar).' : ' (sin marker; revisar a mano).'),
                'error' => $markErr->getMessage(),
            ]);
        }
        return array_merge($base, [
            'action' => 'sent',
            'message' => "Digesto {$id} enviado a {$to} ({$count} ítems).",
        ]);
    } catch (Throwable $e) {
        return array_merge($base, [
            'ok' => false, 'action' => 'send_failed',
            'message' => "Error al enviar digesto {$id}.",
            'error' => $e->getMessage(),
        ]);
    } finally {
        kinesica_digest_release_send_lock($lock);
    }
}

/** @return list<array<string,mixed>> */
function kinesica_digest_run_all(array $opts = []): array
{
    $out = [];
    foreach (kinesica_digest_channels() as $ch) {
        $out[] = kinesica_digest_run($ch, $opts);
    }
    return $out;
}
