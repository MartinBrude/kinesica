<?php
declare(strict_types=1);

function recordatorios_is_appointment_past(?string $apptDate, ?string $apptTime): bool
{
    if (!$apptDate || trim($apptDate) === '') {
        return false;
    }
    $timeStr = '23:59:59';
    if ($apptTime && trim($apptTime) !== '' && preg_match('/(\d{1,2}):(\d{2})/', $apptTime, $m)) {
        $timeStr = sprintf('%02d:%02d:00', (int) $m[1], (int) $m[2]);
    }
    try {
        $tz = recordatorios_tz();
        return (new DateTimeImmutable(trim($apptDate) . ' ' . $timeStr, $tz)) < (new DateTimeImmutable('now', $tz));
    } catch (Throwable) {
        return false;
    }
}

function recordatorios_extract_contact_email(string $errorMessage): string
{
    if (preg_match('/^contact_email:([^\s|]+)/i', trim($errorMessage), $m)) {
        return strtolower(trim($m[1]));
    }
    if (filter_var(trim($errorMessage), FILTER_VALIDATE_EMAIL)) {
        return strtolower(trim($errorMessage));
    }
    return '';
}

/**
 * Completa el mapa de emails con la agenda del staff (`users`: profesionales del admin).
 *
 * @param array{by_phone: array<string,string>, by_name: array<string,string>} $out
 * @return array{by_phone: array<string,string>, by_name: array<string,string>}
 */
function recordatorios_merge_staff_emails(array $out): array
{
    try {
        $pdo = function_exists('db') ? db() : null;
        if (!$pdo instanceof PDO || !$pdo->query("SHOW COLUMNS FROM users LIKE 'email'")->fetch()) {
            return $out;
        }
        $hasTel = (bool) $pdo->query("SHOW COLUMNS FROM users LIKE 'telefono'")->fetch();
        $sql = $hasTel
            ? 'SELECT email, telefono, display_name, first_name, last_name FROM users WHERE email IS NOT NULL AND email != "" LIMIT 200'
            : 'SELECT email, display_name, first_name, last_name FROM users WHERE email IS NOT NULL AND email != "" LIMIT 200';
        $stmt = $pdo->query($sql);
        if (!$stmt) {
            return $out;
        }
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $email = strtolower(trim((string) ($row['email'] ?? '')));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            if ($hasTel) {
                $end = substr(preg_replace('/\D+/', '', (string) ($row['telefono'] ?? '')) ?? '', -10);
                if (strlen($end) >= 8 && !isset($out['by_phone'][$end])) {
                    $out['by_phone'][$end] = $email;
                }
            }
            $full = trim((string) ($row['display_name'] ?? ''));
            $composed = trim((string) ($row['first_name'] ?? '') . ' ' . (string) ($row['last_name'] ?? ''));
            foreach ([$full, $composed] as $name) {
                $key = mb_strtolower(trim($name));
                if ($key !== '' && mb_strlen($key) >= 3 && !isset($out['by_name'][$key])) {
                    $out['by_name'][$key] = $email;
                }
            }
            if ($composed !== '' && mb_stripos($composed, 'brude') !== false) {
                $first = mb_strtolower(trim((string) ($row['first_name'] ?? '')));
                if ($first !== '' && !isset($out['by_name'][$first])) {
                    $out['by_name'][$first] = $email;
                }
            }
        }
    } catch (Throwable $e) {
    }
    return $out;
}

/** Resuelve email de staff/directorio para un wa_id + nombre. */
function recordatorios_resolve_contact_email(string $waId, string $patientName = ''): string
{
    $map = recordatorios_merge_staff_emails(['by_phone' => [], 'by_name' => []]);
    $phoneEnd = substr(recordatorios_clean_wa_id($waId), -10);
    if (strlen($phoneEnd) >= 8 && isset($map['by_phone'][$phoneEnd])) {
        return (string) $map['by_phone'][$phoneEnd];
    }
    $nameKey = mb_strtolower(trim($patientName));
    if ($nameKey !== '' && isset($map['by_name'][$nameKey])) {
        return (string) $map['by_name'][$nameKey];
    }
    return '';
}

/**
 * Busca emails y teléfonos del directorio para enriquecer la vista.
 *
 * @param list<array<string,mixed>> $rows
 * @return array{by_phone: array<string,string>, by_name: array<string,string>, phone_by_name: array<string,string>}
 */
function recordatorios_lookup_directory_contacts(PDO $pdo, array $rows): array
{
    $out = ['by_phone' => [], 'by_name' => [], 'phone_by_name' => []];
    try {
        $phones = [];
        $names = [];
        foreach ($rows as $r) {
            $phoneEnd = substr(recordatorios_clean_wa_id((string) ($r['wa_id'] ?? '')), -10);
            if (strlen($phoneEnd) >= 8) {
                $phones[$phoneEnd] = true;
            }
            $name = trim((string) ($r['patient_name'] ?? ''));
            if ($name !== '' && mb_strlen($name) >= 3) {
                $names[mb_strtolower($name)] = $name;
            }
        }
        if (!$phones && !$names) {
            return recordatorios_merge_staff_emails($out);
        }

        if ($phones) {
            $ends = array_keys($phones);
            $placeholders = implode(',', array_fill(0, count($ends), '?'));
            $stmt = $pdo->prepare(
                "SELECT telefono, email, nombre_completo FROM pacientes
                 WHERE email IS NOT NULL AND email != ''
                   AND RIGHT(REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '+', ''), 10) IN ($placeholders)
                 LIMIT 500"
            );
            $stmt->execute($ends);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $end = substr(preg_replace('/\D+/', '', (string) ($row['telefono'] ?? '')) ?? '', -10);
                $email = strtolower(trim((string) ($row['email'] ?? '')));
                if ($end !== '' && $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $out['by_phone'][$end] = $email;
                }
            }
        }

        if ($names) {
            $conds = [];
            $params = [];
            foreach (array_values($names) as $name) {
                $conds[] = 'LOWER(nombre_completo) = LOWER(?)';
                $params[] = $name;
                $parts = preg_split('/\s+/u', trim($name)) ?: [];
                if (count($parts) >= 2) {
                    $first = $parts[0];
                    $last = end($parts);
                    $conds[] = 'LOWER(nombre_completo) LIKE LOWER(?)';
                    $params[] = '%' . $first . '%' . $last . '%';
                    $conds[] = 'LOWER(nombre_completo) LIKE LOWER(?)';
                    $params[] = '%' . $last . '%' . $first . '%';
                    $conds[] = 'LOWER(TRIM(CONCAT(COALESCE(nombre, ""), " ", COALESCE(apellido, "")))) = LOWER(?)';
                    $params[] = $name;
                    $conds[] = 'LOWER(TRIM(CONCAT(COALESCE(apellido, ""), " ", COALESCE(nombre, "")))) = LOWER(?)';
                    $params[] = $name;
                }
            }
            $stmt = $pdo->prepare('SELECT nombre, apellido, nombre_completo, telefono, email FROM pacientes WHERE ((' . implode(' OR ', $conds) . ')) LIMIT 500');
            $stmt->execute($params);
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $key = mb_strtolower(trim((string) ($row['nombre_completo'] ?? '')));
                $nom = trim((string) ($row['nombre'] ?? ''));
                $ape = trim((string) ($row['apellido'] ?? ''));
                $email = strtolower(trim((string) ($row['email'] ?? '')));
                $emailValid = $email !== '' && (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
                $rawTel = (string) ($row['telefono'] ?? '');
                $tel = function_exists('clean_phone_number') ? clean_phone_number($rawTel) : (string) preg_replace('/\D+/', '', $rawTel);

                $register = static function (string $k) use (&$out, $tel, $email, $emailValid): void {
                    if ($k === '') {
                        return;
                    }
                    if ($tel !== '') {
                        $out['phone_by_name'][$k] = $tel;
                    }
                    if ($emailValid) {
                        $out['by_name'][$k] = $email;
                    }
                };

                $firstLast = mb_strtolower(trim($nom . ' ' . $ape));
                $register($key);
                $register($firstLast);
                $register(mb_strtolower(trim($ape . ' ' . $nom)));
                if (function_exists('canonical_patient_name_key')) {
                    $register(canonical_patient_name_key($key !== '' ? $key : $firstLast));
                }
                $partsApe = preg_split('/\s+/u', $ape) ?: [];
                if (count($partsApe) > 1 && $nom !== '' && $tel !== '') {
                    $out['phone_by_name'][mb_strtolower(trim($nom . ' ' . $partsApe[0]))] = $tel;
                    $out['phone_by_name'][mb_strtolower(trim($partsApe[0] . ' ' . $nom))] = $tel;
                }
            }
        }
    } catch (Throwable $e) {
    }
    return recordatorios_merge_staff_emails($out);
}
