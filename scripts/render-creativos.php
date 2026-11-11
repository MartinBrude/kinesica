<?php
declare(strict_types=1);

/**
 * CLI: regenera piezas desde seeds o args.
 * Uso:
 *   php scripts/render-creativos.php --id=01_acostumbraste_dolor --cat=... --title=... --body=...
 *   php scripts/render-creativos.php --id=01_acostumbraste_dolor   # usa textos del seed JS (vía JSON)
 *
 * Sin --id no regenera el catálogo completo (evitar overwrite masivo accidental).
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_instagram_render.php';

function usage(): void
{
    fwrite(STDERR, "Uso: php scripts/render-creativos.php --id=ID [--cat=..] [--title=..] [--body=..]\n");
    exit(1);
}

$opts = getopt('', ['id:', 'cat::', 'title::', 'body::', 'help']);
if (isset($opts['help']) || empty($opts['id'])) usage();

$id = (string) $opts['id'];
$cat = isset($opts['cat']) ? (string) $opts['cat'] : '';
$title = isset($opts['title']) ? (string) $opts['title'] : '';
$body = isset($opts['body']) ? (string) $opts['body'] : '';

if ($cat === '' || $title === '' || $body === '') {
    // Extrae seed del módulo JS (cat/title/body del bloque id).
    $js = file_get_contents($root . '/admin/modules/admin-creativos.js');
    if ($js === false) {
        fwrite(STDERR, "No se pudo leer admin-creativos.js\n");
        exit(1);
    }
    $re = '/id:\s*"' . preg_quote($id, '/') . '"\s*,\s*title:\s*"((?:\\\\.|[^"\\\\])*)"\s*,\s*cat:\s*"((?:\\\\.|[^"\\\\])*)"[\s\S]*?body:\s*"((?:\\\\.|[^"\\\\])*)"/u';
    if (!preg_match($re, $js, $m)) {
        fwrite(STDERR, "No encontré seed para {$id}; pasá --cat --title --body\n");
        exit(1);
    }
    $un = static fn(string $s): string => stripcslashes($s);
    $title = $title !== '' ? $title : $un($m[1]);
    $cat = $cat !== '' ? $cat : $un($m[2]);
    $body = $body !== '' ? $body : $un($m[3]);
}

try {
    $res = ig_render_piece($id, $cat, $title, $body);
    echo json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
