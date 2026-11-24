<?php
declare(strict_types=1);

/**
 * Canales del digesto semanal: pendientes → Norberto, errores → Martín.
 */

if (is_file(__DIR__ . '/pendientes_io.php')) {
    require_once __DIR__ . '/pendientes_io.php';
}
if (is_file(__DIR__ . '/errores_io.php')) {
    require_once __DIR__ . '/errores_io.php';
}

/**
 * @param list<string> $envKeys
 * @param list<string> $cfgPaths  p.ej. user_emails.martin
 */
function kinesica_digest_resolve_email(array $envKeys, array $cfgPaths, string $fallback = ''): string
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
    if ($fallback === '') {
        throw new InvalidArgumentException('email de digesto no configurado (env/cfg).');
    }
    if (!filter_var($fallback, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('email_fallback inválido en canal de digesto.');
    }
    return $fallback;
}

/** Base del admin (sin slash final), desde cfg o fallback del sitio. */
function kinesica_digest_admin_base(): string
{
    $base = '';
    if (function_exists('cfg')) {
        $base = rtrim((string) (cfg()['admin_url'] ?? ''), '/');
    }
    if ($base === '' || !preg_match('#^https://#i', $base)) {
        $base = 'https://www.kinesica.com.ar/admin';
    }
    return $base;
}

/**
 * @param array{
 *   id:string,greeting:string,cta:string,panel:string,
 *   noun_one:string,noun_many:string,
 *   email_env:list<string>,email_cfg_paths:list<string>,
 *   load_items:callable|string,path?:string
 * } $spec
 * @return array{
 *   id:string,greeting:string,url:string,cta:string,panel:string,
 *   noun_one:string,noun_many:string,skip_if_empty:bool,
 *   email_env:list<string>,email_cfg_paths:list<string>,email_fallback:string,
 *   load_items:callable|string
 * }
 */
function kinesica_digest_channel(array $spec): array
{
    $id = (string) ($spec['id'] ?? '');
    $path = (string) ($spec['path'] ?? $id);
    return [
        'id' => $id,
        'greeting' => (string) ($spec['greeting'] ?? ''),
        'url' => kinesica_digest_admin_base() . '/' . ltrim($path, '/'),
        'cta' => (string) ($spec['cta'] ?? 'Abrir'),
        'panel' => (string) ($spec['panel'] ?? $id),
        'noun_one' => (string) ($spec['noun_one'] ?? 'ítem'),
        'noun_many' => (string) ($spec['noun_many'] ?? 'ítems'),
        'skip_if_empty' => true,
        'email_env' => is_array($spec['email_env'] ?? null) ? $spec['email_env'] : [],
        'email_cfg_paths' => is_array($spec['email_cfg_paths'] ?? null) ? $spec['email_cfg_paths'] : [],
        // Sin fallback hardcodeado: requiere env o config.php (fail-closed).
        'email_fallback' => '',
        'load_items' => $spec['load_items'] ?? static fn(): array => [],
    ];
}

function kinesica_digest_channel_pendientes(): array
{
    return kinesica_digest_channel([
        'id' => 'pendientes',
        'greeting' => 'Norberto',
        'cta' => 'Abrir Pendientes',
        'panel' => 'Pendientes',
        'noun_one' => 'pendiente',
        'noun_many' => 'pendientes',
        'email_env' => ['NORBERTO_EMAIL'],
        'email_cfg_paths' => ['norberto_email', 'user_emails.norberto'],
        'load_items' => 'kinesica_digest_items_pendientes',
    ]);
}

function kinesica_digest_channel_errores(): array
{
    return kinesica_digest_channel([
        'id' => 'errores',
        'greeting' => 'Martín',
        'cta' => 'Abrir Reporte de Errores',
        'panel' => 'Reporte de Errores',
        'noun_one' => 'bug',
        'noun_many' => 'bugs',
        'email_env' => ['MARTIN_EMAIL'],
        'email_cfg_paths' => ['martin_email', 'user_emails.martin'],
        'load_items' => 'kinesica_digest_items_errores',
    ]);
}

/** @return list<array{id:string,...}> */
function kinesica_digest_channels(): array
{
    $out = [];
    if (function_exists('kinesica_pendientes_load')) {
        $out[] = kinesica_digest_channel_pendientes();
    }
    if (function_exists('kinesica_errores_load')) {
        $out[] = kinesica_digest_channel_errores();
    }
    return $out;
}

function kinesica_digest_channel_by_id(string $id): ?array
{
    $id = strtolower(trim($id));
    foreach (kinesica_digest_channels() as $ch) {
        if (($ch['id'] ?? '') === $id) {
            return $ch;
        }
    }
    return null;
}

/**
 * @return list<array{title:string,badge?:string,subtitle?:string}>
 */
function kinesica_digest_items_pendientes(): array
{
    if (!function_exists('kinesica_pendientes_load')) {
        return [];
    }
    $open = [];
    foreach (kinesica_pendientes_load() as $item) {
        if (!is_array($item) || ($item['estado'] ?? '') === 'resuelto') {
            continue;
        }
        $titulo = trim((string) ($item['titulo'] ?? ''));
        if ($titulo === '') {
            continue;
        }
        $prio = max(1, (int) ($item['prioridad'] ?? 1));
        $open[] = ['title' => $titulo, 'badge' => (string) $prio, '_prio' => $prio];
    }
    usort($open, static fn(array $a, array $b): int => $a['_prio'] <=> $b['_prio']);
    return array_map(static function (array $row): array {
        return ['title' => $row['title'], 'badge' => $row['badge']];
    }, $open);
}

/**
 * @return list<array{title:string,badge?:string,subtitle?:string}>
 */
function kinesica_digest_items_errores(): array
{
    if (!function_exists('kinesica_errores_load')) {
        return [];
    }
    $open = [];
    foreach (kinesica_errores_load() as $item) {
        if (!is_array($item) || ($item['estado'] ?? 'pendiente') === 'resuelto') {
            continue;
        }
        $info = trim((string) ($item['info'] ?? ''));
        $seccion = trim((string) ($item['seccion'] ?? ''));
        if ($info === '' && $seccion === '') {
            continue;
        }
        $open[] = [
            'title' => $info !== '' ? $info : $seccion,
            'subtitle' => $seccion !== '' && $info !== '' ? $seccion : '',
            'created_at' => (string) ($item['created_at'] ?? ''),
        ];
    }
    usort($open, static fn(array $a, array $b): int => strcmp($b['created_at'], $a['created_at']));
    $out = [];
    $n = 1;
    foreach ($open as $row) {
        $item = ['title' => $row['title'], 'badge' => (string) $n++];
        if ($row['subtitle'] !== '') {
            $item['subtitle'] = $row['subtitle'];
        }
        $out[] = $item;
    }
    return $out;
}
