<?php
declare(strict_types=1);

/**
 * Deduplicación de recordatorios por teléfono (complemento de check_sent por event id).
 * Si se informa patient_name, no suprime a otra persona que comparta el mismo número.
 */

/**
 * @param string|PDO|null $appointmentDateOrPdo
 * @return list<array{digits:string,suffix:string,name:string}>
 */
function recordatorios_fetch_sent_phone_people($appointmentDateOrPdo = null, ?PDO $pdo = null): array
{
    $apptDate = null;
    if ($appointmentDateOrPdo instanceof PDO) {
        $pdo = $appointmentDateOrPdo;
    } elseif (is_string($appointmentDateOrPdo)) {
        $apptDate = trim($appointmentDateOrPdo);
    }
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);

    $tz = function_exists('recordatorios_tz') ? recordatorios_tz() : new DateTimeZone('America/Argentina/Buenos_Aires');
    $todayStr = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
    $params = [
        'todayStart' => $todayStr . ' 00:00:00',
        'todayEnd' => $todayStr . ' 23:59:59',
    ];
    $whereAppt = '';
    if ($apptDate !== null && preg_match('/^\d{4}-\d{2}-\d{2}$/', $apptDate)) {
        $whereAppt = ' OR appointment_date = :apptDate';
        $params['apptDate'] = $apptDate;
    }

    $sql = "SELECT wa_id, patient_name FROM recordatorio_eventos
            WHERE status IN ('sent', 'sent_email')
              AND (
                (run_at >= :todayStart AND run_at <= :todayEnd)
                {$whereAppt}
              )";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $sentRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $people = [];
    foreach ($sentRows as $r) {
        $w = preg_replace('/\D+/', '', (string) ($r['wa_id'] ?? ''));
        if ($w === '') {
            continue;
        }
        $people[] = [
            'digits' => $w,
            'suffix' => strlen($w) >= 8 ? substr($w, -8) : '',
            'name' => trim((string) ($r['patient_name'] ?? '')),
        ];
    }
    return $people;
}

/**
 * @param list<array{digits:string,suffix:string,name:string}> $sentPeople
 */
function recordatorios_phone_matches_sent_people(
    string $phone,
    string $patientName,
    array $sentPeople
): bool {
    $digits = preg_replace('/\D+/', '', $phone);
    if ($digits === '') {
        return false;
    }
    $suffix = strlen($digits) >= 8 ? substr($digits, -8) : '';
    $candidateName = trim($patientName);
    if (!function_exists('kinesica_names_compatible')) {
        require_once __DIR__ . '/pacientes_helpers_canonical_patient_name_key.php';
    }
    foreach ($sentPeople as $person) {
        $phoneHit = ($person['digits'] === $digits)
            || ($suffix !== '' && $person['suffix'] !== '' && $person['suffix'] === $suffix);
        if (!$phoneHit) {
            continue;
        }
        if ($candidateName === '' || $person['name'] === '') {
            return true;
        }
        if (kinesica_names_compatible($candidateName, $person['name'])) {
            return true;
        }
    }
    return false;
}

/**
 * @param list<string> $phones
 * @param string|PDO|null $appointmentDateOrPdo
 * @param array<string,string> $nameByPhone teléfono (tal cual en $phones) => nombre candidato
 * @return array<string,bool>
 */
function recordatorios_check_sent_phones_map(
    array $phones,
    $appointmentDateOrPdo = null,
    ?PDO $pdo = null,
    array $nameByPhone = []
): array {
    $out = [];
    foreach ($phones as $p) {
        $raw = trim((string) $p);
        if ($raw === '') {
            continue;
        }
        $out[$raw] = false;
    }
    if ($out === []) {
        return $out;
    }
    try {
        $sentPeople = recordatorios_fetch_sent_phone_people($appointmentDateOrPdo, $pdo);
        foreach (array_keys($out) as $rawPhone) {
            $nm = trim((string) ($nameByPhone[$rawPhone] ?? ''));
            if (recordatorios_phone_matches_sent_people($rawPhone, $nm, $sentPeople)) {
                $out[$rawPhone] = true;
            }
        }
    } catch (Throwable $e) {
        error_log('kinesica recordatorios check_sent_phones_map: ' . $e->getMessage());
        foreach (array_keys($out) as $k) {
            $out[$k] = true;
        }
    }
    return $out;
}

/**
 * True si este teléfono ya recibió recordatorio para la fecha de turno o hoy.
 * Con $patientName, no cuenta envíos a otra persona con el mismo número.
 */
function recordatorios_was_sent_for_phone(
    string $phone,
    $appointmentDateOrPdo = null,
    ?PDO $pdo = null,
    string $patientName = ''
): bool {
    $phone = trim($phone);
    if ($phone === '') {
        return false;
    }
    try {
        $people = recordatorios_fetch_sent_phone_people($appointmentDateOrPdo, $pdo);
        return recordatorios_phone_matches_sent_people($phone, $patientName, $people);
    } catch (Throwable $e) {
        error_log('kinesica recordatorios was_sent_for_phone: ' . $e->getMessage());
        return true;
    }
}
