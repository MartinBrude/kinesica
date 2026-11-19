<?php
declare(strict_types=1);

/**
 * Match de paciente para turnos de campaña (policy campana).
 */

/**
 * @param array<string,mixed> $row
 * @return array{id:int,nombre:string,apellido:string,viene_de_campana:bool}
 */
function campana_paciente_row(array $row): array
{
    $nombre = trim((string) ($row['nombre'] ?? ''));
    $apellido = trim((string) ($row['apellido'] ?? ''));
    if ($nombre === '' && $apellido === '') {
        $split = campana_split_name((string) ($row['nombre_completo'] ?? ''));
        $nombre = $split['nombre'];
        $apellido = $split['apellido'];
    }
    $flag = array_key_exists('viene_de_campana', $row)
        ? ((int) $row['viene_de_campana'] !== 0)
        : false;

    return [
        'id' => (int) $row['id'],
        'nombre' => $nombre,
        'apellido' => $apellido,
        'viene_de_campana' => $flag,
    ];
}

/**
 * @return array{id:?int,nombre:string,apellido:string,viene_de_campana:bool}|null
 */
function campana_match_paciente(PDO $pdo, string $phone, string $patientName, string $dni = ''): ?array
{
    require_once __DIR__ . '/pacientes_helpers_match.php';

    $dni = clean_patient_dni($dni);
    $cleanedName = campana_clean_name_string($patientName);
    $nameToMatch = $cleanedName !== '' ? $cleanedName : $patientName;
    $cleanPhone = clean_phone_number($phone);
    $phoneForMatch = ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)) ? $phone : null;

    $existing = kinesica_match_patient($pdo, [
        // Raw phone: el motor limpia una sola vez.
        'phone' => $phoneForMatch,
        'name' => $nameToMatch,
        'dni' => $dni !== '' ? $dni : null,
        // Fallback histórico: scan con nombre crudo (permite 1 token).
        'name_fallback' => $patientName,
    ], 'campana');

    return $existing ? campana_paciente_row($existing) : null;
}
