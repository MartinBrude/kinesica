<?php
declare(strict_types=1);

/**
 * Parseo de contacto desde eventos de Google Calendar.
 * Prioridad: clave:valor en descripción → patrones legacy → título/summary.
 */

if (!function_exists('clean_phone_number') || !function_exists('clean_patient_dni')) {
    require_once __DIR__ . '/pacientes_helpers.php';
}

/**
 * Mapa clave→valor desde texto libre (líneas o segmentos " | ").
 *
 * @return array<string,string> claves normalizadas (sin acentos, lower)
 */
function kinesica_parse_calendar_kv_map(string $text): array
{
    $text = trim($text);
    if ($text === '') {
        return [];
    }
    // Unificar separadores típicos de Calendar ( | ) y saltos de línea.
    $chunks = preg_split('/\s*(?:\||\r\n|\r|\n)\s*/u', $text) ?: [];
    $map = [];
    foreach ($chunks as $chunk) {
        $chunk = trim((string) $chunk);
        if ($chunk === '') {
            continue;
        }
        // Quitar emoji / viñetas iniciales: "📱 WhatsApp: 11..."
        $chunk = preg_replace('/^[^\wáéíóúÁÉÍÓÚñÑüÜ]+/u', '', $chunk) ?? $chunk;
        if (!preg_match('/^([^:]{1,40})\s*:\s*(.+)$/u', $chunk, $m)) {
            continue;
        }
        $key = kinesica_normalize_calendar_kv_key((string) $m[1]);
        $val = trim((string) $m[2]);
        if ($key === '' || $val === '') {
            continue;
        }
        // Primer valor gana (más específico al inicio de la descripción).
        if (!isset($map[$key])) {
            $map[$key] = $val;
        }
    }
    return $map;
}

function kinesica_normalize_calendar_kv_key(string $raw): string
{
    $s = mb_strtolower(trim($raw), 'UTF-8');
    $s = strtr($s, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    $s = preg_replace('/[^a-z0-9]+/u', '', $s) ?? '';
    return $s;
}

/**
 * @return array{phone:string,dni:string}
 */
function kinesica_extract_calendar_contacts(string $titleOrSummary = '', string $description = ''): array
{
    $phone = '';
    $dni = '';

    $descMap = kinesica_parse_calendar_kv_map($description);
    $titleMap = kinesica_parse_calendar_kv_map($titleOrSummary);

    $phoneKeys = ['telefono', 'whatsapp', 'wa', 'tel', 'celular', 'movil', 'phone'];
    $dniKeys = ['dni', 'documento', 'doc', 'pasaporte', 'document', 'passport'];

    foreach ($phoneKeys as $k) {
        if ($phone === '' && !empty($descMap[$k])) {
            $phone = clean_phone_number((string) $descMap[$k]);
        }
    }
    foreach ($dniKeys as $k) {
        if ($dni === '' && !empty($descMap[$k])) {
            $dni = clean_patient_dni((string) $descMap[$k]);
        }
    }

    // Título también puede traer clave:valor (migración gradual).
    foreach ($phoneKeys as $k) {
        if ($phone === '' && !empty($titleMap[$k])) {
            $phone = clean_phone_number((string) $titleMap[$k]);
        }
    }
    foreach ($dniKeys as $k) {
        if ($dni === '' && !empty($titleMap[$k])) {
            $dni = clean_patient_dni((string) $titleMap[$k]);
        }
    }

    // Legacy: "WhatsApp: …" / dígitos sueltos en descripción, luego título.
    if ($phone === '' && $description !== '' && function_exists('recordatorios_extract_phone_candidate')) {
        $phone = recordatorios_extract_phone_candidate($description);
    }
    if ($phone === '' && $titleOrSummary !== '' && function_exists('recordatorios_extract_phone_candidate')) {
        $phone = recordatorios_extract_phone_candidate($titleOrSummary);
    }

    // Legacy DNI en descripción/título sin clave estricta: "DNI 30111222" / "Doc 30.111.222"
    if ($dni === '') {
        $dni = kinesica_extract_dni_loose($description);
    }
    if ($dni === '') {
        $dni = kinesica_extract_dni_loose($titleOrSummary);
    }

    if ($phone !== '' && function_exists('is_placeholder_phone') && is_placeholder_phone($phone)) {
        $phone = '';
    }

    return ['phone' => $phone, 'dni' => $dni];
}

function kinesica_extract_dni_loose(string $text): string
{
    $t = trim($text);
    if ($t === '') {
        return '';
    }
    if (preg_match('/\b(?:dni|documento|doc|pasaporte)\b\s*[:#-]?\s*([0-9][0-9.\-\s]{4,18})/iu', $t, $m)) {
        return clean_patient_dni($m[1]);
    }
    return '';
}
