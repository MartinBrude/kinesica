<?php
declare(strict_types=1);


/**
 * @return array<string,mixed>
 */
function kinesica_audit_pacientes(PDO $pdo, bool $fullPii): array
{
    if (!kinesica_migrations_table_exists($pdo, 'pacientes')) {
        return ['total' => 0, 'error' => 'tabla pacientes ausente'];
    }

    $rows = $pdo->query('SELECT * FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $byNormPhone = [];
    $byDni = [];
    $byEmail = [];
    $byNameKey = [];
    $emptyName = [];
    $testName = [];
    $invalidPhone = [];
    $placeholderPhone = [];
    $noReliableId = [];
    $nameMismatch = [];

    foreach ($rows as $row) {
        $id = (int) $row['id'];
        $full = trim((string) ($row['nombre_completo'] ?? ''));
        $nombre = trim((string) ($row['nombre'] ?? ''));
        $apellido = trim((string) ($row['apellido'] ?? ''));
        $telRaw = (string) ($row['telefono'] ?? '');
        $telNorm = clean_phone_number($telRaw);
        $dni = clean_patient_dni($row['dni'] ?? null);
        $email = mb_strtolower(trim((string) ($row['email'] ?? '')), 'UTF-8');
        $nameKey = canonical_patient_name_key($full !== '' ? $full : ($nombre . ' ' . $apellido));

        if ($full === '' && $nombre === '' && $apellido === '') {
            $emptyName[] = kinesica_audit_patient_ref($row, $fullPii);
        } elseif (kinesica_audit_is_test_name($full !== '' ? $full : ($nombre . ' ' . $apellido))) {
            $testName[] = kinesica_audit_patient_ref($row, $fullPii);
        }

        if (is_placeholder_phone($telRaw)) {
            $placeholderPhone[] = kinesica_audit_patient_ref($row, $fullPii) + ['telefono_raw_kind' => 'placeholder'];
        } elseif ($telNorm === '') {
            $invalidPhone[] = kinesica_audit_patient_ref($row, $fullPii);
        } else {
            $byNormPhone[$telNorm][] = $row;
        }

        if ($dni !== '') {
            $byDni[$dni][] = $row;
        }
        if ($email !== '' && str_contains($email, '@')) {
            $byEmail[$email][] = $row;
        }
        if ($nameKey !== '') {
            $byNameKey[$nameKey][] = $row;
        }

        $derived = trim($nombre . ' ' . $apellido);
        if ($full !== '' && $nombre !== '' && $apellido !== '') {
            $fullKey = canonical_patient_name_key($full);
            $derKey = canonical_patient_name_key($derived);
            if ($fullKey !== '' && $derKey !== '' && $fullKey !== $derKey) {
                $nameMismatch[] = kinesica_audit_patient_ref($row, $fullPii) + [
                    'nombre' => $nombre,
                    'apellido' => $apellido,
                ];
            }
        }

        $hasPhone = $telNorm !== '' && !is_placeholder_phone($telRaw);
        $hasDni = $dni !== '';
        $hasEmail = $email !== '' && str_contains($email, '@');
        if (!$hasPhone && !$hasDni && !$hasEmail) {
            $noReliableId[] = kinesica_audit_patient_ref($row, $fullPii);
        }
    }

    $dupPhones = [];
    $sharedPhones = [];
    foreach ($byNormPhone as $norm => $group) {
        if (count($group) < 2) {
            continue;
        }
        $normStr = (string) $norm;
        $refs = array_map(static fn ($r) => kinesica_audit_patient_ref($r, $fullPii), $group);
        $names = array_unique(array_map(
            static fn ($r) => canonical_patient_name_key((string) ($r['nombre_completo'] ?? '')),
            $group
        ));
        $entry = [
            'telefono_normalizado' => $fullPii ? $normStr : kinesica_audit_mask_phone($normStr),
            'count' => count($group),
            'pacientes' => $refs,
            'nombres_distintos' => count(array_filter($names)) > 1,
        ];
        // Mismo teléfono + mismo nombre canónico → candidato fusión; nombres distintos → compartido / revisión.
        if (count(array_filter($names)) <= 1) {
            $dupPhones[] = $entry + ['clasificacion' => 'candidato_fusion', 'auto_merge' => false];
        } else {
            $sharedPhones[] = $entry + ['clasificacion' => 'telefono_compartido', 'auto_merge' => false];
        }
    }

    $dupDni = [];
    foreach ($byDni as $dni => $group) {
        if (count($group) < 2) {
            continue;
        }
        $dniStr = (string) $dni;
        $dupDni[] = [
            'dni' => $fullPii ? $dniStr : (str_repeat('*', max(0, strlen($dniStr) - 3)) . substr($dniStr, -3)),
            'count' => count($group),
            'pacientes' => array_map(static fn ($r) => kinesica_audit_patient_ref($r, $fullPii), $group),
            'clasificacion' => 'bloqueo_revision',
            'auto_merge' => false,
        ];
    }

    $dupEmail = [];
    foreach ($byEmail as $email => $group) {
        if (count($group) < 2) {
            continue;
        }
        $dupEmail[] = [
            'email' => $fullPii ? $email : kinesica_audit_mask_email($email),
            'count' => count($group),
            'pacientes' => array_map(static fn ($r) => kinesica_audit_patient_ref($r, $fullPii), $group),
            'clasificacion' => 'revision',
            'auto_merge' => false,
        ];
    }

    $fusionByName = [];
    foreach ($byNameKey as $key => $group) {
        if (count($group) < 2) {
            continue;
        }
        $phones = [];
        $dnis = [];
        foreach ($group as $r) {
            $p = clean_phone_number((string) ($r['telefono'] ?? ''));
            if ($p !== '' && !is_placeholder_phone((string) ($r['telefono'] ?? ''))) {
                $phones[$p] = true;
            }
            $d = clean_patient_dni($r['dni'] ?? null);
            if ($d !== '') {
                $dnis[$d] = true;
            }
        }
        // Mismo nombre + un solo teléfono o un solo DNI → candidato; varios tel/dni → no fusionar auto.
        $ambiguous = count($phones) > 1 || count($dnis) > 1;
        $fusionByName[] = [
            'name_key' => $key,
            'count' => count($group),
            'pacientes' => array_map(static fn ($r) => kinesica_audit_patient_ref($r, $fullPii), $group),
            'clasificacion' => $ambiguous ? 'no_fusionar_ambiguo' : 'candidato_fusion_nombre',
            'auto_merge' => false,
        ];
    }

    return [
        'total' => count($rows),
        'empty_or_blank_name' => $emptyName,
        'test_or_blocked_name' => $testName,
        'invalid_phone' => $invalidPhone,
        'placeholder_phone' => $placeholderPhone,
        'no_reliable_identifier' => $noReliableId,
        'name_vs_nombre_apellido_mismatch' => $nameMismatch,
        'duplicate_phones_same_name' => $dupPhones,
        'shared_phones_different_names' => $sharedPhones,
        'duplicate_dni' => $dupDni,
        'duplicate_email' => $dupEmail,
        'same_name_groups' => $fusionByName,
        'counts' => [
            'empty_or_blank_name' => count($emptyName),
            'test_or_blocked_name' => count($testName),
            'invalid_phone' => count($invalidPhone),
            'placeholder_phone' => count($placeholderPhone),
            'no_reliable_identifier' => count($noReliableId),
            'name_mismatch' => count($nameMismatch),
            'duplicate_phones_same_name' => count($dupPhones),
            'shared_phones_different_names' => count($sharedPhones),
            'duplicate_dni' => count($dupDni),
            'duplicate_email' => count($dupEmail),
            'same_name_groups' => count($fusionByName),
        ],
    ];
}

/**
 * @return array<string,mixed>
 */
