<?php
declare(strict_types=1);

function interacciones_phone_format(string $digits): string
{
    if (str_starts_with($digits, 'ig_')) {
        return '@' . ltrim(substr($digits, 3), '@');
    }
    $d = interacciones_clean_wa_id($digits);
    if ($d === '') {
        return 'Desconocido';
    }
    if (strncmp($d, '54911', 5) === 0 && strlen($d) === 13) {
        return '(+54) 9 11 ' . substr($d, 5, 4) . ' ' . substr($d, 9);
    }
    if (strncmp($d, '549', 3) === 0 && strlen($d) >= 12) {
        $rest = substr($d, 3);
        if (strlen($rest) === 10) {
            return '(+54) 9 ' . substr($rest, 0, 3) . ' ' . substr($rest, 3, 3) . ' ' . substr($rest, 6);
        }
        if (strlen($rest) >= 8) {
            $p1 = substr($rest, -8, 4);
            $p2 = substr($rest, -4);
            $area = substr($rest, 0, -8);
            return '(+54) 9 ' . $area . ' ' . $p1 . ' ' . $p2;
        }
        return '(+54) 9 ' . $rest;
    }
    if (strncmp($d, '54', 2) === 0 && strlen($d) >= 10) {
        $rest = substr($d, 2);
        if (strncmp($rest, '11', 2) === 0 && strlen($rest) === 10) {
            return '(+54) 11 ' . substr($rest, 2, 4) . ' ' . substr($rest, 6);
        }
        return '(+54) ' . $rest;
    }
    if (strncmp($d, '011', 3) === 0 && strlen($d) === 11) {
        return '(+54) 9 11 ' . substr($d, 3, 4) . ' ' . substr($d, 7);
    }
    if ((strncmp($d, '11', 2) === 0 || strncmp($d, '15', 2) === 0) && strlen($d) === 10) {
        return '(+54) 9 11 ' . substr($d, 2, 4) . ' ' . substr($d, 6);
    }
    if (strncmp($d, '34', 2) === 0 && strlen($d) === 11) {
        return '(+34) ' . substr($d, 2, 3) . ' ' . substr($d, 5, 2) . ' ' . substr($d, 7, 2) . ' ' . substr($d, 9);
    }
    if (strlen($d) === 9 && in_array($d[0], ['6', '7', '8', '9'], true)) {
        return '(+34) ' . substr($d, 0, 3) . ' ' . substr($d, 3, 2) . ' ' . substr($d, 5, 2) . ' ' . substr($d, 7);
    }
    if (strncmp($d, '598', 3) === 0 && strlen($d) >= 11) {
        $rest = substr($d, 3);
        return '(+598) ' . substr($rest, 0, 2) . ' ' . substr($rest, 2, 3) . ' ' . substr($rest, 5);
    }
    if (strncmp($d, '56', 2) === 0 && strlen($d) >= 11) {
        $rest = substr($d, 2);
        return '(+56) ' . substr($rest, 0, 1) . ' ' . substr($rest, 1, 4) . ' ' . substr($rest, 5);
    }
    if (strncmp($d, '1', 1) === 0 && strlen($d) === 11) {
        return '(+1) ' . substr($d, 1, 3) . ' ' . substr($d, 4, 3) . ' ' . substr($d, 7);
    }
    return '+' . $d;
}

/** Números conocidos (dígitos exactos => nombre). Ampliable con cfg()['interacciones_known_numbers']. */
function interacciones_known_names(): array
{
    $known = ['34658444935' => 'Martín Brude'];
    if (function_exists('cfg')) {
        $extra = cfg()['interacciones_known_numbers'] ?? [];
        if (is_array($extra)) {
            foreach ($extra as $num => $name) {
                $digits = interacciones_clean_wa_id((string) $num);
                if ($digits !== '' && is_string($name) && $name !== '') {
                    $known[$digits] = $name;
                }
            }
        }
    }
    return $known;
}

function interacciones_known_name(string $waId): string
{
    $d = ltrim(interacciones_clean_wa_id($waId), '0');
    return interacciones_known_names()[$d] ?? '';
}

/**
 * Clave de cruce teléfono WhatsApp ↔ directorio de pacientes (últimos 10 dígitos).
 * Usa clean_phone_number cuando está disponible para unificar 15… / 11… / 549….
 */
function interacciones_phone_match_key(string $raw): string
{
    $digits = '';
    if (function_exists('clean_phone_number')) {
        $digits = clean_phone_number($raw);
    }
    if ($digits === '') {
        $digits = interacciones_clean_wa_id($raw);
    }
    if ($digits === '') {
        return '';
    }
    $end = substr($digits, -10);
    return strlen($end) >= 8 ? $end : $digits;
}

/**
 * Resuelve nombres del directorio de pacientes por teléfono (match por últimos 10 dígitos).
 *
 * @param list<string> $waIds
 * @return array<string,string> match_key => nombre_completo
 */
function interacciones_lookup_directory_names(PDO $pdo, array $waIds): array
{
    $out = [];
    $ends = [];
    foreach ($waIds as $wa) {
        $key = interacciones_phone_match_key((string) $wa);
        if ($key !== '') {
            $ends[$key] = true;
        }
    }
    if (!$ends) {
        return $out;
    }
    try {
        if (function_exists('ensure_pacientes_tables')) {
            ensure_pacientes_tables($pdo);
        }
        // Match en PHP (clean_phone_number unifica 15…/11…/549…). El directorio es chico.
        $stmt = $pdo->query(
            "SELECT telefono, nombre_completo FROM pacientes
             WHERE telefono IS NOT NULL AND telefono != ''
               AND nombre_completo IS NOT NULL AND TRIM(nombre_completo) != ''
             LIMIT 5000"
        );
        if ($stmt === false) {
            return $out;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = interacciones_phone_match_key((string) ($row['telefono'] ?? ''));
            $name = trim((string) ($row['nombre_completo'] ?? ''));
            if ($key !== '' && $name !== '' && isset($ends[$key]) && !isset($out[$key])) {
                $out[$key] = mb_substr($name, 0, 120, 'UTF-8');
            }
        }
    } catch (Throwable $e) {
        // Directorio opcional: no bloquear la vista de interacciones.
    }
    return $out;
}

/**
 * Fallback: nombre desde recordatorios enviados (mismo teléfono, últimos días).
 *
 * @param list<string> $waIds
 * @return array<string,string> match_key => patient_name
 */
function interacciones_lookup_recordatorio_names(PDO $pdo, array $waIds): array
{
    $out = [];
    $ends = [];
    foreach ($waIds as $wa) {
        $key = interacciones_phone_match_key((string) $wa);
        if ($key !== '') {
            $ends[$key] = true;
        }
    }
    if (!$ends) {
        return $out;
    }
    try {
        $exists = $pdo->query("SHOW TABLES LIKE 'recordatorio_eventos'");
        if (!$exists || !$exists->fetchColumn()) {
            return $out;
        }
        $stmt = $pdo->query(
            "SELECT wa_id, patient_name FROM recordatorio_eventos
             WHERE wa_id IS NOT NULL AND wa_id != ''
               AND patient_name IS NOT NULL AND TRIM(patient_name) != ''
               AND status IN ('sent', 'sent_email', 'pending', 'failed', 'missing_phone')
             ORDER BY id DESC
             LIMIT 2000"
        );
        if ($stmt === false) {
            return $out;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = interacciones_phone_match_key((string) ($row['wa_id'] ?? ''));
            $name = trim((string) ($row['patient_name'] ?? ''));
            if ($key !== '' && $name !== '' && isset($ends[$key]) && !isset($out[$key])) {
                $out[$key] = mb_substr($name, 0, 120, 'UTF-8');
            }
        }
    } catch (Throwable $e) {
        // Recordatorios opcionales.
    }
    return $out;
}

