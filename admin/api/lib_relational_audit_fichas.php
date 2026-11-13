<?php
declare(strict_types=1);


/**
 * @return array<string,mixed>
 */
function kinesica_audit_fichas(PDO $pdo, bool $fullPii): array
{
    if (!kinesica_migrations_table_exists($pdo, 'fichas')) {
        return ['total' => 0, 'error' => 'tabla fichas ausente'];
    }

    $users = [];
    if (kinesica_migrations_table_exists($pdo, 'users')) {
        try {
            $urows = $pdo->query('SELECT username, active FROM users')->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($urows as $u) {
                $users[(string) $u['username']] = (int) ($u['active'] ?? 1) === 1;
            }
        } catch (Throwable) {
        }
    }

    $pacientes = [];
    if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
        $pacientes = $pdo->query('SELECT * FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    $byDni = [];
    $byPhone = [];
    foreach ($pacientes as $p) {
        $d = clean_patient_dni($p['dni'] ?? null);
        if ($d !== '') {
            $byDni[$d][] = $p;
        }
        $tel = clean_phone_number((string) ($p['telefono'] ?? ''));
        if ($tel !== '' && !is_placeholder_phone((string) ($p['telefono'] ?? ''))) {
            $byPhone[$tel][] = $p;
        }
    }

    $rows = $pdo->query('SELECT * FROM fichas')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $invalidJson = [];
    $noPatient = [];
    $dniConflict = [];
    $profUnknown = [];
    $profInactive = [];
    $dupByPatientDate = [];
    $missingFoto = [];
    $byPatientDate = [];
    $hasPacienteIdCol = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');

    $uploadsRoot = dirname(__DIR__) . '/uploads';

    foreach ($rows as $row) {
        $id = (string) ($row['id'] ?? '');
        $payload = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) {
            $invalidJson[] = ['ficha_id' => $id];
            continue;
        }
        $nombre = sanitize_patient_name((string) ($payload['nombre'] ?? ''));
        $dni = clean_patient_dni($payload['dni'] ?? null);
        $fecha = trim((string) ($payload['fecha'] ?? $payload['date'] ?? $row['updated_at'] ?? ''));
        $prof = strtolower(trim((string) ($row['profesional'] ?? $payload['profesional'] ?? '')));
        $pacienteId = $hasPacienteIdCol && isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
            ? (int) $row['paciente_id']
            : null;

        $matched = [];
        if ($pacienteId) {
            foreach ($pacientes as $p) {
                if ((int) $p['id'] === $pacienteId) {
                    $matched[] = $p;
                }
            }
        }
        if ($matched === [] && $dni !== '' && isset($byDni[$dni])) {
            $matched = $byDni[$dni];
        }
        // Teléfono rara vez está en ficha; si hay campo contacto se ignora aquí.

        if ($matched === []) {
            $noPatient[] = [
                'ficha_id' => $id,
                'nombre' => $nombre,
                'dni' => $fullPii ? $dni : ($dni === '' ? '' : '***' . substr($dni, -3)),
                'profesional' => $prof,
                'paciente_id' => $pacienteId,
            ];
        } elseif (count($matched) > 1) {
            $dniConflict[] = [
                'ficha_id' => $id,
                'dni' => $fullPii ? $dni : '***' . substr($dni, -3),
                'matches' => array_map(static fn ($p) => kinesica_audit_patient_ref($p, $fullPii), $matched),
                'clasificacion' => 'conflicto_dni_multiple',
            ];
        }

        if ($prof !== '' && $users !== []) {
            if (!array_key_exists($prof, $users) && !in_array($prof, ['norberto', 'maria', 'indistinto'], true)) {
                $profUnknown[] = ['ficha_id' => $id, 'profesional' => $prof];
            } elseif (isset($users[$prof]) && $users[$prof] === false) {
                $profInactive[] = ['ficha_id' => $id, 'profesional' => $prof];
            }
        }

        $matchId = $matched !== [] ? (int) $matched[0]['id'] : ('dni:' . $dni . '|name:' . canonical_patient_name_key($nombre));
        $dateKey = $fecha !== '' ? substr($fecha, 0, 10) : 'sin-fecha';
        $byPatientDate[$matchId . '|' . $dateKey][] = $id;

        $photos = function_exists('kinesica_extract_ficha_photos') ? kinesica_extract_ficha_photos($payload) : [];
        if (empty($photos)) {
            $foto = trim((string) ($payload['fotoUrl'] ?? $payload['foto'] ?? ''));
            if ($foto !== '' && !preg_match('#^https?://#i', $foto)) {
                $matched = preg_match('/file=([a-f0-9]{32,64}\.(jpe?g|png|webp))$/i', $foto, $m);
                $photos = [$matched ? $m[1] : basename($foto)];
            }
        }
        foreach ($photos as $fName) {
            $found = function_exists('kinesica_find_upload_file')
                ? (kinesica_find_upload_file($fName) !== null)
                : is_file($uploadsRoot . '/' . $fName);
            if (!$found) {
                $missingFoto[] = ['ficha_id' => $id, 'foto' => $fName];
            }
        }
    }

    foreach ($byPatientDate as $key => $ids) {
        if (count($ids) < 2) {
            continue;
        }
        $dupByPatientDate[] = [
            'key' => $key,
            'ficha_ids' => $ids,
            'count' => count($ids),
            'clasificacion' => 'posible_duplicado_paciente_fecha',
        ];
    }

    return [
        'total' => count($rows),
        'invalid_json' => $invalidJson,
        'without_patient_match' => $noPatient,
        'dni_multiple_patients' => $dniConflict,
        'profesional_unknown' => $profUnknown,
        'profesional_inactive' => $profInactive,
        'duplicate_patient_date' => $dupByPatientDate,
        'missing_foto_file' => $missingFoto,
        'counts' => [
            'invalid_json' => count($invalidJson),
            'without_patient_match' => count($noPatient),
            'dni_multiple_patients' => count($dniConflict),
            'profesional_unknown' => count($profUnknown),
            'profesional_inactive' => count($profInactive),
            'duplicate_patient_date' => count($dupByPatientDate),
            'missing_foto_file' => count($missingFoto),
        ],
    ];
}

/**
 * @return array<string,mixed>
 */
