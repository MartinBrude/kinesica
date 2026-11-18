<?php
declare(strict_types=1);

/**
 * Match de paciente para turnos de campaña (tel exacto / sufijo único / nombre canónico).
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
        : true;

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
    require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';

    $phone = clean_phone_number($phone);
    $dni = clean_patient_dni($dni);
    $cleanedName = campana_clean_name_string($patientName);
    $nameToMatch = $cleanedName !== '' ? $cleanedName : $patientName;
    if (function_exists('find_existing_patient_match')) {
        $existing = find_existing_patient_match(
            $pdo,
            $phone !== '' && !is_placeholder_phone($phone) ? $phone : null,
            $nameToMatch,
            $dni !== '' ? $dni : null
        );
        if ($existing) {
            return campana_paciente_row($existing);
        }
    }

    $alive = kinesica_pacientes_alive_sql($pdo);
    if ($phone !== '' && !is_placeholder_phone($phone)) {
        $stmt = $pdo->prepare(
            "SELECT id, nombre, apellido, nombre_completo, viene_de_campana
             FROM pacientes
             WHERE telefono = :tel AND ({$alive})
             LIMIT 1"
        );
        $stmt->execute(['tel' => $phone]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            return campana_paciente_row($row);
        }
        // Sufijo de 8 solo si es único (mismo criterio que email_by_phone).
        $suffix = substr($phone, -8);
        if (strlen($suffix) >= 8) {
            $stmt = $pdo->prepare(
                "SELECT id, nombre, apellido, nombre_completo, viene_de_campana
                 FROM pacientes
                 WHERE ({$alive}) AND telefono LIKE :tel_end
                 LIMIT 2"
            );
            $stmt->execute(['tel_end' => '%' . $suffix]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            if (count($rows) === 1) {
                return campana_paciente_row($rows[0]);
            }
        }
    }

    $nameKey = canonical_patient_name_key($patientName);
    if ($nameKey === '') {
        return null;
    }

    $stmt = $pdo->query(
        "SELECT id, nombre, apellido, nombre_completo, viene_de_campana FROM pacientes WHERE ({$alive})"
    );
    if (!$stmt) {
        return null;
    }
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cand = canonical_patient_name_key((string) ($row['nombre_completo'] ?? ''));
        if ($cand !== '' && $cand === $nameKey) {
            return campana_paciente_row($row);
        }
        $alt = canonical_patient_name_key(trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? '')));
        if ($alt !== '' && $alt === $nameKey) {
            return campana_paciente_row($row);
        }
    }
    return null;
}
