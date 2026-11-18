<?php
declare(strict_types=1);

/**
 * ¿La fila está activa? Soft-deleted (deleted_at seteado) no participa de match/dedupe.
 *
 * @param array<string,mixed> $row
 */
function kinesica_pacientes_row_is_active(array $row): bool
{
    if (!array_key_exists('deleted_at', $row)) {
        return true;
    }
    $v = $row['deleted_at'];
    return $v === null || $v === '';
}

/**
 * Fragmento SQL para excluir soft-deleted si la columna existe.
 */
function kinesica_pacientes_alive_sql(PDO $pdo, string $alias = ''): string
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return '1=1';
    }
    $col = $alias !== '' ? "{$alias}.deleted_at" : 'deleted_at';
    return "{$col} IS NULL";
}

/**
 * Ficha soft-deleted que aún ocupa UNIQUE(telefono).
 * Usado en upsert para revivir en lugar de un ON DUPLICATE "fantasma".
 *
 * @return array<string,mixed>|null
 */
function kinesica_pacientes_find_soft_deleted_by_phone(PDO $pdo, string $phone): ?array
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at')) {
        return null;
    }
    $clean = clean_phone_number($phone);
    if ($clean === '' || is_placeholder_phone($clean)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT * FROM pacientes WHERE telefono = :tel AND deleted_at IS NOT NULL LIMIT 1'
    );
    $stmt->execute(['tel' => $clean]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}


function find_existing_patient_match(PDO $pdo, ?string $phone, ?string $name = null, ?string $dni = null): ?array
{
    $alive = kinesica_pacientes_alive_sql($pdo);

    // 1. Teléfono real
    $cleanPhone = clean_phone_number((string) ($phone ?? ''));
    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)) {
        $stmt = $pdo->prepare("SELECT * FROM pacientes WHERE telefono = :tel AND ({$alive}) LIMIT 1");
        $stmt->execute(['tel' => $cleanPhone]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) return $row;
    }

    // 2. DNI limpio o placeholder de DNI
    $cleanDni = clean_patient_dni($dni);
    if ($cleanDni !== '') {
        $stmt = $pdo->prepare("
            SELECT * FROM pacientes 
            WHERE ({$alive})
              AND (
                dni = :dni 
                OR REPLACE(REPLACE(COALESCE(dni, \"\"), \".\", \"\"), \" \", \"\") = :clean
                OR telefono = :telDni
              )
            LIMIT 1
        ");
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
            $stmt = $pdo->prepare("
                SELECT * FROM pacientes 
                WHERE ({$alive})
                  AND (
                    LOWER(nombre_completo) = :full1
                    OR LOWER(TRIM(CONCAT(nombre, \" \", apellido))) = :full2
                    OR LOWER(TRIM(CONCAT(apellido, \" \", nombre))) = :full3
                  )
                LIMIT 1
            ");
            $stmt->execute(['full1' => $fullLower, 'full2' => $fullLower, 'full3' => $fullLower]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row
                && ($cleanPhone === '' || is_placeholder_phone($cleanPhone)
                    || kinesica_phones_compatible_for_name_merge($cleanPhone, (string) ($row['telefono'] ?? '')))
            ) {
                return $row;
            }

            $stmtAll = $pdo->query("SELECT id, nombre, apellido, nombre_completo, telefono, deleted_at FROM pacientes WHERE ({$alive})");
            if ($stmtAll) {
                while ($cand = $stmtAll->fetch(PDO::FETCH_ASSOC)) {
                    $candFull = trim(($cand['nombre_completo'] ?? '') ?: (($cand['nombre'] ?? '') . ' ' . ($cand['apellido'] ?? '')));
                    if (canonical_patient_name_key($candFull) !== $nameKey) {
                        continue;
                    }
                    // Homónimos con WhatsApp reales distintos: no matchear solo por nombre.
                    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)
                        && !kinesica_phones_compatible_for_name_merge($cleanPhone, (string) ($cand['telefono'] ?? ''))
                    ) {
                        continue;
                    }
                    $fullStmt = $pdo->prepare("SELECT * FROM pacientes WHERE id = :id AND ({$alive}) LIMIT 1");
                    $fullStmt->execute(['id' => (int) $cand['id']]);
                    $full = $fullStmt->fetch(PDO::FETCH_ASSOC);
                    return is_array($full) ? $full : $cand;
                }
            }
        }
    }

    return null;
}

/**
 * Teléfono al actualizar un match: placeholder/vacío → adoptar nuevo;
 * dos WhatsApp reales distintos → conservar el existente (no pisar por homónimo).
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
    return $existingTel;
}

/** Homónimos con WhatsApp reales distintos: no unir solo por nombre. */
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
        // Solo fichas activas: un soft-deleted nunca puede ser survivor ni absorber a un activo.
        $alive = kinesica_pacientes_alive_sql($pdo);
        $stmt = $pdo->query("SELECT * FROM pacientes WHERE ({$alive}) ORDER BY id ASC");
        if (!$stmt) return 0;
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $rows = array_values(array_filter($rows, 'kinesica_pacientes_row_is_active'));
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
