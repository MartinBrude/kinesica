<?php
declare(strict_types=1);

/**
 * Helpers de claves de búsqueda, validación de email y normalización de nombres de pacientes.
 * Teléfonos: pacientes_helpers_phone.php · Heal DB: pacientes_helpers_phone_heal.php.
 */

require_once __DIR__ . '/pacientes_helpers_phone.php';
require_once __DIR__ . '/pacientes_helpers_phone_heal.php';

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
    if (preg_match('/(^|[\s\-_\[\(])tk[\s\-_]*3($|[\s\-_\]\)])/iu', $t)) {
        return true;
    }
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
