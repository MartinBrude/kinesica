<?php
declare(strict_types=1);


function find_existing_patient_match(PDO $pdo, ?string $phone, ?string $name = null, ?string $dni = null): ?array
{
    // 1. Teléfono real
    $cleanPhone = clean_phone_number((string) ($phone ?? ''));
    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)) {
        $stmt = $pdo->prepare('SELECT * FROM pacientes WHERE telefono = :tel LIMIT 1');
        $stmt->execute(['tel' => $cleanPhone]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 2. DNI limpio o placeholder de DNI
    $cleanDni = clean_patient_dni($dni);
    if ($cleanDni !== '') {
        $stmt = $pdo->prepare('
            SELECT * FROM pacientes 
            WHERE dni = :dni 
               OR REPLACE(REPLACE(COALESCE(dni, ""), ".", ""), " ", "") = :clean
               OR telefono = :telDni
            LIMIT 1
        ');
        $stmt->execute(['dni' => $cleanDni, 'clean' => $cleanDni, 'telDni' => 'sin-tel-dni-' . $cleanDni]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 3. Clave canónica de nombre (si tiene al menos 2 tokens)
    if ($name !== null && trim($name) !== '') {
        $nameKey = canonical_patient_name_key($name);
        if ($nameKey !== '' && str_contains($nameKey, ' ')) {
            // PDO nativo (ATTR_EMULATE_PREPARES=false) no permite reutilizar el mismo :nombre.
            $fullLower = mb_strtolower(trim($name), 'UTF-8');
            $stmt = $pdo->prepare('
                SELECT * FROM pacientes 
                WHERE LOWER(nombre_completo) = :full1
                   OR LOWER(TRIM(CONCAT(nombre, " ", apellido))) = :full2
                   OR LOWER(TRIM(CONCAT(apellido, " ", nombre))) = :full3
                LIMIT 1
            ');
            $stmt->execute(['full1' => $fullLower, 'full2' => $fullLower, 'full3' => $fullLower]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) return $row;

            $stmtAll = $pdo->query('SELECT id, nombre, apellido, nombre_completo FROM pacientes');
            if ($stmtAll) {
                while ($cand = $stmtAll->fetch(PDO::FETCH_ASSOC)) {
                    $candFull = trim(($cand['nombre_completo'] ?? '') ?: (($cand['nombre'] ?? '') . ' ' . ($cand['apellido'] ?? '')));
                    if (canonical_patient_name_key($candFull) === $nameKey) {
                        // Traer la fila completa: el scan liviano omite email/notas/contacto
                        // y un UPDATE posterior los pisaba con null.
                        $fullStmt = $pdo->prepare('SELECT * FROM pacientes WHERE id = :id LIMIT 1');
                        $fullStmt->execute(['id' => (int) $cand['id']]);
                        $full = $fullStmt->fetch(PDO::FETCH_ASSOC);
                        return is_array($full) ? $full : $cand;
                    }
                }
            }
        }
    }

    return null;
}

/**
 * Resuelve qué teléfono conservar al unificar/actualizar.
 * Si el admin acaba de cargar un WhatsApp nuevo y el match fue por nombre/DNI,
 * ese número gana (salvo colisión con otro paciente).
 */

/**
 * Resuelve qué teléfono conservar al unificar/actualizar.
 * Si el admin acaba de cargar un WhatsApp nuevo y el match fue por nombre/DNI,
 * ese número gana (salvo colisión con otro paciente).
 */
function kinesica_resolve_merge_phone(PDO $pdo, array $existing, string $newPhone): string
{
    $existingTel = trim((string) ($existing['telefono'] ?? ''));
    $existingClean = clean_phone_number($existingTel);
    $newClean = clean_phone_number($newPhone);

    if ($newClean === '') {
        return $existingTel !== '' ? $existingTel : $newPhone;
    }
    if (is_placeholder_phone($existingTel) || $existingClean === '' || $existingClean === $newClean) {
        return $newClean;
    }

    try {
        $stmt = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel AND id != :id LIMIT 1');
        $stmt->execute(['tel' => $newClean, 'id' => (int) ($existing['id'] ?? 0)]);
        if ($stmt->fetch()) {
            return $existingTel; // el nuevo ya pertenece a otro
        }
    } catch (Throwable) {
        return $existingTel;
    }
    return $newClean;
}

/**
 * Homónimos con WhatsApp reales distintos no se unen solo por nombre.
 */

/**
 * Homónimos con WhatsApp reales distintos no se unen solo por nombre.
 */
function kinesica_phones_compatible_for_name_merge(string $phoneA, string $phoneB): bool
{
    $aClean = clean_phone_number($phoneA);
    $bClean = clean_phone_number($phoneB);
    $aReal = $aClean !== '' && !is_placeholder_phone($phoneA) && !is_placeholder_phone($aClean);
    $bReal = $bClean !== '' && !is_placeholder_phone($phoneB) && !is_placeholder_phone($bClean);
    if ($aReal && $bReal && $aClean !== $bClean) {
        return false;
    }
    return true;
}


function deduplicate_pacientes_table(PDO $pdo): int
{
    try {
        $stmt = $pdo->query('SELECT * FROM pacientes ORDER BY id ASC');
        if (!$stmt) return 0;
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (count($rows) <= 1) return 0;

        $n = count($rows);
        $parent = range(0, $n - 1);
        $find = function (int $i) use (&$parent, &$find): int {
            if ($parent[$i] === $i) return $i;
            return $parent[$i] = $find($parent[$i]);
        };
        $union = function (int $i, int $j) use (&$parent, &$find): void {
            $rootI = $find($i);
            $rootJ = $find($j);
            if ($rootI !== $rootJ) {
                $parent[$rootI] = $rootJ;
            }
        };

        $byDni = [];
        $byName = [];
        $byPhone = [];

        foreach ($rows as $idx => $r) {
            $dni = clean_patient_dni($r['dni'] ?? null);
            if ($dni === '' && str_starts_with((string) ($r['telefono'] ?? ''), 'sin-tel-dni-')) {
                $dni = substr((string) $r['telefono'], 12);
            }
            if ($dni !== '') {
                if (isset($byDni[$dni])) $union($idx, $byDni[$dni]);
                else $byDni[$dni] = $idx;
            }

            $rawPhone = (string) ($r['telefono'] ?? '');
            $cleanPhone = clean_phone_number($rawPhone);
            if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone) && !is_placeholder_phone($rawPhone)) {
                if (isset($byPhone[$cleanPhone])) $union($idx, $byPhone[$cleanPhone]);
                else $byPhone[$cleanPhone] = $idx;
            }

            $full = trim(($r['nombre_completo'] ?? '') ?: (($r['nombre'] ?? '') . ' ' . ($r['apellido'] ?? '')));
            $nameKey = canonical_patient_name_key($full);
            // Nombre solo une si no hay dos WhatsApp reales distintos (homónimos).
            if ($nameKey !== '' && str_contains($nameKey, ' ')) {
                if (isset($byName[$nameKey])) {
                    $otherIdx = $byName[$nameKey];
                    if (kinesica_phones_compatible_for_name_merge(
                        (string) ($rows[$otherIdx]['telefono'] ?? ''),
                        $rawPhone
                    )) {
                        $union($idx, $otherIdx);
                    }
                } else {
                    $byName[$nameKey] = $idx;
                }
            }
        }

        $clusters = [];
        for ($i = 0; $i < $n; $i++) {
            $root = $find($i);
            $clusters[$root][] = $rows[$i];
        }

        return kinesica_pacientes_dedup_apply_clusters($pdo, $clusters);
    } catch (Throwable $e) {
        error_log('deduplicate_pacientes_table error: ' . $e->getMessage());
        return 0;
    }
}

/**
 * Infiere el profesional asignado ('norberto' o 'maria') según el día y horario del turno,
 * el correo del creador del evento o metadatos del calendario.
 * Retorna 'indistinto' si no puede ser determinado con certeza.
 *
 * Restricciones físicas del consultorio:
 * - 1 sola camilla física (jamás hay turnos solapados de ambos profesionales).
 * - Miércoles: Norberto exclusivo (09:00 a 16:30). María no atiende.
 * - Jueves: Norberto exclusivo (15:00 a 19:00). María no atiende.
 * - Lunes: María de 09:00 a 17:00 | Norberto de 17:30 a 19:30.
 * - Martes: María de 09:00 a 16:00 | Norberto de 16:30 a 19:30.
 * - Viernes: María de 09:00 a 13:00 | Norberto de 13:30 a 19:30.
 */
