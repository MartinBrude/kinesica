<?php
declare(strict_types=1);

require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';

/**
 * Candidatos plausibles de duplicado para un paciente (sin barrer todo el directorio).
 * Solo filas activas (deleted_at IS NULL).
 *
 * @param array<string,mixed> $me
 * @return list<array<string,mixed>>
 */
function kinesica_pacientes_dedupe_candidates_for(PDO $pdo, array $me): array
{
    $id = (int) ($me['id'] ?? 0);
    if ($id <= 0 || !kinesica_pacientes_row_is_active($me)) {
        return [];
    }

    $alive = kinesica_pacientes_alive_sql($pdo);
    $byId = [$id => $me];

    $rawPhone = (string) ($me['telefono'] ?? '');
    $cleanPhone = clean_phone_number($rawPhone);
    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone) && !is_placeholder_phone($rawPhone)) {
        $stmt = $pdo->prepare("SELECT * FROM pacientes WHERE telefono = :tel AND ({$alive})");
        $stmt->execute(['tel' => $cleanPhone]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            if (kinesica_pacientes_row_is_active($row)) {
                $byId[(int) $row['id']] = $row;
            }
        }
    }

    $dni = clean_patient_dni($me['dni'] ?? null);
    if ($dni === '' && str_starts_with($rawPhone, 'sin-tel-dni-')) {
        $dni = substr($rawPhone, 12);
    }
    if ($dni !== '') {
        $stmt = $pdo->prepare(
            "SELECT * FROM pacientes
             WHERE ({$alive})
               AND (
                 dni = :dni
                 OR telefono = :sintel
                 OR REPLACE(REPLACE(REPLACE(COALESCE(dni, \"\"), \".\", \"\"), \"-\", \"\"), \" \", \"\") = :dni
               )"
        );
        $stmt->execute([
            'dni' => $dni,
            'sintel' => 'sin-tel-dni-' . $dni,
        ]);
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            if (kinesica_pacientes_row_is_active($row)) {
                $byId[(int) $row['id']] = $row;
            }
        }
    }

    $full = trim((string) (($me['nombre_completo'] ?? '') ?: trim(($me['nombre'] ?? '') . ' ' . ($me['apellido'] ?? ''))));
    $nameKey = canonical_patient_name_key($full);
    if ($nameKey !== '' && str_contains($nameKey, ' ')) {
        $tokens = preg_split('/\s+/u', $nameKey, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $apellidoHint = (string) (end($tokens) ?: '');
        if (mb_strlen($apellidoHint, 'UTF-8') >= 3) {
            $stmt = $pdo->prepare(
                "SELECT * FROM pacientes
                 WHERE id != :id
                   AND ({$alive})
                   AND (
                     LOWER(apellido) LIKE :ape
                     OR LOWER(nombre_completo) LIKE :ape_full
                   )
                 LIMIT 80"
            );
            $stmt->execute([
                'id' => $id,
                'ape' => '%' . mb_strtolower($apellidoHint, 'UTF-8') . '%',
                'ape_full' => '%' . mb_strtolower($apellidoHint, 'UTF-8') . '%',
            ]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
                if (!kinesica_pacientes_row_is_active($row)) {
                    continue;
                }
                $otherFull = trim((string) (($row['nombre_completo'] ?? '') ?: trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''))));
                if (canonical_patient_name_key($otherFull) !== $nameKey) {
                    continue;
                }
                if (!kinesica_phones_compatible_for_name_merge($rawPhone, (string) ($row['telefono'] ?? ''))) {
                    continue;
                }
                $byId[(int) $row['id']] = $row;
            }
        }
    }

    return array_values($byId);
}
