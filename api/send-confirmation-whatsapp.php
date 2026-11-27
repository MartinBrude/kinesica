<?php
/**
 * Despacho WhatsApp de confirmación de turno (plantilla Clara / Meta).
 */

/**
 * Fecha corta para plantilla WA: "Jueves 12/03".
 */
function kinesica_confirmation_wa_fecha_corta(string $dateStr): string
{
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $dateStr, $m)) {
        $dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        $ts = mktime(12, 0, 0, (int) $m[2], (int) $m[3], (int) $m[1]);
        return $dias[(int) date('w', $ts)] . ' ' . $m[3] . '/' . $m[2];
    }
    return trim($dateStr);
}

/**
 * Hora sin sufijo "hs" (la plantilla Meta ya dice "a las {{3}} hs").
 */
function kinesica_confirmation_wa_hora(string $horaRaw): string
{
    $h = trim($horaRaw);
    if ($h === '') {
        return '';
    }
    if (preg_match('/^(\d{1,2}:\d{2})/', $h, $m)) {
        return $m[1];
    }
    return preg_replace('/\s*hs\.?\s*$/iu', '', $h) ?? $h;
}

/**
 * Nombre de pila para saludo WA.
 */
function kinesica_confirmation_wa_first_name(string $paciente): string
{
    $full = trim($paciente);
    if ($full === '') {
        return 'Estimado/a paciente';
    }
    if (!function_exists('extract_first_name')) {
        $helper = dirname(__DIR__) . '/admin/api/pacientes_helpers_search_key.php';
        if (is_file($helper)) {
            require_once $helper;
        }
    }
    if (function_exists('extract_first_name')) {
        $pila = trim(extract_first_name($full));
        if ($pila !== '') {
            return $pila;
        }
    }
    $parts = preg_split('/\s+/u', $full, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    return (string) ($parts[0] ?? $full);
}

/**
 * Normaliza teléfono para Meta Cloud API.
 */
function kinesica_confirmation_wa_normalize_phone(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }
    if (!function_exists('clean_phone_number')) {
        $helper = dirname(__DIR__) . '/admin/api/pacientes_helpers_search_key.php';
        if (is_file($helper)) {
            require_once $helper;
        }
    }
    if (function_exists('clean_phone_number')) {
        $clean = clean_phone_number($raw);
        if (is_string($clean) && $clean !== '') {
            return preg_replace('/\D+/', '', $clean) ?? '';
        }
    }
    return preg_replace('/\D+/', '', $raw) ?? '';
}

/**
 * ¿Teléfono usable para WhatsApp?
 */
function kinesica_confirmation_phone_usable(string $raw): bool
{
    $digits = kinesica_confirmation_wa_normalize_phone($raw);
    if (strlen($digits) < 10 || strlen($digits) > 15) {
        return false;
    }
    if (preg_match('/^(\d)\1+$/', $digits)) {
        return false;
    }
    return true;
}

/**
 * Envía confirmación de turno por WhatsApp (best-effort).
 *
 * @return array{ok: bool, skipped?: bool, error?: string, to?: string}
 */
function kinesica_confirmation_deliver_whatsapp(
    string $telefonoRaw,
    string $paciente,
    string $fechaRaw,
    string $horaRaw,
    string $profesional,
    string $servicio,
    string $direccion
): array {
    if (!kinesica_confirmation_phone_usable($telefonoRaw)) {
        return ['ok' => false, 'skipped' => true, 'error' => 'Sin teléfono válido'];
    }

    $to = kinesica_confirmation_wa_normalize_phone($telefonoRaw);
    require_once dirname(__DIR__) . '/admin/api/lib_whatsapp.php';

    $profLine = trim($profesional);
    $serv = trim($servicio);
    if ($serv !== '' && $serv !== 'No especifica' && strcasecmp($serv, 'Terapias Manuales') !== 0 && stripos($profLine, $serv) === false) {
        $profLine = $profLine !== '' ? ($profLine . ' · ' . $serv) : $serv;
    }
    if ($profLine === '') {
        $profLine = 'Kinésica';
    }

    $addr = trim($direccion);
    if ($addr === '') {
        $addr = 'Charcas 3889, 5º B, Palermo';
    }

    try {
        $res = send_whatsapp_booking_confirmation_template($to, [
            'patient_name' => kinesica_confirmation_wa_first_name($paciente),
            'fecha' => kinesica_confirmation_wa_fecha_corta($fechaRaw),
            'hora' => kinesica_confirmation_wa_hora($horaRaw),
            'profesional' => $profLine,
            'direccion' => $addr,
        ]);
    } catch (Throwable $e) {
        error_log('kinesica confirmation whatsapp: ' . $e->getMessage());
        return ['ok' => false, 'error' => 'Excepción al enviar WhatsApp', 'to' => $to];
    }

    if (!empty($res['ok'])) {
        $out = ['ok' => true, 'to' => $to];
        if (!empty($res['language'])) {
            $out['language'] = $res['language'];
        }
        return $out;
    }

    $err = (string) ($res['error'] ?? 'No se pudo enviar WhatsApp');
    error_log('kinesica confirmation whatsapp fail: ' . $err . ' lang=' . (string) ($res['language'] ?? '') . ' raw=' . (string) ($res['raw_error'] ?? ''));
    $fail = [
        'ok' => false,
        'error' => $err,
        'to' => $to,
        'error_code' => $res['error_code'] ?? null,
    ];
    foreach (['language', 'raw_error', 'raw_details', 'hint'] as $k) {
        if (!empty($res[$k])) {
            $fail[$k] = $res[$k];
        }
    }
    return $fail;
}
