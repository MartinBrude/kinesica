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
    $norm = mb_strtolower($t, 'UTF-8');
    foreach (['no dar', 'bloqueado', 'bloqueo', 'feriado', 'vacaciones'] as $kw) {
        if (str_contains($norm, $kw)) {
            return true;
        }
    }
    return false;
}

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

    // Descartar prefijos de texto habituales ("WhatsApp:", "tel:", "teléfono:", etc.)
    $withoutPrefix = preg_replace('/^(?:whatsapp|wa\.me|tel[eé]?fono|tel|cel|movil|celular|phone)[:\s\/]*/iu', '', $t) ?? $t;
    // Si contiene letras sueltas que no eran prefijos conocidos, no es un teléfono válido
    if (preg_match('/[a-zA-Z]/', $withoutPrefix)) {
        return '';
    }

    $digits = preg_replace('/\D+/', '', $withoutPrefix) ?? '';
    if ($digits === '') {
        return '';
    }

    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
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
function kinesica_prefer_origen(string $current, string $candidate): string
{
    $rank = ['admin' => 3, 'web' => 2, 'whatsapp' => 1];
    $c = $rank[$current] ?? 0;
    $n = $rank[$candidate] ?? 0;
    return $n > $c ? $candidate : ($current !== '' ? $current : 'whatsapp');
}

function find_existing_patient_match(PDO $pdo, ?string $phone, ?string $name = null, ?string $dni = null): ?array
{
    // 1. Teléfono real
    $cleanPhone = clean_phone_number((string) ($phone ?? ''));
    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)) {
        $stmt = $pdo->prepare('SELECT * FROM pacientes WHERE telefono = :tel LIMIT 1');
        $stmt->execute(['tel' => $cleanPhone]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 2. DNI limpio o placeholder de DNI
    $cleanDni = clean_patient_dni($dni);
    if ($cleanDni !== '') {
        $stmt = $pdo->prepare('
            SELECT * FROM pacientes 
            WHERE dni = :dni 
               OR REPLACE(REPLACE(COALESCE(dni, ""), ".", ""), " ", "") = :clean
               OR telefono = :telDni
            LIMIT 1
        ');
        $stmt->execute(['dni' => $cleanDni, 'clean' => $cleanDni, 'telDni' => 'sin-tel-dni-' . $cleanDni]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 3. Clave canónica de nombre (si tiene al menos 2 tokens)
    if ($name !== null && trim($name) !== '') {
        $nameKey = canonical_patient_name_key($name);
        if ($nameKey !== '' && str_contains($nameKey, ' ')) {
            // PDO nativo (ATTR_EMULATE_PREPARES=false) no permite reutilizar el mismo :nombre.
            $fullLower = mb_strtolower(trim($name), 'UTF-8');
            $stmt = $pdo->prepare('
                SELECT * FROM pacientes 
                WHERE LOWER(nombre_completo) = :full1
                   OR LOWER(TRIM(CONCAT(nombre, " ", apellido))) = :full2
                   OR LOWER(TRIM(CONCAT(apellido, " ", nombre))) = :full3
                LIMIT 1
            ');
            $stmt->execute(['full1' => $fullLower, 'full2' => $fullLower, 'full3' => $fullLower]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) return $row;

            $stmtAll = $pdo->query('SELECT id, nombre, apellido, nombre_completo FROM pacientes');
            if ($stmtAll) {
                while ($cand = $stmtAll->fetch(PDO::FETCH_ASSOC)) {
                    $candFull = trim(($cand['nombre_completo'] ?? '') ?: (($cand['nombre'] ?? '') . ' ' . ($cand['apellido'] ?? '')));
                    if (canonical_patient_name_key($candFull) === $nameKey) {
                        // Traer la fila completa: el scan liviano omite email/notas/contacto
                        // y un UPDATE posterior los pisaba con null.
                        $fullStmt = $pdo->prepare('SELECT * FROM pacientes WHERE id = :id LIMIT 1');
                        $fullStmt->execute(['id' => (int) $cand['id']]);
                        $full = $fullStmt->fetch(PDO::FETCH_ASSOC);
                        return is_array($full) ? $full : $cand;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Resuelve qué teléfono conservar al unificar/actualizar.
 * Si el admin acaba de cargar un WhatsApp nuevo y el match fue por nombre/DNI,
 * ese número gana (salvo colisión con otro paciente).
 */
function kinesica_resolve_merge_phone(PDO $pdo, array $existing, string $newPhone): string
{
    $existingTel = trim((string) ($existing['telefono'] ?? ''));
    $existingClean = clean_phone_number($existingTel);
    $newClean = clean_phone_number($newPhone);

    if ($newClean === '') {
        return $existingTel !== '' ? $existingTel : $newPhone;
    }
    if (is_placeholder_phone($existingTel) || $existingClean === '' || $existingClean === $newClean) {
        return $newClean;
    }

    try {
        $stmt = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel AND id != :id LIMIT 1');
        $stmt->execute(['tel' => $newClean, 'id' => (int) ($existing['id'] ?? 0)]);
        if ($stmt->fetch()) {
            return $existingTel; // el nuevo ya pertenece a otro
        }
    } catch (Throwable) {
        return $existingTel;
    }
    return $newClean;
}

/**
 * Homónimos con WhatsApp reales distintos no se unen solo por nombre.
 */
function kinesica_phones_compatible_for_name_merge(string $phoneA, string $phoneB): bool
{
    $aClean = clean_phone_number($phoneA);
    $bClean = clean_phone_number($phoneB);
    $aReal = $aClean !== '' && !is_placeholder_phone($phoneA) && !is_placeholder_phone($aClean);
    $bReal = $bClean !== '' && !is_placeholder_phone($phoneB) && !is_placeholder_phone($bClean);
    if ($aReal && $bReal && $aClean !== $bClean) {
        return false;
    }
    return true;
}

function deduplicate_pacientes_table(PDO $pdo): int
{
    try {
        $stmt = $pdo->query('SELECT * FROM pacientes ORDER BY id ASC');
        if (!$stmt) return 0;
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) <= 1) return 0;

        $n = count($rows);
        $parent = range(0, $n - 1);
        $find = function (int $i) use (&$parent, &$find): int {
            if ($parent[$i] === $i) return $i;
            return $parent[$i] = $find($parent[$i]);
        };
        $union = function (int $i, int $j) use (&$parent, &$find): void {
            $rootI = $find($i);
            $rootJ = $find($j);
            if ($rootI !== $rootJ) {
                $parent[$rootI] = $rootJ;
            }
        };

        $byDni = [];
        $byName = [];
        $byPhone = [];

        foreach ($rows as $idx => $r) {
            $dni = clean_patient_dni($r['dni'] ?? null);
            if ($dni === '' && str_starts_with((string) ($r['telefono'] ?? ''), 'sin-tel-dni-')) {
                $dni = substr((string) $r['telefono'], 12);
            }
            if ($dni !== '') {
                if (isset($byDni[$dni])) $union($idx, $byDni[$dni]);
                else $byDni[$dni] = $idx;
            }

            $rawPhone = (string) ($r['telefono'] ?? '');
            $cleanPhone = clean_phone_number($rawPhone);
            if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone) && !is_placeholder_phone($rawPhone)) {
                if (isset($byPhone[$cleanPhone])) $union($idx, $byPhone[$cleanPhone]);
                else $byPhone[$cleanPhone] = $idx;
            }

            $full = trim(($r['nombre_completo'] ?? '') ?: (($r['nombre'] ?? '') . ' ' . ($r['apellido'] ?? '')));
            $nameKey = canonical_patient_name_key($full);
            // Nombre solo une si no hay dos WhatsApp reales distintos (homónimos).
            if ($nameKey !== '' && str_contains($nameKey, ' ')) {
                if (isset($byName[$nameKey])) {
                    $otherIdx = $byName[$nameKey];
                    if (kinesica_phones_compatible_for_name_merge(
                        (string) ($rows[$otherIdx]['telefono'] ?? ''),
                        $rawPhone
                    )) {
                        $union($idx, $otherIdx);
                    }
                } else {
                    $byName[$nameKey] = $idx;
                }
            }
        }

        $clusters = [];
        for ($i = 0; $i < $n; $i++) {
            $root = $find($i);
            $clusters[$root][] = $rows[$i];
        }

        $mergedTotal = 0;
        foreach ($clusters as $cluster) {
            if (count($cluster) <= 1) continue;

            usort($cluster, function ($a, $b) {
                $aReal = !is_placeholder_phone((string) ($a['telefono'] ?? ''));
                $bReal = !is_placeholder_phone((string) ($b['telefono'] ?? ''));
                if ($aReal !== $bReal) return $aReal ? -1 : 1;

                $aReview = !empty($a['dejo_review']);
                $bReview = !empty($b['dejo_review']);
                if ($aReview !== $bReview) return $aReview ? -1 : 1;

                $aProf = in_array($a['profesional_habitual'] ?? '', ['norberto', 'maria'], true);
                $bProf = in_array($b['profesional_habitual'] ?? '', ['norberto', 'maria'], true);
                if ($aProf !== $bProf) return $aProf ? -1 : 1;

                return ((int) $a['id']) - ((int) $b['id']);
            });

            $survivor = $cluster[0];
            $survivorId = (int) $survivor['id'];
            $deleteIds = [];

            // Conservar la mayor información posible entre todos los duplicados del cluster.
            $namePick = kinesica_pick_richest_name($cluster);
            $mergedNombre = $namePick['nombre'];
            $mergedApellido = $namePick['apellido'];
            $mergedFull = $namePick['nombre_completo'];
            $mergedPila = $namePick['nombre_pila'];
            $mergedTel = kinesica_pick_best_phone($cluster);
            if ($mergedTel === '') {
                $mergedTel = (string) ($survivor['telefono'] ?? '');
            }

            $mergedReview = 0;
            $mergedEncuesta = 0;
            $mergedCampana = 0;
            $mergedProf = 'indistinto';
            $mergedDni = '';
            $mergedEmail = '';
            $mergedMotivo = '';
            $mergedNotas = '';
            $mergedContactoNom = '';
            $mergedContactoTel = '';
            $mergedContactoEmail = '';
            $mergedContactoNotas = '';
            $mergedOrigen = 'whatsapp';

            foreach ($cluster as $c) {
                if ((int) $c['id'] !== $survivorId) {
                    $deleteIds[] = (int) $c['id'];
                }
                if (!empty($c['dejo_review'])) {
                    $mergedReview = 1;
                }
                if (!empty($c['encuesta_enviada'])) {
                    $mergedEncuesta = 1;
                }
                if (!empty($c['viene_de_campana'])) {
                    $mergedCampana = 1;
                }
                $mergedProf = merge_prof_values($mergedProf, (string) ($c['profesional_habitual'] ?? 'indistinto'));

                $cDni = clean_patient_dni($c['dni'] ?? null);
                if ($cDni === '' && str_starts_with((string) ($c['telefono'] ?? ''), 'sin-tel-dni-')) {
                    $cDni = substr((string) $c['telefono'], 12);
                }
                if ($mergedDni === '' && $cDni !== '') {
                    $mergedDni = $cDni;
                }

                $cEmail = trim((string) ($c['email'] ?? ''));
                if ($mergedEmail === '' && $cEmail !== '') {
                    $mergedEmail = $cEmail;
                } elseif ($mergedEmail !== '' && $cEmail !== '' && strcasecmp($mergedEmail, $cEmail) !== 0) {
                    // Dos mails distintos: conservar ambos en notas de contacto / notas.
                    $mergedNotas = kinesica_merge_text_keep_max(
                        $mergedNotas,
                        'Email alternativo: ' . $cEmail,
                        "\n"
                    );
                }

                $mergedMotivo = kinesica_merge_text_keep_max(
                    $mergedMotivo,
                    trim((string) ($c['motivo_consulta'] ?? '')),
                    ' / '
                );
                $mergedNotas = kinesica_merge_text_keep_max(
                    $mergedNotas,
                    trim((string) ($c['notas'] ?? '')),
                    "\n"
                );

                $cContactoNom = trim((string) ($c['contacto_nombre'] ?? ''));
                if ($mergedContactoNom === '' && $cContactoNom !== '') {
                    $mergedContactoNom = $cContactoNom;
                } elseif ($mergedContactoNom !== '' && $cContactoNom !== ''
                    && mb_strtolower($mergedContactoNom, 'UTF-8') !== mb_strtolower($cContactoNom, 'UTF-8')) {
                    $mergedContactoNotas = kinesica_merge_text_keep_max(
                        $mergedContactoNotas,
                        'Otro contacto: ' . $cContactoNom,
                        ' · '
                    );
                }

                $cContactoTel = trim((string) ($c['contacto_telefono'] ?? ''));
                if ($mergedContactoTel === '' && $cContactoTel !== '') {
                    $mergedContactoTel = $cContactoTel;
                }
                $cContactoEmail = trim((string) ($c['contacto_email'] ?? ''));
                if ($mergedContactoEmail === '' && $cContactoEmail !== '') {
                    $mergedContactoEmail = $cContactoEmail;
                }
                $mergedContactoNotas = kinesica_merge_text_keep_max(
                    $mergedContactoNotas,
                    trim((string) ($c['contacto_notas'] ?? '')),
                    ' · '
                );

                $mergedOrigen = kinesica_prefer_origen(
                    $mergedOrigen,
                    (string) ($c['origen'] ?? 'whatsapp')
                );
            }

            if ($mergedFull === '') {
                $mergedFull = trim($mergedNombre . ' ' . $mergedApellido);
            }
            if ($mergedPila === '') {
                $mergedPila = extract_first_name($mergedFull);
            }

            if (count($deleteIds) > 0) {
                $startedTx = false;
                try {
                    if (!$pdo->inTransaction()) {
                        $pdo->beginTransaction();
                        $startedTx = true;
                    }
                    $inClause = implode(',', array_map('intval', $deleteIds));
                    $pdo->exec("DELETE FROM pacientes WHERE id IN ($inClause)");

                    $upd = $pdo->prepare('
                        UPDATE pacientes SET
                            telefono = :tel,
                            nombre = :nom,
                            apellido = :ape,
                            nombre_completo = :full,
                            nombre_pila = :pila,
                            dni = :dni,
                            email = :email,
                            profesional_habitual = :prof,
                            motivo_consulta = :motivo,
                            notas = :notas,
                            origen = :origen,
                            contacto_nombre = :cnom,
                            contacto_telefono = :ctel,
                            contacto_email = :cemail,
                            contacto_notas = :cnot,
                            dejo_review = :rev,
                            encuesta_enviada = :encuesta,
                            viene_de_campana = :campana
                        WHERE id = :id
                    ');
                    $upd->execute([
                        'tel' => mb_substr($mergedTel, 0, 30, 'UTF-8'),
                        'nom' => mb_substr($mergedNombre, 0, 60, 'UTF-8'),
                        'ape' => mb_substr($mergedApellido, 0, 60, 'UTF-8'),
                        'full' => mb_substr($mergedFull, 0, 120, 'UTF-8'),
                        'pila' => mb_substr($mergedPila ?: extract_first_name($mergedFull), 0, 60, 'UTF-8'),
                        'dni' => $mergedDni !== '' ? mb_substr($mergedDni, 0, 20, 'UTF-8') : null,
                        'email' => $mergedEmail !== '' ? mb_substr($mergedEmail, 0, 120, 'UTF-8') : null,
                        'prof' => $mergedProf,
                        'motivo' => $mergedMotivo !== '' ? mb_substr($mergedMotivo, 0, 255, 'UTF-8') : null,
                        'notas' => $mergedNotas !== '' ? mb_substr($mergedNotas, 0, 2000, 'UTF-8') : null,
                        'origen' => in_array($mergedOrigen, ['whatsapp', 'web', 'admin'], true) ? $mergedOrigen : 'whatsapp',
                        'cnom' => $mergedContactoNom !== '' ? mb_substr($mergedContactoNom, 0, 120, 'UTF-8') : null,
                        'ctel' => $mergedContactoTel !== '' ? mb_substr($mergedContactoTel, 0, 30, 'UTF-8') : null,
                        'cemail' => $mergedContactoEmail !== '' ? mb_substr($mergedContactoEmail, 0, 120, 'UTF-8') : null,
                        'cnot' => $mergedContactoNotas !== '' ? mb_substr($mergedContactoNotas, 0, 100, 'UTF-8') : null,
                        'rev' => $mergedReview,
                        'encuesta' => $mergedEncuesta,
                        'campana' => $mergedCampana,
                        'id' => $survivorId,
                    ]);
                    // Confirmar que el survivor sigue existiendo tras el DELETE.
                    $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
                    $chk->execute(['id' => $survivorId]);
                    if (!$chk->fetch()) {
                        throw new RuntimeException('Survivor desapareció tras DELETE id=' . $survivorId);
                    }
                    if ($startedTx) {
                        $pdo->commit();
                    }
                    $mergedTotal += count($deleteIds);
                } catch (Throwable $clusterErr) {
                    if ($startedTx && $pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    error_log('deduplicate_pacientes_table cluster rollback: ' . $clusterErr->getMessage());
                    // Seguir con el próximo cluster; no abortar todo el barrido.
                }
            }
        }
        return $mergedTotal;
    } catch (Throwable $e) {
        error_log('deduplicate_pacientes_table error: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Infiere el profesional asignado ('norberto' o 'maria') según el día y horario del turno,
 * el correo del creador del evento o metadatos del calendario.
 * Retorna 'indistinto' si no puede ser determinado con certeza.
 *
 * Restricciones físicas del consultorio:
 * - 1 sola camilla física (jamás hay turnos solapados de ambos profesionales).
 * - Miércoles: Norberto exclusivo (09:00 a 16:30). María no atiende.
 * - Jueves: Norberto exclusivo (15:00 a 19:00). María no atiende.
 * - Lunes: María de 09:00 a 17:00 | Norberto de 17:30 a 19:30.
 * - Martes: María de 09:00 a 16:00 | Norberto de 16:30 a 19:30.
 * - Viernes: María de 09:00 a 13:00 | Norberto de 13:30 a 19:30.
 */
function infer_practitioner_from_schedule(?string $dateOrDow, ?string $time = null, ?string $creatorOrSummary = null): string
{
    // 1. Detección por creador del evento o mención explícita
    if ($creatorOrSummary !== null && $creatorOrSummary !== '') {
        $meta = mb_strtolower($creatorOrSummary, 'UTF-8');
        if (str_contains($meta, 'norberto1712@gmail.com') || preg_match('/\b(?:norberto|lic\.?\s*brude)\b/u', $meta)) {
            return 'norberto';
        }
        if (str_contains($meta, 'manosmagicas7116@gmail.com') || preg_match('/\b(?:maria|gulin|lic\.?\s*gulin)\b/u', $meta)) {
            return 'maria';
        }
    }

    if ($dateOrDow === null || trim($dateOrDow) === '') {
        return 'indistinto';
    }

    $dow = null;
    $trimmed = trim($dateOrDow);

    // Si $trimmed es un dígito de día de semana (1=Lun .. 7=Dom)
    if (ctype_digit($trimmed) && (int) $trimmed >= 1 && (int) $trimmed <= 7) {
        $dow = (int) $trimmed;
    } elseif (preg_match('/\b(?:miercoles|miércoles|mie|mié)\b/ui', $trimmed)) {
        $dow = 3;
    } elseif (preg_match('/\b(?:jueves|jue)\b/ui', $trimmed)) {
        $dow = 4;
    } elseif (preg_match('/\b(?:lunes|lun)\b/ui', $trimmed)) {
        $dow = 1;
    } elseif (preg_match('/\b(?:martes|mar)\b/ui', $trimmed)) {
        $dow = 2;
    } elseif (preg_match('/\b(?:viernes|vie)\b/ui', $trimmed)) {
        $dow = 5;
    } else {
        // Tratar como fecha (ISO 8601 o YYYY-MM-DD o con hora)
        try {
            $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
            $dt = new DateTimeImmutable($trimmed, $tz);
            $dow = (int) $dt->format('N'); // 1 = Monday .. 7 = Sunday
            if (($time === null || trim($time) === '') && preg_match('/[T\s](\d{1,2}:\d{2})/', $trimmed, $m)) {
                $time = $m[1];
            }
        } catch (Throwable) {
            $dow = null;
        }
    }

    if ($dow === null) {
        return 'indistinto';
    }

    // Miércoles y Jueves son 100% exclusivos de Norberto (María no atiende ningún turno)
    if ($dow === 3 || $dow === 4) {
        return 'norberto';
    }

    // Parsear la hora (formato HH:MM)
    $minutes = null;
    if ($time !== null && trim($time) !== '') {
        if (preg_match('/(\d{1,2}):(\d{2})/', trim($time), $tm)) {
            $h = (int) $tm[1];
            $m = (int) $tm[2];
            $minutes = $h * 60 + $m;
        }
    }

    // Si no hay hora especificada en Lunes, Martes o Viernes, no se puede deducir solo con el día
    if ($minutes === null) {
        return 'indistinto';
    }

    // Lunes (1): María 09:00 a 17:00 (540-1020 min) | Norberto 17:30 a 19:30 (1050-1170 min)
    if ($dow === 1) {
        if ($minutes >= 17 * 60 + 15) { // 17:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    // Martes (2): María 09:00 a 16:00 (540-960 min) | Norberto 16:30 a 19:30 (990-1170 min)
    if ($dow === 2) {
        if ($minutes >= 16 * 60 + 15) { // 16:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    // Viernes (5): María 09:00 a 13:00 (540-780 min) | Norberto 13:30 a 19:30 (810-1170 min)
    if ($dow === 5) {
        if ($minutes >= 13 * 60 + 15) { // 13:15 en adelante
            return 'norberto';
        }
        return 'maria';
    }

    return 'indistinto';
}

/**
 * Resuelve y actualiza pacientes que tengan 'indistinto' comparando contra
 * los turnos registrados en Google Calendar y la tabla recordatorio_eventos.
 */
function resolve_indistinto_pacientes_from_calendar(PDO $pdo): int
{
    $updatedCount = 0;
    try {
        // 1. Mapeo verificado de turnos históricos y agendados en Google Calendar
        // de pacientes que figuraban como 'indistinto'.
        $calendarSeedResolutions = [
            'gaglio silvina' => 'norberto',       // Miércoles 14:00 - norberto1712@gmail.com
            'silvina gaglio' => 'norberto',
            'maldonado ana' => 'maria',           // Lunes 12:00 - manosmagicas7116@gmail.com
            'ana maldonado' => 'maria',
            'augusto oviedo' => 'norberto',       // Lunes 17:30 - norberto1712@gmail.com
            'oviedo augusto' => 'norberto',
            'alejandro rosenfeld' => 'maria',     // Lunes 10:00 - manosmagicas7116@gmail.com
            'rosenfeld alejandro' => 'maria',
            'lipsyc silvana' => 'maria',          // Lunes 11:00 - manosmagicas7116@gmail.com
            'silvana lipsyc' => 'maria',
            'esteban jorge' => 'norberto',        // Miércoles 11:15 - norberto1712@gmail.com
            'jorge esteban' => 'norberto',
            'claudia victos' => 'norberto',       // Martes 18:00 - norberto1712@gmail.com
            'victos claudia' => 'norberto',
            'claudia maria victos' => 'norberto',
            'claudia victos maria' => 'norberto',
            'ma claudia victos' => 'norberto',
        ];

        // Teléfonos conocidos de calendar
        $calendarPhoneResolutions = [
            '5491154562619' => 'norberto', // Augusto Oviedo 1154562619
            '5491149927754' => 'norberto', // Jorge Esteban 1149927754
        ];

        // Obtener todos los pacientes que estén en 'indistinto' o vacíos
        $stmtIndistintos = $pdo->query("
            SELECT id, telefono, nombre, apellido, nombre_completo, profesional_habitual 
            FROM pacientes 
            WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''
        ");
        if (!$stmtIndistintos) {
            return 0;
        }

        $indistintos = $stmtIndistintos->fetchAll(PDO::FETCH_ASSOC);
        if (empty($indistintos)) {
            return 0;
        }

        // Consultar eventos de recordatorios si la tabla existe
        $eventosMap = [];
        try {
            $stmtEv = $pdo->query("
                SELECT patient_name, wa_id, appointment_date, appointment_time, event_summary 
                FROM recordatorio_eventos 
                WHERE (appointment_date IS NOT NULL AND appointment_date != '') 
                   OR (event_summary IS NOT NULL AND event_summary != '')
                ORDER BY run_at DESC
            ");
            if ($stmtEv) {
                while ($ev = $stmtEv->fetch(PDO::FETCH_ASSOC)) {
                    $inferred = infer_practitioner_from_schedule(
                        (string) ($ev['appointment_date'] ?? ''),
                        (string) ($ev['appointment_time'] ?? ''),
                        (string) ($ev['event_summary'] ?? '')
                    );
                    if ($inferred !== 'indistinto') {
                        $wa = preg_replace('/\D+/', '', (string) ($ev['wa_id'] ?? ''));
                        if ($wa !== '') {
                            $eventosMap['phone_' . $wa] = $inferred;
                            if (strlen($wa) >= 8) {
                                $eventosMap['phone_' . substr($wa, -8)] = $inferred;
                            }
                        }
                        $nameKey = canonical_patient_name_key((string) ($ev['patient_name'] ?? ''));
                        if ($nameKey !== '') {
                            $eventosMap['name_' . $nameKey] = $inferred;
                        }
                    }
                }
            }
        } catch (Throwable) {}

        $updateStmt = $pdo->prepare("
            UPDATE pacientes 
            SET profesional_habitual = :prof 
            WHERE id = :id AND (profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = '')
        ");

        foreach ($indistintos as $p) {
            $id = (int) $p['id'];
            $targetProf = null;

            // 1. Por teléfono directo
            $cleanTel = preg_replace('/\D+/', '', (string) ($p['telefono'] ?? ''));
            if ($cleanTel !== '' && isset($calendarPhoneResolutions[$cleanTel])) {
                $targetProf = $calendarPhoneResolutions[$cleanTel];
            } elseif ($cleanTel !== '' && isset($eventosMap['phone_' . $cleanTel])) {
                $targetProf = $eventosMap['phone_' . $cleanTel];
            } elseif (strlen($cleanTel) >= 8 && isset($eventosMap['phone_' . substr($cleanTel, -8)])) {
                $targetProf = $eventosMap['phone_' . substr($cleanTel, -8)];
            }

            // 2. Por coincidencia de nombre si aún no se determinó
            if ($targetProf === null) {
                $fullName = trim(($p['nombre_completo'] ?? '') ?: (($p['nombre'] ?? '') . ' ' . ($p['apellido'] ?? '')));
                $nKey = canonical_patient_name_key($fullName);
                if ($nKey !== '' && isset($calendarSeedResolutions[$nKey])) {
                    $targetProf = $calendarSeedResolutions[$nKey];
                } elseif ($nKey !== '' && isset($eventosMap['name_' . $nKey])) {
                    $targetProf = $eventosMap['name_' . $nKey];
                } else {
                    // Tokens parciales (por ejemplo "claudia victos" dentro de "claudia maria victos")
                    foreach ($calendarSeedResolutions as $seedKey => $profVal) {
                        $seedTokens = explode(' ', $seedKey);
                        $matchAllTokens = true;
                        foreach ($seedTokens as $st) {
                            if (!str_contains($nKey, $st)) {
                                $matchAllTokens = false;
                                break;
                            }
                        }
                        if ($matchAllTokens) {
                            $targetProf = $profVal;
                            break;
                        }
                    }
                }
            }

            if ($targetProf === 'norberto' || $targetProf === 'maria') {
                $updateStmt->execute(['prof' => $targetProf, 'id' => $id]);
                $updatedCount++;
            }
        }
    } catch (Throwable $e) {
        error_log('resolve_indistinto_pacientes_from_calendar error: ' . $e->getMessage());
    }

    return $updatedCount;
}

function ensure_pacientes_tables(PDO $pdo, bool $force = false): void
{
    static $checked = false;
    if ($checked && !$force) return;

    // REL: puente DDL idempotente (CREATE/ADD IF NOT EXISTS). No borra datos.
    // Migrate CLI es la fuente preferida; este ensure no se apaga (seguridad productiva).

    $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    if ($driver === 'sqlite') {
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS pacientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefono TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                apellido TEXT NOT NULL,
                nombre_completo TEXT NOT NULL,
                nombre_pila TEXT NOT NULL,
                dni TEXT,
                email TEXT,
                profesional_habitual TEXT NOT NULL DEFAULT "indistinto",
                motivo_consulta TEXT,
                notas TEXT,
                origen TEXT NOT NULL DEFAULT "whatsapp",
                contacto_nombre TEXT,
                contacto_telefono TEXT,
                contacto_email TEXT,
                contacto_notas TEXT,
                dejo_review INTEGER NOT NULL DEFAULT 0,
                encuesta_enviada INTEGER NOT NULL DEFAULT 0,
                viene_de_campana INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS lista_espera (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paciente_telefono TEXT NOT NULL,
                paciente_nombre TEXT NOT NULL,
                rango_horario_preferido TEXT NULL,
                dias_preferidos TEXT NULL,
                profesional TEXT NOT NULL DEFAULT "indistinto",
                estado TEXT NOT NULL DEFAULT "activa",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');
    } else {
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS pacientes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                telefono VARCHAR(30) NOT NULL UNIQUE,
                nombre VARCHAR(60) NOT NULL,
                apellido VARCHAR(60) NOT NULL,
                nombre_completo VARCHAR(120) NOT NULL,
                nombre_pila VARCHAR(60) NOT NULL,
                dni VARCHAR(20) NULL,
                email VARCHAR(120) NULL,
                profesional_habitual ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
                motivo_consulta VARCHAR(255) NULL,
                notas TEXT NULL,
                origen ENUM("whatsapp", "web", "admin") NOT NULL DEFAULT "whatsapp",
                contacto_nombre VARCHAR(120) NULL,
                contacto_telefono VARCHAR(30) NULL,
                contacto_email VARCHAR(120) NULL,
                contacto_notas VARCHAR(100) NULL,
                dejo_review TINYINT(1) NOT NULL DEFAULT 0,
                encuesta_enviada TINYINT(1) NOT NULL DEFAULT 0,
                viene_de_campana TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_pacientes_dni (dni),
                INDEX idx_pacientes_email (email),
                INDEX idx_pacientes_nombre (nombre, apellido)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS lista_espera (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paciente_telefono VARCHAR(30) NOT NULL,
                paciente_nombre VARCHAR(120) NOT NULL,
                rango_horario_preferido VARCHAR(120) NULL,
                dias_preferidos VARCHAR(120) NULL,
                profesional ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
                estado ENUM("activa", "contactado", "asignado", "cancelada") NOT NULL DEFAULT "activa",
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_espera_telefono (paciente_telefono),
                INDEX idx_espera_estado (estado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN dejo_review TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable) {}

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN encuesta_enviada TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable) {}

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN viene_de_campana TINYINT(1) NOT NULL DEFAULT 1');
    } catch (Throwable) {}

    // REL: puente DDL columnas (deleted_at/version/paciente_id/profesional_id)
    // si migrate.php aún no corrió. Fuente: admin/api/migrations/. Retirar tras etapa 10.
    require_once __DIR__ . '/lib_migrations.php';
    try {
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'deleted_at',
            'DATETIME NULL DEFAULT NULL',
            'TEXT NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1',
            'INTEGER NOT NULL DEFAULT 1'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'profesional_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
    } catch (Throwable) {
    }

    $checked = true;
    // Mantenimiento pesado SOLO con $force (cron / action=deduplicate / scripts).
    // Nunca en el hot path de alta/edición/listado.
    if ($force) {
        kinesica_pacientes_run_maintenance_if_due($pdo, true);
    }
}

/**
 * Mantenimiento pesado del directorio (sanitize + sync fichas + dedupe + indistintos).
 * Throttle por marker file para no bloquear POST insert/upsert del admin.
 */
function kinesica_pacientes_run_maintenance_if_due(PDO $pdo, bool $force = false): void
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $marker = $dir . '/.pacientes_maintenance';
    $ttlSeconds = 6 * 3600;
    if (!$force && is_file($marker)) {
        $age = time() - (int) @filemtime($marker);
        if ($age >= 0 && $age < $ttlSeconds) {
            return;
        }
    }

    try {
        $pdo->exec("DELETE FROM pacientes WHERE LOWER(nombre_completo) LIKE '%tk3%' OR LOWER(nombre_completo) LIKE '%tk 3%' OR LOWER(nombre) LIKE '%tk3%' OR LOWER(nombre) LIKE '%tk 3%' OR LOWER(nombre_completo) LIKE '%no dar%' OR LOWER(nombre) LIKE '%no dar%' OR LOWER(apellido) LIKE '%no dar%'");

        $pdo->exec("UPDATE pacientes SET 
            nombre = TRIM(REPLACE(REPLACE(REPLACE(nombre, '\r', ' '), '\n', ' '), ',', '')),
            apellido = TRIM(REPLACE(REPLACE(REPLACE(apellido, '\r', ' '), '\n', ' '), ',', '')),
            nombre_completo = TRIM(REPLACE(REPLACE(REPLACE(nombre_completo, '\r', ' '), '\n', ' '), ',', '')),
            nombre_pila = TRIM(REPLACE(REPLACE(REPLACE(nombre_pila, '\r', ' '), '\n', ' '), ',', '')),
            contacto_nombre = CASE WHEN contacto_nombre IS NOT NULL THEN TRIM(REPLACE(REPLACE(REPLACE(contacto_nombre, '\r', ' '), '\n', ' '), ',', '')) ELSE NULL END
        WHERE nombre LIKE '%,%' OR nombre LIKE '%\n%' OR nombre LIKE '%\r%'
           OR apellido LIKE '%,%' OR apellido LIKE '%\n%' OR apellido LIKE '%\r%'
           OR nombre_completo LIKE '%,%' OR nombre_completo LIKE '%\n%' OR nombre_completo LIKE '%\r%'
           OR contacto_nombre LIKE '%,%' OR contacto_nombre LIKE '%\n%' OR contacto_nombre LIKE '%\r%'");

        $pdo->exec("UPDATE lista_espera SET
            paciente_nombre = TRIM(REPLACE(REPLACE(REPLACE(paciente_nombre, '\r', ' '), '\n', ' '), ',', ''))
        WHERE paciente_nombre LIKE '%,%' OR paciente_nombre LIKE '%\n%' OR paciente_nombre LIKE '%\r%'");

        $stmtSanitize = $pdo->query("SELECT id, nombre, apellido, nombre_completo, contacto_nombre FROM pacientes");
        if ($stmtSanitize) {
            $updateStmt = $pdo->prepare("UPDATE pacientes SET nombre = :nom, apellido = :ape, nombre_completo = :full, nombre_pila = :pila, contacto_nombre = :cont WHERE id = :id");
            while ($row = $stmtSanitize->fetch(PDO::FETCH_ASSOC)) {
                $nom = sanitize_patient_name($row['nombre'] ?? '');
                $ape = sanitize_patient_name($row['apellido'] ?? '');
                $full = sanitize_patient_name($row['nombre_completo'] ?? '');
                $cont = isset($row['contacto_nombre']) && $row['contacto_nombre'] !== null ? sanitize_patient_name($row['contacto_nombre']) : null;
                if ($nom !== $row['nombre'] || $ape !== $row['apellido'] || $full !== $row['nombre_completo'] || $cont !== ($row['contacto_nombre'] ?? null)) {
                    $pila = extract_first_name($full);
                    $updateStmt->execute(['id' => (int) $row['id'], 'nom' => $nom, 'ape' => $ape, 'full' => $full, 'pila' => $pila, 'cont' => $cont]);
                }
            }
        }

        try {
            $stmtSanitizeEsp = $pdo->query("SELECT id, paciente_nombre FROM lista_espera");
            if ($stmtSanitizeEsp) {
                $updateEspStmt = $pdo->prepare("UPDATE lista_espera SET paciente_nombre = :nom WHERE id = :id");
                while ($row = $stmtSanitizeEsp->fetch(PDO::FETCH_ASSOC)) {
                    $cleanNom = sanitize_patient_name($row['paciente_nombre'] ?? '');
                    if ($cleanNom !== ($row['paciente_nombre'] ?? '')) {
                        $updateEspStmt->execute(['id' => (int) $row['id'], 'nom' => $cleanNom]);
                    }
                }
            }
        } catch (Throwable) {
        }

        try {
            $stmtSanitizeFichas = $pdo->query("SELECT id, payload FROM fichas");
            if ($stmtSanitizeFichas) {
                $updateFichaStmt = $pdo->prepare("UPDATE fichas SET payload = :p WHERE id = :id");
                while ($row = $stmtSanitizeFichas->fetch(PDO::FETCH_ASSOC)) {
                    $payload = json_decode((string) ($row['payload'] ?? ''), true);
                    if (is_array($payload) && isset($payload['nombre'])) {
                        $cleanNom = sanitize_patient_name((string) $payload['nombre']);
                        if ($cleanNom !== $payload['nombre']) {
                            $payload['nombre'] = $cleanNom;
                            $updateFichaStmt->execute(['id' => (string) $row['id'], 'p' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
                        }
                    }
                }
            }
        } catch (Throwable) {
        }
    } catch (Throwable) {
    }

    try {
        sync_pacientes_from_fichas($pdo, null, null, null, $force);
    } catch (Throwable) {
    }
    try {
        deduplicate_pacientes_table($pdo);
    } catch (Throwable) {
    }
    try {
        resolve_indistinto_pacientes_from_calendar($pdo);
    } catch (Throwable) {
    }

    @file_put_contents($marker, (string) time());
}

/**
 * Sincroniza pacientes desde las historias clínicas (`fichas`) hacia la tabla `pacientes`.
 * Si se pasa $singleId o $singlePayload, sincroniza una ficha puntual; de lo contrario procesa todas.
 */
function sync_pacientes_from_fichas(PDO $pdo, ?string $singleId = null, ?array $singlePayload = null, ?string $singleProf = null, bool $force = false): void
{
    static $syncedAll = false;

    if ($singleId === null && $singlePayload === null) {
        if ($syncedAll && !$force) return;
        $syncedAll = true;
        try {
            $stmt = $pdo->query('SELECT id, payload, profesional FROM fichas ORDER BY updated_at ASC');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable) {
            return;
        }
    } else {
        $rows = [[
            'id' => $singleId ?? '',
            'payload' => $singlePayload !== null ? json_encode($singlePayload) : '',
            'profesional' => $singleProf ?? '',
        ]];
    }

    foreach ($rows as $row) {
        $payload = is_array($row['payload'] ?? null) ? $row['payload'] : json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) continue;

        $nombreRaw = sanitize_patient_name(trim((string) ($payload['nombre'] ?? '')));
        if ($nombreRaw === '' || is_tk3_or_blocked_name($nombreRaw)) continue;

        if (isset($payload['nombre']) && $nombreRaw !== $payload['nombre'] && !empty($row['id'])) {
            $payload['nombre'] = $nombreRaw;
            try {
                $upFicha = $pdo->prepare('UPDATE fichas SET payload = :p WHERE id = :id');
                $upFicha->execute(['p' => json_encode($payload, JSON_UNESCAPED_UNICODE), 'id' => (string) $row['id']]);
            } catch (Throwable) {}
        }

        $dniRaw = trim((string) ($payload['dni'] ?? ''));
        $dniClean = clean_patient_dni($dniRaw);

        $motivoRaw = trim((string) ($payload['motivo'] ?? ''));
        $profRaw = strtolower(trim((string) ($row['profesional'] ?? $payload['profesional'] ?? '')));
        $prof = in_array($profRaw, ['norberto', 'maria'], true) ? $profRaw : 'indistinto';

        // Intentar ubicar paciente existente por DNI, teléfono o clave canónica de nombre
        $existing = find_existing_patient_match($pdo, null, $nombreRaw, $dniClean !== '' ? $dniClean : null);

        if ($existing) {
            // Actualizar campos faltantes respetando reglas
            $updates = [];
            $params = ['id' => (int) $existing['id']];
            if (empty($existing['dni']) && $dniClean !== '') {
                $updates[] = 'dni = :dni';
                $params['dni'] = mb_substr($dniClean, 0, 20, 'UTF-8');
            }
            if (empty($existing['motivo_consulta']) && $motivoRaw !== '') {
                $updates[] = 'motivo_consulta = :motivo';
                $params['motivo'] = mb_substr($motivoRaw, 0, 255, 'UTF-8');
            }
            // Regla: si uno dice indistinto y otro dice con tal, queda tal
            $existingProf = $existing['profesional_habitual'] ?? 'indistinto';
            $mergedProf = merge_prof_values($existingProf, $prof);
            if ($mergedProf !== $existingProf) {
                $updates[] = 'profesional_habitual = :prof';
                $params['prof'] = $mergedProf;
            }
            if (count($updates) > 0) {
                try {
                    $sql = 'UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id';
                    $pdo->prepare($sql)->execute($params);
                } catch (Throwable) {}
            }
            continue;
        }

        // Si no existe, crear nuevo registro
        $parts = preg_split('/\s+/u', $nombreRaw, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nombre = $parts[0] ?? $nombreRaw;
        $apellido = $parts[1] ?? '';
        $nombrePila = extract_first_name($nombreRaw) ?: $nombre;

        // Generar identificador para teléfono placeholder (VARCHAR(30) UNIQUE)
        if ($dniClean !== '') {
            $placeholderTel = 'sin-tel-dni-' . substr($dniClean, 0, 18);
        } else {
            $fichaId = (string) ($row['id'] ?? '');
            $cleanFichaId = preg_replace('/[^0-9a-fA-F]/', '', $fichaId) ?? '';
            if (strlen($cleanFichaId) >= 12) {
                $placeholderTel = 'sin-tel-f-' . substr($cleanFichaId, 0, 18);
            } else {
                $placeholderTel = 'sin-tel-' . substr(md5($nombreRaw), 0, 18);
            }
        }

        try {
            $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON CONFLICT(telefono) DO UPDATE SET
                        dni = COALESCE(dni, excluded.dni),
                        motivo_consulta = COALESCE(motivo_consulta, excluded.motivo_consulta),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN excluded.profesional_habitual ELSE profesional_habitual END
                ';
            } else {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON DUPLICATE KEY UPDATE
                        dni = COALESCE(dni, VALUES(dni)),
                        motivo_consulta = COALESCE(motivo_consulta, VALUES(motivo_consulta)),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END
                ';
            }
            $stmtIns = $pdo->prepare($sql);
            $stmtIns->execute([
                'tel' => mb_substr($placeholderTel, 0, 30, 'UTF-8'),
                'nombre' => mb_substr($nombre, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($apellido, 0, 60, 'UTF-8'),
                'full' => mb_substr($nombreRaw, 0, 120, 'UTF-8'),
                'pila' => mb_substr($nombrePila, 0, 60, 'UTF-8'),
                'dni' => $dniClean !== '' ? mb_substr($dniClean, 0, 20, 'UTF-8') : null,
                'prof' => $prof,
                'motivo' => $motivoRaw !== '' ? mb_substr($motivoRaw, 0, 255, 'UTF-8') : null,
            ]);
        } catch (Throwable) {}
    }
    // Dedupe/indistintos: no acá. Van en kinesica_pacientes_run_maintenance_if_due
    // o en action=deduplicate. Correrlos tras cada ficha/alta tumba el request.
}
