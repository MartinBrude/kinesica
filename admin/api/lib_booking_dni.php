<?php
declare(strict_types=1);

/**
 * Validación DNI/pasaporte — espejo de booking/dni-rules.js.
 * Mantener RULES alineadas; verificar con scripts/verify-booking-dni-rules.mjs.
 */

const KINESICA_DNI_DIGIT_MIN = 5;
const KINESICA_DNI_DIGIT_MAX = 12;
const KINESICA_DNI_ALNUM_MIN = 5;
const KINESICA_DNI_ALNUM_MAX = 20;

function kinesica_is_valid_booking_dni(?string $raw): bool
{
    $s = trim((string) $raw);
    if ($s === '' || preg_match('/^no\s*provisto$/i', $s)) {
        return false;
    }
    $alnum = preg_replace('/[^0-9A-Za-z]/', '', $s) ?? '';
    if ($alnum === '') {
        return false;
    }
    if (preg_match('/[A-Za-z]/', $alnum)) {
        $aLen = strlen($alnum);
        return $aLen >= KINESICA_DNI_ALNUM_MIN && $aLen <= KINESICA_DNI_ALNUM_MAX;
    }
    $dLen = strlen($alnum);
    return $dLen >= KINESICA_DNI_DIGIT_MIN && $dLen <= KINESICA_DNI_DIGIT_MAX;
}
