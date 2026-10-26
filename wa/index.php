<?php
declare(strict_types=1);

/**
 * Redirect público para botones URL de plantillas WhatsApp.
 * Meta no permite wa.me directo en botones; usamos https://www.kinesica.com.ar/wa/{phone}
 */
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
$path = parse_url($uri, PHP_URL_PATH) ?: '';
$phone = '';
if (preg_match('#/wa/?([0-9]+)#', $path, $m)) {
    $phone = $m[1];
}
if ($phone === '') {
    $phone = preg_replace('/\D+/', '', (string) ($_GET['p'] ?? '')) ?? '';
}
if ($phone === '' || strlen($phone) < 8 || strlen($phone) > 16) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Numero invalido';
    exit;
}
header('Location: https://wa.me/' . $phone, true, 302);
exit;
