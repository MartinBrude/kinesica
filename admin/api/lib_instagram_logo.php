<?php
declare(strict_types=1);

/** Logo + cápsula + borrado de badge AI previo. */

function ig_logo_path(): string
{
    foreach ([
        dirname(__DIR__, 2) . '/marca/KINESICA-logo-color-horizontal.png',
        dirname(__DIR__) . '/logo.png',
    ] as $p) {
        if (is_file($p)) return $p;
    }
    throw new RuntimeException('No se encontró logo Kinésica');
}

function ig_filled_round_rect($im, int $x1, int $y1, int $x2, int $y2, int $r, int $col): void
{
    $r = max(1, min($r, intdiv($x2 - $x1, 2), intdiv($y2 - $y1, 2)));
    imagefilledrectangle($im, $x1 + $r, $y1, $x2 - $r, $y2, $col);
    imagefilledrectangle($im, $x1, $y1 + $r, $x2, $y2 - $r, $col);
    imagefilledellipse($im, $x1 + $r, $y1 + $r, $r * 2, $r * 2, $col);
    imagefilledellipse($im, $x2 - $r, $y1 + $r, $r * 2, $r * 2, $col);
    imagefilledellipse($im, $x1 + $r, $y2 - $r, $r * 2, $r * 2, $col);
    imagefilledellipse($im, $x2 - $r, $y2 - $r, $r * 2, $r * 2, $col);
}

function ig_corner_has_badge($im, int $w, int $h): bool
{
    $n = 0;
    $white = 0;
    $yw = (int) round($h * 0.14);
    $xw = (int) round($w * 0.32);
    for ($y = 0; $y < $yw; $y += 3) {
        for ($x = 0; $x < $xw; $x += 3) {
            $n++;
            $rgb = imagecolorat($im, $x, $y);
            if ((($rgb >> 16) & 255) > 242 && (($rgb >> 8) & 255) > 242 && ($rgb & 255) > 242) $white++;
        }
    }
    return $n > 0 && ($white / $n) > 0.32;
}

function ig_erase_old_logo($im, int $w, int $h): void
{
    if (!ig_corner_has_badge($im, $w, $h)) return;
    $cw = (int) round($w * 0.58);
    $ch = (int) round($h * 0.28);
    $tmp = imagecreatetruecolor($cw, $ch);
    imagecopyresampled($tmp, $im, 0, 0, (int) round($w * 0.70), 0, $cw, $ch, max(8, (int) round($w * 0.22)), $ch);
    imagecopy($im, $tmp, 0, 0, 0, 0, $cw, $ch);
}

function ig_paint_logo($im, int $w): void
{
    ig_erase_old_logo($im, imagesx($im), imagesy($im));
    $s = $w / 1080;
    $pad = (int) round(28 * $s);
    $bw = (int) round(300 * $s);
    $bh = (int) round(92 * $s);
    $radius = (int) round(18 * $s);
    ig_filled_round_rect($im, $pad, $pad, $pad + $bw, $pad + $bh, $radius, imagecolorallocate($im, 255, 255, 255));
    $logo = @imagecreatefrompng(ig_logo_path());
    if ($logo === false) return;
    imagealphablending($logo, true);
    imagesavealpha($logo, true);
    $innerX = (int) round(16 * $s);
    $innerY = (int) round(18 * $s);
    $tw = $bw - $innerX * 2;
    $th = (int) round($tw * imagesy($logo) / max(1, imagesx($logo)));
    if ($th > $bh - $innerY * 2) {
        $th = $bh - $innerY * 2;
        $tw = (int) round($th * imagesx($logo) / max(1, imagesy($logo)));
    }
    $dx = $pad + (int) round(($bw - $tw) / 2);
    $dy = $pad + (int) round(($bh - $th) / 2);
    imagecopyresampled($im, $logo, $dx, $dy, 0, 0, $tw, $th, imagesx($logo), imagesy($logo));
}
