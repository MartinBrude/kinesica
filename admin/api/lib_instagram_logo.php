<?php
declare(strict_types=1);

/**
 * Logo Kinésica: detecta badge AI (flood desde esquina), lo reemplaza con foto
 * y pinta UNA cápsula blanca + un solo logo (tamaño fijo de marca).
 */

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

/** @return array{0:int,1:int}|null [maxX,maxY] del badge blanco conectado a (0,0) */
function ig_detect_corner_badge($im, int $w, int $h): ?array
{
    $c0 = imagecolorat($im, 0, 0);
    if ((($c0 >> 16) & 255) < 230 || (($c0 >> 8) & 255) < 230 || ($c0 & 255) < 230) {
        return null;
    }
    $limitY = min($h, (int) round($h * 0.28));
    $limitX = min($w, (int) round($w * 0.62));
    $seen = [];
    $qx = [0];
    $qy = [0];
    $seen[0] = true;
    $maxX = 0;
    $maxY = 0;
    $n = 0;
    for ($qi = 0; $qi < count($qx); $qi++) {
        $x = $qx[$qi];
        $y = $qy[$qi];
        $rgb = imagecolorat($im, $x, $y);
        if ((($rgb >> 16) & 255) < 233 || (($rgb >> 8) & 255) < 233 || ($rgb & 255) < 233) {
            continue;
        }
        $n++;
        if ($x > $maxX) $maxX = $x;
        if ($y > $maxY) $maxY = $y;
        foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
            $nx = $x + $dx;
            $ny = $y + $dy;
            if ($nx < 0 || $ny < 0 || $nx >= $limitX || $ny >= $limitY) continue;
            $k = $ny * $w + $nx;
            if (isset($seen[$k])) continue;
            $seen[$k] = true;
            $qx[] = $nx;
            $qy[] = $ny;
        }
    }
    // Badge real = placa ancha y baja. Paredes claras dan flood alto y angosto → ignorar.
    if ($n < 2000 || $maxX < 160 || $maxY < 50) return null;
    if ($maxY > (int) round($h * 0.20)) return null;
    if ($maxX / max(1, $maxY) < 1.35) return null;
    return [$maxX, $maxY];
}

/** Sustituye el badge por muestreo de la columna de foto a su derecha. */
function ig_cover_old_badge($im, int $w, int $h): void
{
    $bbox = ig_detect_corner_badge($im, $w, $h);
    if ($bbox === null) return;
    [$bx, $by] = $bbox;
    $s = $w / 1080;
    $bw = min($w - 2, $bx + (int) round(16 * $s));
    $bh = min($h - 2, $by + (int) round(16 * $s));
    $srcX = min($w - 1, $bw + (int) round(10 * $s));
    $feather = max(6, (int) round(12 * $s));

    // Cache de color por fila (columna fuente).
    for ($y = 0; $y <= $bh; $y++) {
        $src = imagecolorat($im, $srcX, min($h - 1, $y));
        $sr = ($src >> 16) & 255;
        $sg = ($src >> 8) & 255;
        $sb = $src & 255;
        $fill = imagecolorallocate($im, $sr, $sg, $sb);
        for ($x = 0; $x <= $bw; $x++) {
            $dist = min($bw - $x, $bh - $y);
            if ($dist >= $feather) {
                imagesetpixel($im, $x, $y, $fill);
                continue;
            }
            // Borde: mezcla con foto real fuera del badge (derecha / abajo).
            $ox = min($w - 1, $bw + 1 + ($feather - $dist));
            $oy = min($h - 1, $y);
            if ($bh - $y < $bw - $x) {
                $ox = min($w - 1, $x);
                $oy = min($h - 1, $bh + 1 + ($feather - $dist));
            }
            $out = imagecolorat($im, $ox, $oy);
            $t = $dist / $feather;
            $r = (int) round($sr * $t + (($out >> 16) & 255) * (1 - $t));
            $g = (int) round($sg * $t + (($out >> 8) & 255) * (1 - $t));
            $b = (int) round($sb * $t + ($out & 255) * (1 - $t));
            imagesetpixel($im, $x, $y, imagecolorallocate($im, $r, $g, $b));
        }
    }
}

function ig_paint_logo($im, int $w): void
{
    ig_cover_old_badge($im, $w, imagesy($im));

    $s = $w / 1080;
    $pw = (int) round(340 * $s);
    $ph = (int) round(108 * $s);
    $radius = (int) round(26 * $s);
    $bg = imagecolorallocate($im, 255, 255, 255);
    imagefilledrectangle($im, 0, 0, $pw - $radius, $ph, $bg);
    imagefilledrectangle($im, 0, 0, $pw, $ph - $radius, $bg);
    imagefilledellipse($im, $pw - $radius, $ph - $radius, $radius * 2, $radius * 2, $bg);

    $logo = @imagecreatefrompng(ig_logo_path());
    if ($logo === false) return;
    imagesavealpha($logo, true);
    $tw = (int) round(280 * $s);
    $th = (int) round($tw * imagesy($logo) / max(1, imagesx($logo)));
    $maxH = $ph - (int) round(32 * $s);
    if ($th > $maxH) {
        $th = $maxH;
        $tw = (int) round($th * imagesx($logo) / max(1, imagesy($logo)));
    }
    imagealphablending($im, true);
    imagecopyresampled(
        $im,
        $logo,
        (int) round(22 * $s),
        (int) round(($ph - $th) / 2),
        0,
        0,
        $tw,
        $th,
        imagesx($logo),
        imagesy($logo)
    );
}
