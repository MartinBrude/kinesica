<?php
declare(strict_types=1);


/**
 * @param list<array<string,mixed>> $appointments
 * @return list<array<string,mixed>>
 */
function campana_build_rows(PDO $pdo, array $appointments): array
{
    $rows = [];
    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $title = trim((string) ($appt['title'] ?? ''));
        $patientName = trim((string) ($appt['patientName'] ?? ''));
        if ($patientName === '' && $title !== '') {
            $patientName = $title;
        }
        if ($patientName === '' || is_tk3_or_blocked_name($patientName) || is_tk3_or_blocked_name($title)) {
            continue;
        }

        $date = trim((string) ($appt['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            continue;
        }

        $description = (string) ($appt['description'] ?? '');
        $parsed = kinesica_extract_calendar_contacts($title . ' ' . $patientName, $description);
        $phone = clean_phone_number((string) ($appt['phone'] ?? ''));
        if ($phone === '' || is_placeholder_phone($phone)) {
            $phone = $parsed['phone'];
        }
        $dni = clean_patient_dni((string) ($appt['dni'] ?? ''));
        if ($dni === '') {
            $dni = $parsed['dni'];
        }
        $matched = campana_match_paciente($pdo, $phone, $patientName, $dni);
        $split = campana_split_name($patientName);

        $rows[] = [
            'paciente_id' => $matched['id'] ?? null,
            'nombre' => $matched['nombre'] ?? $split['nombre'],
            'apellido' => $matched['apellido'] ?? $split['apellido'],
            'fecha' => $date,
            'viene_de_campana' => $matched['viene_de_campana'] ?? true,
            'calendar_event_id' => (string) ($appt['eventId'] ?? ''),
            'telefono' => $phone,
            'dni' => $dni,
            'patient_name_raw' => $patientName,
        ];
    }

    usort($rows, static function (array $a, array $b): int {
        $cmp = strcmp((string) $a['fecha'], (string) $b['fecha']);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strcmp(
            mb_strtolower(trim($a['apellido'] . ' ' . $a['nombre']), 'UTF-8'),
            mb_strtolower(trim($b['apellido'] . ' ' . $b['nombre']), 'UTF-8')
        );
    });

    return $rows;
}

/**
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */

/**
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */
function campana_unique_persons(array $rows): array
{
    $byKey = [];
    foreach ($rows as $row) {
        $pid = $row['paciente_id'] ?? null;
        if ($pid) {
            $key = 'id:' . (int) $pid;
        } else {
            $phone = clean_phone_number((string) ($row['telefono'] ?? ''));
            if ($phone !== '' && !is_placeholder_phone($phone)) {
                $key = 'tel:' . $phone;
            } else {
                $nameKey = canonical_patient_name_key(
                    trim((string) ($row['patient_name_raw'] ?? ($row['nombre'] . ' ' . $row['apellido'])))
                );
                if ($nameKey === '') {
                    $nameKey = 'row:' . md5(json_encode($row) ?: uniqid('', true));
                }
                $key = 'name:' . $nameKey;
            }
        }

        if (!isset($byKey[$key])) {
            $byKey[$key] = $row;
            continue;
        }
        if (strcmp((string) $row['fecha'], (string) $byKey[$key]['fecha']) < 0) {
            $kept = $byKey[$key];
            $kept['fecha'] = $row['fecha'];
            $kept['calendar_event_id'] = $row['calendar_event_id'];
            $byKey[$key] = $kept;
        }
    }

    $out = array_values($byKey);
    usort($out, static function (array $a, array $b): int {
        $cmp = strcmp((string) $a['fecha'], (string) $b['fecha']);
        if ($cmp !== 0) {
            return $cmp;
        }
        return strcmp(
            mb_strtolower(trim($a['apellido'] . ' ' . $a['nombre']), 'UTF-8'),
            mb_strtolower(trim($b['apellido'] . ' ' . $b['nombre']), 'UTF-8')
        );
    });
    return $out;
}

/**
 * Crea o actualiza un paciente mínimo y setea viene_de_campana.
 *
 * @return array{id:int,viene_de_campana:int}
 */
