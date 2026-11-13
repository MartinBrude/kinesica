<?php
declare(strict_types=1);

/** Layout feed/story: placa + gradiente + logo + textos (parte de lib_instagram_render). */

/**
 * Layout tipo 122: foto protagonista, copy anclado abajo con aire,
 * banda navy solo del alto necesario (sin hueco vacío bajo el texto).
 * @return array{path:string,warnings:list<string>}
 */
function ig_render_format(string $id, string $kind, string $cat, string $title, string $body): array
{
    $isStory = $kind === 'story';
    $w = $isStory ? IG_STORY_W : IG_FEED_W;
    $h = $isStory ? IG_STORY_H : IG_FEED_H;
    $src = ig_original_path($id, $kind);
    if (!is_file($src)) throw new RuntimeException('Falta original ' . $kind . ' para ' . $id);
    $im = ig_load_scaled($src, $w, $h);
    if (ig_original_looks_finished($im, $w, $h)) {
        throw new RuntimeException(
            "El original {$kind} de {$id} ya parece una pieza terminada (banda/texto). "
            . 'Reemplazá original/ con una foto limpia (sin logo ni copy) y volvé a renderizar.'
        );
    }

    $warn = [];
    $fontR = ig_font_path('regular');
    $fontB = ig_font_path('bold');
    $fontS = ig_font_path('semibold');
    $margin = 56;
    $maxW = $w - $margin * 2;
    $white = imagecolorallocate($im, 255, 255, 255);
    $teal = imagecolorallocate($im, 46, 160, 140);
    $urlC = imagecolorallocate($im, 130, 210, 195);

    $pill = ig_nfc(mb_strtoupper(trim($cat), 'UTF-8'));
    $pillSize = 16.0;
    $ph = 44;
    // Aire vertical (ref. 03/122): gaps + leading amplios, no texto pegado.
    $gapPill = 44;
    $gapTitle = 40;
    $titleLead = 1.78;
    $bodyLead = 1.62;
    $blockH = static function (array $fit, float $lead): int {
        $n = count($fit['lines']);
        if ($n <= 0) return 0;
        $size = (float) $fit['size'];
        return (int) round(($n - 1) * $size * $lead + $size);
    };
    $tFit = ig_fit_text($title, $fontB, $isStory ? 46 : 40, 26, $maxW, $isStory ? 3 : 3);
    $bFit = ig_fit_text($body, $fontR, $isStory ? 24 : 22, 17, $maxW, $isStory ? 4 : 3);
    if ($tFit['truncated']) $warn[] = 'title_truncated';
    if ($bFit['truncated']) $warn[] = 'body_truncated';

    $titleH = $blockH($tFit, $titleLead);
    $bodyH = $blockH($bFit, $bodyLead);
    // Slot cuerpo = aire mínimo ($gapTitle) + body; el cuerpo se centra en ese slot.
    $contentH = $ph + $gapPill + $titleH + $gapTitle + $bodyH;

    $lineY = $h - 78;
    // Slot del cuerpo hasta casi la línea: el body se centra entre título y divisor.
    $contentBottom = $lineY - 8;
    $y0 = $contentBottom - $contentH;
    // Foto ~55%+ (ref. 122); si el copy no entra, subir un poco el techo.
    $minTop = (int) round($h * ($isStory ? 0.58 : 0.54));
    if ($y0 < $minTop) {
        $tFit = ig_fit_text($title, $fontB, $isStory ? 40 : 36, 24, $maxW, 3);
        $bFit = ig_fit_text($body, $fontR, $isStory ? 22 : 20, 16, $maxW, $isStory ? 4 : 3);
        $titleH = $blockH($tFit, $titleLead);
        $bodyH = $blockH($bFit, $bodyLead);
        $contentH = $ph + $gapPill + $titleH + $gapTitle + $bodyH;
        $y0 = max((int) round($h * 0.50), $contentBottom - $contentH);
    }

    $fadeH = (int) round($h * 0.07);
    $solidY = max(0, $y0 - 18);
    $fadeY = max(0, $solidY - $fadeH);
    ig_paint_gradient($im, $w, $h, $fadeY / max(1, $h), $solidY / max(1, $h));
    ig_paint_logo($im, $w);

    $y = $y0;
    $pBox = imagettfbbox($pillSize, 0, $fontS, $pill);
    $pw = abs(($pBox[2] ?? 0) - ($pBox[0] ?? 0)) + 40;
    ig_filled_round_rect($im, $margin, $y, $margin + $pw, $y + $ph, 22, $teal);
    imagettftext($im, $pillSize, 0, $margin + 20, $y + 30, $white, $fontS, $pill);
    $y += $ph + $gapPill;

    $titleLines = $tFit['lines'];
    $titleLast = count($titleLines) - 1;
    foreach ($titleLines as $i => $line) {
        imagettftext($im, $tFit['size'], 0, $margin, $y + (int) $tFit['size'], $white, $fontB, ig_nfc($line));
        // Sin leading colgante tras la última línea: el aire al cuerpo lo define el slot centrado.
        $y += ($i < $titleLast)
            ? (int) round($tFit['size'] * $titleLead)
            : (int) round($tFit['size']);
    }

    $slotTop = $y;
    $slotBottom = $contentBottom;
    $bodyY = (int) round($slotTop + ($slotBottom - $slotTop - $bodyH) / 2);
    $minBodyTop = $slotTop + 16;
    $maxBodyTop = $slotBottom - $bodyH;
    if ($maxBodyTop < $minBodyTop) {
        $y = $minBodyTop;
    } else {
        $y = max($minBodyTop, min($bodyY, $maxBodyTop));
    }

    $bodyLines = $bFit['lines'];
    $bodyLast = count($bodyLines) - 1;
    foreach ($bodyLines as $i => $line) {
        imagettftext($im, $bFit['size'], 0, $margin, $y + (int) $bFit['size'], $white, $fontR, ig_nfc($line));
        $y += ($i < $bodyLast)
            ? (int) round($bFit['size'] * $bodyLead)
            : (int) round($bFit['size']);
    }

    imageline($im, $margin, $lineY, $w - $margin, $lineY, imagecolorallocatealpha($im, 255, 255, 255, 80));
    $uBox = imagettfbbox(20, 0, $fontS, IG_URL_FOOTER);
    $uw = abs(($uBox[2] ?? 0) - ($uBox[0] ?? 0));
    imagettftext($im, 20, 0, (int) (($w - $uw) / 2), $h - 42, $urlC, $fontS, IG_URL_FOOTER);

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
