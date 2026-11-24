<?php
declare(strict_types=1);

/**
 * Motor genérico: decide / arma / envía un canal de digesto semanal.
 */

require_once __DIR__ . '/lib_digest_schedule.php';
require_once __DIR__ . '/lib_digest_marker.php';
require_once __DIR__ . '/lib_digest_mail.php';

/**
 * @param list<string> $envKeys
 * @param list<string> $cfgPaths  p.ej. user_emails.martin
 */
function kinesica_digest_resolve_email(array $envKeys, array $cfgPaths, string $fallback): string
{
    foreach ($envKeys as $key) {
        $key = (string) $key;
        if ($key === '') {
            continue;
        }
        $v = (string) (getenv($key) ?: ($_SERVER[$key] ?? $_ENV[$key] ?? ''));
        $v = trim($v);
        if ($v !== '' && filter_var($v, FILTER_VALIDATE_EMAIL)) {
            return $v;
        }
    }
    if (function_exists('cfg')) {
        $cfg = cfg();
        foreach ($cfgPaths as $path) {
            $parts = explode('.', (string) $path);
            $cur = $cfg;
            foreach ($parts as $p) {
                if (!is_array($cur) || !array_key_exists($p, $cur)) {
                    $cur = null;
                    break;
                }
                $cur = $cur[$p];
            }
            $v = is_string($cur) ? trim($cur) : '';
            if ($v !== '' && filter_var($v, FILTER_VALIDATE_EMAIL)) {
                return $v;
            }
        }
    }
    $fallback = trim($fallback);
    if (!filter_var($fallback, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_fallback inválido en canal de digesto.');
    }
    return $fallback;
}

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
        if (!is_array($row)) {
            continue;
        }
        if (trim((string) ($row['title'] ?? '')) === '') {
            continue;
        }
        $items[] = $row;
    }

    $to = kinesica_digest_resolve_email(
        is_array($channel['email_env'] ?? null) ? $channel['email_env'] : [],
        is_array($channel['email_cfg_paths'] ?? null) ? $channel['email_cfg_paths'] : [],
        (string) ($channel['email_fallback'] ?? '')
    );
    $mail = kinesica_digest_build_mail($channel, $items, $now);
    $count = count($items);

    $base = [
        'ok' => true,
        'channel' => $id,
        'week' => $weekKey,
        'first_business_day' => $first->format('Y-m-d'),
        'today' => $today->format('Y-m-d'),
        'count' => $count,
        'to' => $to,
        'subject' => $mail['subject'],
        'html' => $mail['html'],
        'text' => $mail['text'],
    ];

    if ($preview) {
        return $base + ['action' => 'preview', 'message' => "Preview digesto {$id} (sin envío)."];
    }
    if (!$force && $today->format('Y-m-d') !== $first->format('Y-m-d')) {
        return $base + [
            'action' => 'skip_not_first_business_day',
            'html' => null, 'text' => null,
            'message' => 'Hoy no es el primer día hábil; no se envía.',
        ];
    }
    if (!$force && !empty($channel['skip_if_empty']) && $count === 0) {
        return $base + [
            'action' => 'skip_empty',
            'html' => null, 'text' => null,
            'message' => "Sin ítems abiertos en {$id}; no se envía.",
        ];
    }
    if (!$force && kinesica_digest_already_sent($id, $weekKey)) {
        return $base + [
            'action' => 'skip_already_sent',
            'html' => null, 'text' => null,
            'message' => "Digesto {$id} de {$weekKey} ya enviado.",
        ];
    }
    if ($dry) {
        return $base + ['action' => 'dry_run', 'message' => "Dry-run: se habría enviado a {$to}."];
    }

    try {
        if (!function_exists('send_html_mail') || !send_html_mail($to, $mail['subject'], $mail['html'], $mail['text'])) {
            return $base + [
                'ok' => false, 'action' => 'send_failed',
                'message' => "No se pudo enviar digesto {$id}.",
                'error' => 'send_html_mail failed',
            ];
        }
        kinesica_digest_mark_sent($id, $weekKey, $to);
        return $base + [
            'action' => 'sent',
            'message' => "Digesto {$id} enviado a {$to} ({$count} ítems).",
        ];
    } catch (Throwable $e) {
        return $base + [
            'ok' => false, 'action' => 'send_failed',
            'message' => "Error al enviar digesto {$id}.",
            'error' => $e->getMessage(),
        ];
    }
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_digest_run_all(array $opts = []): array
{
    require_once __DIR__ . '/lib_digest_channels.php';
    $out = [];
    foreach (kinesica_digest_channels() as $ch) {
        $out[] = kinesica_digest_run($ch, $opts);
    }
    return $out;
}
