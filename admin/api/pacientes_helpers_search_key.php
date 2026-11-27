<?php
declare(strict_types=1);


function normalize_search_key(string $str): string
{
    $str = mb_strtolower(trim($str), 'UTF-8');
    $unaccent = strtr($str, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    return preg_replace('/[^a-z0-9]/', '', $unaccent) ?? '';
}


function is_tk3_or_blocked_name(string $text): bool
{
    $t = trim($text);
    if ($t === '') {
        return false;
    }
    // Coincide con Tk3, TK 3, tk-3, tk_3, [TK3], etc. pero no con otros apellidos o nombres
    if (preg_match('/(^|[\s\-_\[\(])tk[\s\-_]*3($|[\s\-_\]\)])/iu', $t)) {
        return true;
    }
    // Coincide con No Dar, No dar: <motivo>, no-dar, no_dar
    if (preg_match('/(?:^|[\s\-_:\[\(])no[\s\-_]*dar(?:$|[\s\-_:\]\)])/iu', $t)
        || preg_match('/(?:^|[\s\-_:\[\(])no[\s\-_]*dar\b/iu', $t)
    ) {
        return true;
    }
    $norm = mb_strtolower($t, 'UTF-8');
    $unaccent = strtr($norm, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u',
    ]);
    foreach (['no dar', 'bloqueado', 'bloqueo', 'feriado', 'vacaciones', 'vacacion', 'lista de espera', 'waitlist'] as $kw) {
        if (str_contains($norm, $kw) || str_contains($unaccent, $kw)) {
            return true;
        }
    }
    return false;
}

/**
 * True si $digits ya trae un código de país distinto de AR (+54).
 * Evita “argentinizar” (+34, +1, +598, etc.) anteponiendo 549.
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

    // Si vienen múltiples teléfonos separados por barra, coma o punto y coma, tomar el primero
    $parts = preg_split('/[\/,;]/', $t);
    $first = trim($parts[0] ?? $t);

    // Remover aclaraciones entre paréntesis como (celular), (casa), (hijo), etc.
    $noParens = preg_replace('/\([^)]*\)/', '', $first) ?? $first;
    // Descartar prefijos de texto habituales ("WhatsApp:", "tel:", "teléfono:", etc.)
    $withoutPrefix = preg_replace('/^(?:whatsapp|wa\.me|tel[eé]?fono|tel|cel|movil|celular|phone)[:\s\/]*/iu', '', $noParens) ?? $noParens;
    // Descartar palabras descriptivas comunes ("fijo", "particular", "laboral", etc.)
    $withoutWords = preg_replace('/\b(?:fijo|cel|celular|movil|casa|particular|laboral|trabajo|int\.?\s*\d*)\b/iu', '', $withoutPrefix) ?? $withoutPrefix;

    // Si contiene letras sueltas que no eran prefijos conocidos, no es un teléfono válido
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
    // Nacional AR de 10 dígitos (CABA 11… o interior 2xx/3xx…)
    if (strlen($digits) === 10 && preg_match('/^(?:11|[2-9]\d)\d{8}$/', $digits)) {
        return '549' . $digits;
    }

    // Cualquier otra cosa (p. ej. 11 dígitos extranjeros no listados): devolver tal cual.
    // Nunca anteponer 549 a ciegos.
    return $digits;
}


function is_valid_email_strict(?string $raw): bool
{
    if ($raw === null) return true;
    $email = trim($raw);
    if ($email === '') return true;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    if (strlen($email) > 254) return false;

    $parts = explode('@', $email);
    if (count($parts) !== 2) return false;
    [$local, $domain] = $parts;
    if (strlen($local) > 64) return false;

    $invalidDomains = ['gmail.con', 'gmai.com', 'hotmai.com', 'hotmial.com', 'outlok.com', 'yahoo.con'];
    if (in_array(strtolower($domain), $invalidDomains, true)) return false;
    if (!str_contains($domain, '.')) return false;

    $tld = strtolower(substr(strrchr($domain, '.') ?: '', 1));
    if (strlen($tld) < 2) return false;

    return true;
}


/**
 * Calendar a veces trae "Apellido Nombre". Mapa de correcciones conocidas → "Nombre Apellido".
 *
 * @return array<string,string> clave lower => nombre canónico
 */
function kinesica_known_inverted_patient_names(): array
{
    return [
        'dalamon viviana' => 'Viviana Dalamon',
        'leiro andrea' => 'Andrea Leiro',
        'lipsyc silvana' => 'Silvana Lipsyc',
        'mira walter' => 'Walter Mira',
        'silvestre rodrigo' => 'Rodrigo Silvestre',
    ];
}

/** Corrige "Apellido, Nombre" / entradas del mapa a "Nombre Apellido". */
function kinesica_correct_inverted_patient_name(string $name): string
{
    $trimmed = trim($name);
    if ($trimmed === '') {
        return '';
    }
    if (str_contains($trimmed, ',')) {
        $parts = explode(',', $trimmed, 2);
        if (trim($parts[0]) !== '' && trim($parts[1]) !== '') {
            $trimmed = trim($parts[1]) . ' ' . trim($parts[0]);
        }
    }
    $key = mb_strtolower($trimmed, 'UTF-8');
    $map = kinesica_known_inverted_patient_names();
    return $map[$key] ?? $trimmed;
}

/**
 * Si nombre/apellido/completo matchean el mapa de invertidos, devuelve partes canónicas.
 *
 * @return array{nombre:string,apellido:string,nombre_completo:string}|null
 */
function kinesica_resolve_known_inverted_name_parts(string $nombre, string $apellido, string $full = ''): ?array
{
    $map = kinesica_known_inverted_patient_names();
    // Solo full y "nombre apellido": NO usar "apellido nombre" (en fichas correctas
    // eso reproduce la clave invertida y re-swappearíamos a Walter Mira → Mira Walter).
    $candidates = [
        trim($full),
        trim($nombre . ' ' . $apellido),
    ];
    foreach ($candidates as $candidate) {
        if ($candidate === '') {
            continue;
        }
        $key = mb_strtolower(trim($candidate), 'UTF-8');
        if (!isset($map[$key])) {
            continue;
        }
        $corrected = $map[$key];
        $parts = preg_split('/\s+/u', $corrected, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        return [
            'nombre' => $parts[0] ?? $corrected,
            'apellido' => $parts[1] ?? '',
            'nombre_completo' => $corrected,
        ];
    }
    return null;
}

function extract_first_name(string $fullName): string
{
    $clean = trim($fullName);
    if ($clean === '') return '';

    if (str_contains($clean, ',')) {
        $parts = explode(',', $clean, 2);
        $clean = trim($parts[1] ?? $parts[0]);
    }
    $clean = preg_replace('/^(lic\.|dr\.|dra\.|sr\.|sra\.)\s+/i', '', $clean) ?? $clean;
    $words = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($words) === 0) return '';

    $first = $words[0];
    if (count($words) >= 2) {
        $compound = mb_strtolower($first, 'UTF-8');
        if (in_array($compound, ['maria', 'maría', 'juan', 'ana', 'jose', 'josé'], true)) {
            $comp = $first . ' ' . $words[1];
            return function_exists('capitalize_patient_name') ? capitalize_patient_name($comp) : $comp;
        }
    }
    return function_exists('capitalize_patient_name') ? capitalize_patient_name($first) : $first;
}

