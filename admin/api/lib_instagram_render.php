<?php
declare(strict_types=1);

/**
 * Compositor único feed/story: placa original + gradiente + logo + textos.
 * Límites de chars: lib_instagram_image_text.php.
 */

require_once __DIR__ . '/lib_instagram_store.php';

function ig_bust_asset_cache(string $path): bool
{
    $rel = 'campanas/ig/' . preg_replace('#^campanas/#', '', preg_replace('#\.\w+$#', '.jpg', $path));
    $dst = dirname(__DIR__) . '/' . $rel;
    return is_file($dst) ? @unlink($dst) : false;
}

const IG_FEED_W = 1080;
const IG_FEED_H = 1350;
const IG_STORY_W = 1080;
const IG_STORY_H = 1920;
const IG_URL_FOOTER = 'kinesica.com.ar';

function ig_font_path(string $weight = 'regular'): string
{
    $map = [
        'regular' => 'Inter-Regular.ttf',
        'bold' => 'Inter-Bold.ttf',
        'semibold' => 'Inter-SemiBold.ttf',
    ];
    $file = $map[$weight] ?? $map['regular'];
    $path = dirname(__DIR__) . '/fonts/' . $file;
    if (!is_file($path)) {
        throw new RuntimeException('Falta fuente ' . $file);
    }
    return $path;
}

function ig_logo_path(): string
{
    $candidates = [
        dirname(__DIR__, 2) . '/marca/KINESICA-logo-color-horizontal-fondo-blanco.png',
        dirname(__DIR__) . '/logo.png',
    ];
    foreach ($candidates as $p) {
        if (is_file($p)) return $p;
    }
    throw new RuntimeException('No se encontró logo Kinésica');
}

/** @return array{0:string,1:string} feedPath, storyPath relative to admin/ */
function ig_live_paths(string $id): array
{
    return [
        'campanas/feed/catalogo_feed_' . $id . '.png',
        'campanas/story/catalogo_story_' . $id . '.png',
    ];
}

function ig_original_path(string $id, string $kind): string
{
    $name = ($kind === 'story' ? 'catalogo_story_' : 'catalogo_feed_') . $id . '.png';
    return dirname(__DIR__) . '/campanas/original/' . $kind . '/' . $name;
}

/** @return list<string> */
function ig_wrap_text(string $text, string $font, float $size, int $maxW): array
{
    $words = preg_split('/\s+/u', trim($text)) ?: [];
    $lines = [];
    $cur = '';
    foreach ($words as $w) {
        if ($w === '') continue;
        $try = $cur === '' ? $w : $cur . ' ' . $w;
        $box = imagettfbbox($size, 0, $font, $try);
        $tw = abs(($box[2] ?? 0) - ($box[0] ?? 0));
        if ($cur !== '' && $tw > $maxW) {
            $lines[] = $cur;
            $cur = $w;
        } else {
            $cur = $try;
        }
    }
    if ($cur !== '') $lines[] = $cur;
    return $lines ?: [''];
}

/** @return array{lines:list<string>,size:float,truncated:bool} */
function ig_fit_text(string $text, string $font, float $maxSize, float $minSize, int $maxW, int $maxLines): array
{
    $size = $maxSize;
    $truncated = false;
    while ($size >= $minSize) {
        $lines = ig_wrap_text($text, $font, $size, $maxW);
        if (count($lines) <= $maxLines) {
            return ['lines' => $lines, 'size' => $size, 'truncated' => $truncated];
        }
        $size -= 1.5;
    }
    $lines = ig_wrap_text($text, $font, $minSize, $maxW);
    if (count($lines) > $maxLines) {
        $lines = array_slice($lines, 0, $maxLines);
        $last = $lines[$maxLines - 1];
        $lines[$maxLines - 1] = rtrim(mb_substr($last, 0, max(1, mb_strlen($last) - 1))) . '…';
        $truncated = true;
    }
    return ['lines' => $lines, 'size' => $minSize, 'truncated' => $truncated];
}

function ig_load_scaled(string $path, int $w, int $h)
{
    $raw = @imagecreatefromstring((string) file_get_contents($path));
    if ($raw === false) throw new RuntimeException('Placa ilegible: ' . basename($path));
    $dst = imagecreatetruecolor($w, $h);
    imagealphablending($dst, true);
    imagesavealpha($dst, true);
    imagecopyresampled($dst, $raw, 0, 0, 0, 0, $w, $h, imagesx($raw), imagesy($raw));
    return $dst;
}

/** Fade suave + bloque opaco inferior (cubre textos horneados de la placa). */
function ig_paint_gradient($im, int $w, int $h, float $fadeStart, float $solidStart): void
{
    $fadeY = (int) round($h * $fadeStart);
    $solidY = (int) round($h * $solidStart);
    imagealphablending($im, true);
    for ($y = $fadeY; $y < $solidY; $y++) {
        $t = ($y - $fadeY) / max(1, $solidY - $fadeY - 1);
        $alpha = (int) max(0, min(127, round(127 * (1 - $t))));
        $col = imagecolorallocatealpha($im, 6, 32, 52, $alpha);
        imageline($im, 0, $y, $w - 1, $y, $col);
    }
    $solid = imagecolorallocate($im, 6, 32, 52);
    imagefilledrectangle($im, 0, $solidY, $w - 1, $h - 1, $solid);
}

function ig_paint_logo($im): void
{
    $logo = @imagecreatefrompng(ig_logo_path());
    if ($logo === false) return;
    $tw = 210;
    $th = (int) round($tw * imagesy($logo) / max(1, imagesx($logo)));
    $pad = 24;
    $bw = $tw + 36;
    $bh = $th + 24;
    // Parche blanco opaco más grande que el badge viejo de la placa.
    $bg = imagecolorallocate($im, 255, 255, 255);
    imagefilledrectangle($im, $pad - 4, $pad - 4, $pad + $bw + 8, $pad + $bh + 8, $bg);
    imagefilledrectangle($im, $pad, $pad, $pad + $bw, $pad + $bh, $bg);
    imagecopyresampled($im, $logo, $pad + 18, $pad + 12, 0, 0, $tw, $th, imagesx($logo), imagesy($logo));
}

/**
 * @return array{path:string,warnings:list<string>}
 */
function ig_render_format(string $id, string $kind, string $cat, string $title, string $body): array
{
    $isStory = $kind === 'story';
    $w = $isStory ? IG_STORY_W : IG_FEED_W;
    $h = $isStory ? IG_STORY_H : IG_FEED_H;
    $src = ig_original_path($id, $kind);
    if (!is_file($src)) {
        throw new RuntimeException('Falta original ' . $kind . ' para ' . $id);
    }
    $im = ig_load_scaled($src, $w, $h);
    // Fade + sólido: tapa headline/body/URL viejos de la placa AI.
    ig_paint_gradient($im, $w, $h, $isStory ? 0.48 : 0.44, $isStory ? 0.58 : 0.54);
    ig_paint_logo($im);

    $warn = [];
    $fontR = ig_font_path('regular');
    $fontB = ig_font_path('bold');
    $fontS = ig_font_path('semibold');
    $margin = 56;
    $maxW = $w - $margin * 2;
    $white = imagecolorallocate($im, 255, 255, 255);
    $teal = imagecolorallocate($im, 46, 160, 140);
    $urlC = imagecolorallocate($im, 130, 210, 195);

    $y = (int) round($h * ($isStory ? 0.60 : 0.56));
    $pill = mb_strtoupper(trim($cat), 'UTF-8');
    $pillSize = 18.0;
    $pBox = imagettfbbox($pillSize, 0, $fontS, $pill);
    $pw = abs(($pBox[2] ?? 0) - ($pBox[0] ?? 0)) + 28;
    $ph = 34;
    imagefilledrectangle($im, $margin, $y, $margin + $pw, $y + $ph, $teal);
    imagettftext($im, $pillSize, 0, $margin + 14, $y + 24, $white, $fontS, $pill);
    $y += $ph + 22;

    $tFit = ig_fit_text($title, $fontB, $isStory ? 54 : 48, 28, $maxW, $isStory ? 4 : 3);
    if ($tFit['truncated']) $warn[] = 'title_truncated';
    foreach ($tFit['lines'] as $line) {
        imagettftext($im, $tFit['size'], 0, $margin, $y + (int) $tFit['size'], $white, $fontB, $line);
        $y += (int) round($tFit['size'] * 1.22);
    }
    $y += 14;

    $bFit = ig_fit_text($body, $fontR, $isStory ? 28 : 26, 18, $maxW, $isStory ? 5 : 4);
    if ($bFit['truncated']) $warn[] = 'body_truncated';
    foreach ($bFit['lines'] as $line) {
        imagettftext($im, $bFit['size'], 0, $margin, $y + (int) $bFit['size'], $white, $fontR, $line);
        $y += (int) round($bFit['size'] * 1.28);
    }

    $lineY = $h - 78;
    $lc = imagecolorallocatealpha($im, 255, 255, 255, 80);
    imageline($im, $margin, $lineY, $w - $margin, $lineY, $lc);
    $uBox = imagettfbbox(20, 0, $fontS, IG_URL_FOOTER);
    $uw = abs(($uBox[2] ?? 0) - ($uBox[0] ?? 0));
    imagettftext($im, 20, 0, (int) (($w - $uw) / 2), $h - 42, $urlC, $fontS, IG_URL_FOOTER);

    [$feedRel, $storyRel] = ig_live_paths($id);
    $rel = $isStory ? $storyRel : $feedRel;
    $dst = dirname(__DIR__) . '/' . $rel;
    if (!is_dir(dirname($dst)) && !mkdir(dirname($dst), 0755, true)) {
        throw new RuntimeException('No se pudo crear ' . dirname($rel));
    }
    if (!imagepng($im, $dst, 6)) {
        throw new RuntimeException('No se pudo escribir ' . $rel);
    }
    ig_bust_asset_cache($rel);
    return ['path' => $rel, 'warnings' => $warn];
}

/**
 * Regenera feed + story. @return array{feed:string,story:string,warnings:list<string>}
 */
function ig_render_piece(string $id, string $cat, string $title, string $body): array
{
    if (!ig_valid_id($id)) throw new InvalidArgumentException('id inválido');
    $feed = ig_render_format($id, 'feed', $cat, $title, $body);
    $story = ig_render_format($id, 'story', $cat, $title, $body);
    return [
        'feed' => $feed['path'],
        'story' => $story['path'],
        'warnings' => array_values(array_unique(array_merge($feed['warnings'], $story['warnings']))),
    ];
}
