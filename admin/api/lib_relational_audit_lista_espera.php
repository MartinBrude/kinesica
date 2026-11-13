<?php
declare(strict_types=1);


/**
 * @return array<string,mixed>
 */
function kinesica_audit_lista_espera(PDO $pdo, bool $fullPii): array
{
    if (!kinesica_migrations_table_exists($pdo, 'lista_espera')) {
        return ['total' => 0, 'error' => 'tabla lista_espera ausente'];
    }

    $pacientes = [];
    if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
        $pacientes = $pdo->query('SELECT id, telefono, nombre_completo FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    $phoneToPatients = [];
    foreach ($pacientes as $p) {
        $tel = clean_phone_number((string) ($p['telefono'] ?? ''));
        if ($tel !== '') {
            $phoneToPatients[$tel][] = $p;
        }
    }

    $rows = $pdo->query('SELECT * FROM lista_espera')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $allowed = kinesica_audit_lista_espera_estados();
    $noPatient = [];
    $badEstado = [];
    $activeByPhone = [];
    $nameConflict = [];

    $hasPacienteId = kinesica_migrations_column_exists($pdo, 'lista_espera', 'paciente_id');

    foreach ($rows as $row) {
        $id = (int) ($row['id'] ?? 0);
        $telRaw = (string) ($row['paciente_telefono'] ?? '');
        $tel = clean_phone_number($telRaw);
        $nombre = trim((string) ($row['paciente_nombre'] ?? ''));
        $estado = strtolower(trim((string) ($row['estado'] ?? '')));
        $pid = $hasPacienteId && isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
            ? (int) $row['paciente_id']
            : null;

        if (!in_array($estado, $allowed, true)) {
            $badEstado[] = ['id' => $id, 'estado' => $estado];
        }

        $matched = false;
        if ($pid) {
            $matched = true;
        } elseif ($tel !== '' && isset($phoneToPatients[$tel])) {
            $matched = true;
            $names = array_unique(array_map(
                static fn ($p) => canonical_patient_name_key((string) ($p['nombre_completo'] ?? '')),
                $phoneToPatients[$tel]
            ));
            $entryKey = canonical_patient_name_key($nombre);
            if ($entryKey !== '' && $names !== [] && !in_array($entryKey, $names, true)) {
                $nameConflict[] = [
                    'lista_id' => $id,
                    'telefono' => $fullPii ? $tel : kinesica_audit_mask_phone($tel),
                    'nombre_lista' => $nombre,
                    'nombres_pacientes' => array_map(
                        static fn ($p) => (string) ($p['nombre_completo'] ?? ''),
                        $phoneToPatients[$tel]
                    ),
                ];
            }
        } else {
            $noPatient[] = [
                'id' => $id,
                'telefono' => $fullPii ? $telRaw : kinesica_audit_mask_phone($telRaw),
                'nombre' => $nombre,
                'estado' => $estado,
            ];
        }

        if (in_array($estado, ['activa', 'notificado', 'contactado'], true) && $tel !== '') {
            $activeByPhone[$tel][] = ['id' => $id, 'nombre' => $nombre, 'estado' => $estado];
        }
    }

    $activeDups = [];
    foreach ($activeByPhone as $tel => $group) {
        if (count($group) < 2) {
            continue;
        }
        $telStr = (string) $tel;
        $activeDups[] = [
            'telefono' => $fullPii ? $telStr : kinesica_audit_mask_phone($telStr),
            'count' => count($group),
            'entries' => $group,
        ];
    }

    return [
        'total' => count($rows),
        'without_patient' => $noPatient,
        'invalid_estado' => $badEstado,
        'active_duplicates_by_phone' => $activeDups,
        'name_conflicts_vs_paciente' => $nameConflict,
        'counts' => [
            'without_patient' => count($noPatient),
            'invalid_estado' => count($badEstado),
            'active_duplicates_by_phone' => count($activeDups),
            'name_conflicts_vs_paciente' => count($nameConflict),
        ],
    ];
}

/**
 * @return array<string,mixed>
 */
