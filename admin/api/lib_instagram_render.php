<?php
declare(strict_types=1);

/** Compositor feed/story: placa + gradiente + logo + textos. */
require_once __DIR__ . '/lib_instagram_store.php';
require_once __DIR__ . '/lib_instagram_logo.php';

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
    $map = ['regular' => 'Inter-Regular.ttf', 'bold' => 'Inter-Bold.ttf', 'semibold' => 'Inter-SemiBold.ttf'];
    $path = dirname(__DIR__) . '/fonts/' . ($map[$weight] ?? $map['regular']);
    if (!is_file($path)) throw new RuntimeException('Falta fuente');
    return $path;
}

function ig_nfc(string $text): string
{
    if (class_exists('Normalizer')) {
        $n = Normalizer::normalize($text, Normalizer::FORM_C);
        if (is_string($n) && $n !== '') return $n;
    }
    return $text;
}

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
        if ($cur !== '' && abs(($box[2] ?? 0) - ($box[0] ?? 0)) > $maxW) {
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
    $text = ig_nfc($text);
    for ($size = $maxSize; $size >= $minSize; $size -= 1.5) {
        $lines = ig_wrap_text($text, $font, $size, $maxW);
        if (count($lines) <= $maxLines) return ['lines' => $lines, 'size' => $size, 'truncated' => false];
    }
    $lines = ig_wrap_text($text, $font, $minSize, $maxW);
    $truncated = false;
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

/** Gradiente navy desde $fadeY (transparente) hasta $solidY (opaco) + sólido al pie. */
function ig_paint_gradient($im, int $w, int $h, int $fadeY, int $solidY): void
{
    $fadeY = max(0, min($h - 1, $fadeY));
    $solidY = max($fadeY + 1, min($h, $solidY));
    for ($y = $fadeY; $y < $solidY; $y++) {
        $t = ($y - $fadeY) / max(1, $solidY - $fadeY - 1);
        $alpha = (int) max(0, min(127, round(127 * (1 - $t))));
        imageline($im, 0, $y, $w - 1, $y, imagecolorallocatealpha($im, 6, 32, 52, $alpha));
    }
    imagefilledrectangle($im, 0, $solidY, $w - 1, $h - 1, imagecolorallocate($im, 6, 32, 52));
}

/** @return array{path:string,warnings:list<string>} */
function ig_render_format(string $id, string $kind, string $cat, string $title, string $body): array
{
    $isStory = $kind === 'story';
    $w = $isStory ? IG_STORY_W : IG_FEED_W;
    $h = $isStory ? IG_STORY_H : IG_FEED_H;
    $src = ig_original_path($id, $kind);
    if (!is_file($src)) throw new RuntimeException('Falta original ' . $kind . ' para ' . $id);
    $im = ig_load_scaled($src, $w, $h);

    $warn = [];
    $fontR = ig_font_path('regular');
    $fontB = ig_font_path('bold');
    $fontS = ig_font_path('semibold');
    $margin = 56;
    $maxW = $w - $margin * 2;
    $white = imagecolorallocate($im, 255, 255, 255);
    $teal = imagecolorallocate($im, 46, 160, 140);
    $urlC = imagecolorallocate($im, 130, 210, 195);

    // Textos medidos primero → banda azul solo del alto necesario (anclada al pie).
    $pill = ig_nfc(mb_strtoupper(trim($cat), 'UTF-8'));
    $pillSize = 16.0;
    $ph = 40;
    $tFit = ig_fit_text($title, $fontB, $isStory ? 48 : 42, 26, $maxW, $isStory ? 4 : 3);
    $bFit = ig_fit_text($body, $fontR, $isStory ? 26 : 24, 17, $maxW, $isStory ? 5 : 4);
    if ($tFit['truncated']) $warn[] = 'title_truncated';
    if ($bFit['truncated']) $warn[] = 'body_truncated';

    $titleH = (int) round(count($tFit['lines']) * $tFit['size'] * 1.22);
    $bodyH = (int) round(count($bFit['lines']) * $bFit['size'] * 1.28);
    $gapPill = 12;
    $gapTitle = 10;
    $contentH = $ph + $gapPill + $titleH + $gapTitle + $bodyH;

    $lineY = $h - 70;
    $contentBottom = $lineY - 22;
    $y0 = $contentBottom - $contentH;
    $minTop = (int) round($h * ($isStory ? 0.55 : 0.58)); // foto protagonista; azul compacto
    if ($y0 < $minTop) {
        // Texto largo: subir un poco el techo y achicar tipografía otra vez.
        $tFit = ig_fit_text($title, $fontB, $isStory ? 40 : 36, 24, $maxW, $isStory ? 3 : 3);
        $bFit = ig_fit_text($body, $fontR, $isStory ? 22 : 20, 16, $maxW, $isStory ? 4 : 3);
        $titleH = (int) round(count($tFit['lines']) * $tFit['size'] * 1.18);
        $bodyH = (int) round(count($bFit['lines']) * $bFit['size'] * 1.24);
        $contentH = $ph + $gapPill + $titleH + $gapTitle + $bodyH;
        $y0 = max((int) round($h * 0.48), $contentBottom - $contentH);
    }

    $fadeH = (int) round($h * 0.055);
    $solidY = max(0, $y0 - 10);
    $fadeY = max(0, $solidY - $fadeH);
    ig_paint_gradient($im, $w, $h, $fadeY, $solidY);
    ig_paint_logo($im, $w);

    $y = $y0;
    $pBox = imagettfbbox($pillSize, 0, $fontS, $pill);
    $pw = abs(($pBox[2] ?? 0) - ($pBox[0] ?? 0)) + 36;
    ig_filled_round_rect($im, $margin, $y, $margin + $pw, $y + $ph, 20, $teal);
    imagettftext($im, $pillSize, 0, $margin + 18, $y + 27, $white, $fontS, $pill);
    $y += $ph + $gapPill;

    foreach ($tFit['lines'] as $line) {
        imagettftext($im, $tFit['size'], 0, $margin, $y + (int) $tFit['size'], $white, $fontB, ig_nfc($line));
        $y += (int) round($tFit['size'] * 1.22);
    }
    $y += $gapTitle;

    foreach ($bFit['lines'] as $line) {
        imagettftext($im, $bFit['size'], 0, $margin, $y + (int) $bFit['size'], $white, $fontR, ig_nfc($line));
        $y += (int) round($bFit['size'] * 1.28);
    }

    imageline($im, $margin, $lineY, $w - $margin, $lineY, imagecolorallocatealpha($im, 255, 255, 255, 80));
    $uBox = imagettfbbox(18, 0, $fontS, IG_URL_FOOTER);
    $uw = abs(($uBox[2] ?? 0) - ($uBox[0] ?? 0));
    imagettftext($im, 18, 0, (int) (($w - $uw) / 2), $h - 38, $urlC, $fontS, IG_URL_FOOTER);

    [$feedRel, $storyRel] = ig_live_paths($id);
    $rel = $isStory ? $storyRel : $feedRel;
    $dst = dirname(__DIR__) . '/' . $rel;
    if (!is_dir(dirname($dst)) && !mkdir(dirname($dst), 0755, true)) {
        throw new RuntimeException('No se pudo crear ' . dirname($rel));
    }
    if (!imagepng($im, $dst, 6)) throw new RuntimeException('No se pudo escribir ' . $rel);
    ig_bust_asset_cache($rel);
    return ['path' => $rel, 'warnings' => $warn];
}

/** @return array{feed:string,story:string,warnings:list<string>} */
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
