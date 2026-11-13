<?php
declare(strict_types=1);


function canonical_patient_name_key(string $str): string
{
    $s = trim($str);
    if ($s === '') return '';
    $s = preg_replace('/^(?:lic\.|lic|dr\.|dr|dra\.|dra|sr\.|sr|sra\.|sra)\s+/iu', '', $s) ?? $s;
    $s = mb_strtolower($s, 'UTF-8');
    $unaccent = strtr($s, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
        'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u',
        'â' => 'a', 'ê' => 'e', 'î' => 'i', 'ô' => 'o', 'û' => 'u',
        'ä' => 'a', 'ë' => 'e', 'ï' => 'i', 'ö' => 'o',
    ]);
    $cleaned = preg_replace('/[^a-z0-9]+/u', ' ', $unaccent) ?? '';
    $tokens = preg_split('/\s+/u', trim($cleaned), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (empty($tokens)) return '';
    if (count($tokens) >= 2) {
        sort($tokens, SORT_STRING);
    }
    return implode(' ', $tokens);
}


function clean_patient_dni(?string $raw): string
{
    if ($raw === null) return '';
    $t = trim($raw);
    if ($t === '' || strcasecmp($t, 'No provisto') === 0 || strcasecmp($t, 'null') === 0) return '';
    $digits = preg_replace('/[^0-9]/', '', $t) ?? '';
    if (strlen($digits) < 5) return '';
    return $digits;
}

/**
 * True si $phone es el DNI disfrazado (p.ej. 28111222 → 5491128111222 vía clean_phone_number).
 */

/**
 * True si $phone es el DNI disfrazado (p.ej. 28111222 → 5491128111222 vía clean_phone_number).
 */
function kinesica_phone_looks_like_dni(string $phone, string $dni): bool
{
    $phoneDigits = preg_replace('/\D+/', '', $phone) ?? '';
    $dniDigits = preg_replace('/\D+/', '', $dni) ?? '';
    if ($phoneDigits === '' || $dniDigits === '' || strlen($dniDigits) < 5) {
        return false;
    }
    if ($phoneDigits === $dniDigits) {
        return true;
    }
    // 7–8 dígitos → clean_phone_number antepone 11 y luego 549.
    if (strlen($dniDigits) === 7 || strlen($dniDigits) === 8) {
        if ($phoneDigits === '11' . $dniDigits || $phoneDigits === '54911' . $dniDigits) {
            return true;
        }
    }
    return false;
}


function is_placeholder_phone(string $phone): bool
{
    $p = trim($phone);
    if ($p === '') return true;
    return str_starts_with($p, 'sin-tel-') 
        || str_starts_with($p, 'sin-tel') 
        || str_starts_with($p, 'sin-telefono') 
        || str_starts_with($p, 'ficha-');
}


function merge_prof_values(string $p1, string $p2): string
{
    $v1 = in_array($p1, ['norberto', 'maria'], true) ? $p1 : 'indistinto';
    $v2 = in_array($p2, ['norberto', 'maria'], true) ? $p2 : 'indistinto';
    if ($v1 !== 'indistinto' && $v2 === 'indistinto') return $v1;
    if ($v2 !== 'indistinto' && $v1 === 'indistinto') return $v2;
    if ($v1 !== 'indistinto' && $v2 !== 'indistinto') return $v1;
    return 'indistinto';
}

/**
 * Une textos no vacíos sin duplicar (case-insensitive). Conserva la mayor información.
 */

/**
 * Une textos no vacíos sin duplicar (case-insensitive). Conserva la mayor información.
 */
function kinesica_merge_text_keep_max(string $a, string $b, string $sep = "\n"): string
{
    $a = trim($a);
    $b = trim($b);
    if ($a === '') return $b;
    if ($b === '') return $a;
    $aLower = mb_strtolower($a, 'UTF-8');
    $bLower = mb_strtolower($b, 'UTF-8');
    if ($aLower === $bLower) {
        // Misma info: preferir la versión con acentos / más “rica”.
        $aScore = (preg_match('/[áéíóúÁÉÍÓÚñÑüÜ]/u', $a) ? 2 : 0) + mb_strlen($a, 'UTF-8');
        $bScore = (preg_match('/[áéíóúÁÉÍÓÚñÑüÜ]/u', $b) ? 2 : 0) + mb_strlen($b, 'UTF-8');
        return $bScore > $aScore ? $b : $a;
    }
    if (str_contains($aLower, $bLower)) return $a;
    if (str_contains($bLower, $aLower)) return $b;
    return $a . $sep . $b;
}

/**
 * Elige el teléfono más informativo del cluster (real > placeholder con DNI > otro placeholder).
 */

/**
 * Elige el teléfono más informativo del cluster (real > placeholder con DNI > otro placeholder).
 */
function kinesica_pick_best_phone(array $cluster): string
{
    $best = '';
    $bestScore = -1;
    foreach ($cluster as $c) {
        $raw = trim((string) ($c['telefono'] ?? ''));
        if ($raw === '') continue;
        $clean = clean_phone_number($raw);
        $score = 0;
        if ($clean !== '' && !is_placeholder_phone($clean) && !is_placeholder_phone($raw)) {
            $score = 100 + strlen($clean);
        } elseif (str_starts_with($raw, 'sin-tel-dni-')) {
            $score = 50 + strlen($raw);
        } elseif (!is_placeholder_phone($raw)) {
            $score = 80 + strlen($raw);
        } else {
            $score = 10 + strlen($raw);
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = ($clean !== '' && !is_placeholder_phone($clean)) ? $clean : $raw;
        }
    }
    return $best;
}

/**
 * Elige el bloque de nombre más completo (apellido, acentos, más tokens).
 *
 * @return array{nombre:string,apellido:string,nombre_completo:string,nombre_pila:string}
 */

/**
 * Elige el bloque de nombre más completo (apellido, acentos, más tokens).
 *
 * @return array{nombre:string,apellido:string,nombre_completo:string,nombre_pila:string}
 */
function kinesica_pick_richest_name(array $cluster): array
{
    $best = ['nombre' => '', 'apellido' => '', 'nombre_completo' => '', 'nombre_pila' => ''];
    $bestScore = -1;
    foreach ($cluster as $c) {
        $nom = trim((string) ($c['nombre'] ?? ''));
        $ape = trim((string) ($c['apellido'] ?? ''));
        $full = trim((string) (($c['nombre_completo'] ?? '') ?: trim($nom . ' ' . $ape)));
        $pila = trim((string) ($c['nombre_pila'] ?? ''));
        if ($full === '' && $nom === '' && $ape === '') continue;
        $tokens = preg_split('/\s+/u', $full, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $score = count($tokens) * 10
            + ($ape !== '' ? 20 : 0)
            + ($nom !== '' ? 5 : 0)
            + (preg_match('/[áéíóúÁÉÍÓÚñÑüÜ]/u', $full) ? 8 : 0)
            + min(30, mb_strlen($full, 'UTF-8'));
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = [
                'nombre' => $nom,
                'apellido' => $ape,
                'nombre_completo' => $full,
                'nombre_pila' => $pila !== '' ? $pila : extract_first_name($full),
            ];
        }
    }
    return $best;
}

/**
 * Origen más “humano”: admin > web > whatsapp.
 */

/**
 * Origen más “humano”: admin > web > whatsapp.
 */
function kinesica_prefer_origen(string $current, string $candidate): string
{
    $rank = ['admin' => 3, 'web' => 2, 'whatsapp' => 1];
    $c = $rank[$current] ?? 0;
    $n = $rank[$candidate] ?? 0;
    return $n > $c ? $candidate : ($current !== '' ? $current : 'whatsapp');
}

