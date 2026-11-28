<?php
declare(strict_types=1);

/**
 * Primitivas de match de pacientes (exact / DNI / suffix-8 / nombre canónico).
 */

/**
 * @return array<string,mixed>|null
 */
function kinesica_match_by_exact_phone(PDO $pdo, string $clean, string $aliveSql): ?array
{
    if ($clean === '' || is_placeholder_phone($clean)) {
        return null;
    }
    $stmt = $pdo->prepare("SELECT * FROM pacientes WHERE telefono = :tel AND ({$aliveSql}) LIMIT 1");
    $stmt->execute(['tel' => $clean]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

/**
 * @return array<string,mixed>|null
 */
function kinesica_match_by_dni(PDO $pdo, string $cleanDni, string $aliveSql): ?array
{
    if ($cleanDni === '') {
        return null;
    }
    $stmt = $pdo->prepare("
        SELECT * FROM pacientes
        WHERE ({$aliveSql})
          AND (
            dni = :dni
            OR REPLACE(REPLACE(COALESCE(dni, \"\"), \".\", \"\"), \" \", \"\") = :clean
            OR telefono = :telDni
          )
        LIMIT 1
    ");
    $stmt->execute([
        'dni' => $cleanDni,
        'clean' => $cleanDni,
        'telDni' => 'sin-tel-dni-' . $cleanDni,
    ]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return is_array($row) ? $row : null;
}

/**
 * Sufijo de 8 dígitos solo si hay exactamente 1 candidato.
 *
 * @param string $extraAndSql Condición AND adicional (ej. email IS NOT NULL); sin placeholders.
 * @return array<string,mixed>|null
 */
function kinesica_match_by_phone_suffix_unique(
    PDO $pdo,
    string $clean,
    string $aliveSql,
    string $extraAndSql = ''
): ?array {
    if ($clean === '' || is_placeholder_phone($clean)) {
        return null;
    }
    $suffix = substr($clean, -8);
    if (strlen($suffix) < 8) {
        return null;
    }
    $extra = $extraAndSql !== '' ? " AND ({$extraAndSql})" : '';
    $stmt = $pdo->prepare(
        "SELECT * FROM pacientes
         WHERE ({$aliveSql}) AND telefono LIKE :tel_end{$extra}
         LIMIT 2"
    );
    $stmt->execute(['tel_end' => '%' . $suffix]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (count($rows) !== 1) {
        return null;
    }
    return $rows[0];
}

/**
 * Match por clave canónica de nombre + guardia de homónimos (WhatsApp reales distintos).
 *
 * @return array<string,mixed>|null
 */
function kinesica_match_by_canonical_name(
    PDO $pdo,
    string $name,
    string $incomingPhone,
    string $aliveSql,
    int $minTokens = 2
): ?array {
    $name = trim($name);
    if ($name === '') {
        return null;
    }
    $nameKey = canonical_patient_name_key($name);
    if ($nameKey === '') {
        return null;
    }
    $tokenCount = substr_count($nameKey, ' ') + 1;
    if ($tokenCount < $minTokens) {
        return null;
    }
    // Con ≥2 tokens: prefiltro SQL LOWER (como find_existing histórico).
    if ($minTokens >= 2 && str_contains($nameKey, ' ')) {
        $fullLower = mb_strtolower($name, 'UTF-8');
        $stmt = $pdo->prepare("
            SELECT * FROM pacientes
            WHERE ({$aliveSql})
              AND (
                LOWER(nombre_completo) = :full1
                OR LOWER(TRIM(CONCAT(nombre, \" \", apellido))) = :full2
                OR LOWER(TRIM(CONCAT(apellido, \" \", nombre))) = :full3
              )
            LIMIT 1
        ");
        $stmt->execute(['full1' => $fullLower, 'full2' => $fullLower, 'full3' => $fullLower]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $cleanPhone = clean_phone_number($incomingPhone);
        if (is_array($row)
            && ($cleanPhone === '' || is_placeholder_phone($cleanPhone)
                || kinesica_phones_compatible_for_name_merge($cleanPhone, (string) ($row['telefono'] ?? '')))
        ) {
            return $row;
        }
    }

    $cleanPhone = clean_phone_number($incomingPhone);
    $haveRealPhone = $cleanPhone !== '' && !is_placeholder_phone($cleanPhone);

    // Si hay un índice de lote activo (recordatorios/campaña), lookup O(1) en memoria.
    if (function_exists('kinesica_match_batch_store')) {
        $byKey = kinesica_match_batch_store($pdo, null, $aliveSql);
        if (is_array($byKey)) {
            foreach ($byKey[$nameKey] ?? [] as $cand) {
                if ($haveRealPhone
                    && !kinesica_phones_compatible_for_name_merge($cleanPhone, (string) ($cand['telefono'] ?? ''))
                ) {
                    continue;
                }
                return $cand;
            }
            return null;
        }
    }

    $stmtAll = $pdo->query(
        "SELECT id, nombre, apellido, nombre_completo, telefono, deleted_at, viene_de_campana
         FROM pacientes WHERE ({$aliveSql})"
    );
    if (!$stmtAll) {
        return null;
    }
    while ($cand = $stmtAll->fetch(PDO::FETCH_ASSOC)) {
        $candFull = trim((string) (($cand['nombre_completo'] ?? '') ?: trim(($cand['nombre'] ?? '') . ' ' . ($cand['apellido'] ?? ''))));
        $candKey = canonical_patient_name_key($candFull);
        $altKey = canonical_patient_name_key(trim(($cand['nombre'] ?? '') . ' ' . ($cand['apellido'] ?? '')));
        $nameHit = ($candKey !== '' && $candKey === $nameKey) || ($altKey !== '' && $altKey === $nameKey);
        if (!$nameHit) {
            continue;
        }
        if ($haveRealPhone
            && !kinesica_phones_compatible_for_name_merge($cleanPhone, (string) ($cand['telefono'] ?? ''))
        ) {
            continue;
        }
        $fullStmt = $pdo->prepare("SELECT * FROM pacientes WHERE id = :id AND ({$aliveSql}) LIMIT 1");
        $fullStmt->execute(['id' => (int) $cand['id']]);
        $full = $fullStmt->fetch(PDO::FETCH_ASSOC);
        return is_array($full) ? $full : $cand;
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
