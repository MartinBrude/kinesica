<?php
declare(strict_types=1);

/**
 * Normalización de teléfonos (AR + internacionales) y detección de prefijo 54/549 pegado.
 */

/**
 * True si $digits ya trae un código de país distinto de AR (+54).
 * Evita “argentinizar” (+34, +1, +598, etc.) anteponiendo 549.
 */
function phone_is_non_ar_international(string $digits): bool
{
    if ($digits === '' || str_starts_with($digits, '54')) {
        return false;
    }
    // Prefijos más largos primero. [cc, minLen, maxLen]
    static $rules = [
        ['598', 11, 13], // UY
        ['595', 11, 13], // PY
        ['593', 11, 13], // EC
        ['591', 11, 13], // BO
        ['351', 12, 13], // PT (12: no chocar con área AR 351… de 10 dígitos)
        ['55', 12, 13],  // BR
        ['56', 11, 13],  // CL
        ['57', 12, 13],  // CO
        ['52', 12, 13],  // MX
        ['51', 11, 13],  // PE
        ['58', 11, 13],  // VE
        ['34', 11, 12],  // ES
        ['39', 11, 13],  // IT
        ['33', 11, 13],  // FR
        ['49', 11, 13],  // DE
        ['44', 11, 13],  // UK
        ['61', 11, 13],  // AU
        ['64', 11, 13],  // NZ
        ['81', 11, 13],  // JP
        ['86', 12, 14],  // CN
        ['1', 11, 11],   // US/CA (NANP)
    ];
    $len = strlen($digits);
    foreach ($rules as [$cc, $min, $max]) {
        if (str_starts_with($digits, $cc) && $len >= $min && $len <= $max) {
            return true;
        }
    }
    return false;
}

/**
 * Normaliza teléfono a dígitos E.164-ish.
 * - AR (local o +54): unifica a 549…
 * - Otros países con código conocido: se preservan (nunca se antepone 549).
 */
function clean_phone_number(string $raw): string
{
    $t = trim($raw);
    if ($t === '' || str_starts_with($t, 'sin-tel') || str_starts_with($t, 'sin-telefono') || str_starts_with($t, 'ficha-')) {
        return '';
    }

    $parts = preg_split('/[\/,;]/', $t);
    $first = trim($parts[0] ?? $t);

    $noParens = preg_replace('/\([^)]*\)/', '', $first) ?? $first;
    $withoutPrefix = preg_replace('/^(?:whatsapp|wa\.me|tel[eé]?fono|tel|cel|movil|celular|phone)[:\s\/]*/iu', '', $noParens) ?? $noParens;
    $withoutWords = preg_replace('/\b(?:fijo|cel|celular|movil|casa|particular|laboral|trabajo|int\.?\s*\d*)\b/iu', '', $withoutPrefix) ?? $withoutPrefix;

    if (preg_match('/[a-zA-Z]/', $withoutWords)) {
        return '';
    }

    $digits = preg_replace('/\D+/', '', $withoutWords) ?? '';
    if ($digits === '') {
        return '';
    }

    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
    }

    // Reparar 549/54 pegado por error encima de un CC extranjero (p.ej. 54934… → 34…).
    if (str_starts_with($digits, '549')) {
        $restAfter549 = substr($digits, 3);
        if (phone_is_non_ar_international($restAfter549)) {
            return $restAfter549;
        }
    } elseif (str_starts_with($digits, '54')) {
        $restAfter54 = substr($digits, 2);
        if (phone_is_non_ar_international($restAfter54)) {
            return $restAfter54;
        }
    }

    // AR ya internacional
    if (str_starts_with($digits, '549')) {
        return $digits;
    }
    if (str_starts_with($digits, '54')) {
        $rest = substr($digits, 2);
        if (str_starts_with($rest, '0')) {
            $rest = substr($rest, 1);
        }
        if (str_starts_with($rest, '15')) {
            $rest = '11' . substr($rest, 2);
        }
        if (preg_match('/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/', $rest, $m)) {
            $rest = $m[1] . $m[2];
        }
        return '549' . $rest;
    }

    // Extranjero con código de país: no tocar
    if (phone_is_non_ar_international($digits)) {
        return $digits;
    }

    // España local (9 dígitos móvil/fijo)
    if (strlen($digits) === 9 && preg_match('/^[6789]/', $digits)) {
        return '34' . $digits;
    }

    // Heurísticas locales AR (sin código de país)
    if (str_starts_with($digits, '0')) {
        $digits = substr($digits, 1);
    }
    if (preg_match('/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/', $digits, $m)) {
        $digits = $m[1] . $m[2];
    }
    if (str_starts_with($digits, '15')) {
        $digits = '11' . substr($digits, 2);
    }
    if (strlen($digits) === 8) {
        $digits = '11' . $digits;
    }
    if (strlen($digits) === 10 && preg_match('/^(?:11|[2-9]\d)\d{8}$/', $digits)) {
        return '549' . $digits;
    }

    return $digits;
}

/**
 * Canoniza telefono/contacto_telefono en la respuesta (sin escribir DB).
 *
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */
function kinesica_pacientes_normalize_phone_rows(PDO $pdo, array $rows): array
{
    foreach ($rows as &$row) {
        if (!is_array($row)) {
            continue;
        }
        foreach (['telefono', 'contacto_telefono'] as $field) {
            if (!array_key_exists($field, $row)) {
                continue;
            }
            $raw = trim((string) ($row[$field] ?? ''));
            if ($raw === '' || is_placeholder_phone($raw)) {
                continue;
            }
            $clean = clean_phone_number($raw);
            if ($clean !== '' && $clean !== $raw) {
                $row[$field] = $clean;
            }
        }
    }
    unset($row);
    return $rows;
}

/**
 * ¿Es un “54/549 pegado” sobre CC extranjero? (p.ej. 54934… → 34…).
 */
function kinesica_phone_is_ar_prefix_over_foreign(string $rawDigits): bool
{
    if ($rawDigits === '') {
        return false;
    }
    if (str_starts_with($rawDigits, '549')) {
        return phone_is_non_ar_international(substr($rawDigits, 3));
    }
    if (str_starts_with($rawDigits, '54') && !str_starts_with($rawDigits, '549')) {
        return phone_is_non_ar_international(substr($rawDigits, 2));
    }
    return false;
}
