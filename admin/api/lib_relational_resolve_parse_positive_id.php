<?php
declare(strict_types=1);


/**
 * Parsea un ID positivo desde hint/body. Rechaza bools y strings no enteros puros.
 */
function kinesica_rel_parse_positive_id(mixed $raw): int
{
    if (is_bool($raw) || $raw === null || $raw === '') {
        return 0;
    }
    if (is_int($raw)) {
        return $raw > 0 ? $raw : 0;
    }
    if (is_float($raw)) {
        if (!is_finite($raw) || floor($raw) !== $raw) {
            return 0;
        }
        return ((int) $raw) > 0 ? (int) $raw : 0;
    }
    if (is_string($raw)) {
        $t = trim($raw);
        if ($t === '' || !ctype_digit($t)) {
            return 0;
        }
        $n = (int) $t;
        return $n > 0 ? $n : 0;
    }
    return 0;
}

/**
 * ¿La fila de pacientes está soft-deleted? (deleted_at ausente = activo).
 *
 * @param array<string,mixed> $row
 */

/**
 * ¿La fila de pacientes está soft-deleted? (deleted_at ausente = activo).
 *
 * @param array<string,mixed> $row
 */
function kinesica_rel_paciente_row_is_deleted(array $row): bool
{
    if (!array_key_exists('deleted_at', $row)) {
        return false;
    }
    $v = $row['deleted_at'];
    return $v !== null && $v !== '';
}

/**
 * @param array{paciente_id?:int|string,phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 * @param array{ignore_flag?:bool} $opts ignore_flag=true para backfill CLI aunque REL_WRITE_IDS esté off
 * @return array{paciente_id:?int,status:string,reason:string,candidates:int}
 */

/**
 * @param array{paciente_id?:int|string,phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 * @param array{ignore_flag?:bool} $opts ignore_flag=true para backfill CLI aunque REL_WRITE_IDS esté off
 * @return array{paciente_id:?int,status:string,reason:string,candidates:int}
 */
function kinesica_rel_resolve_paciente(PDO $pdo, array $hints, array $opts = []): array
{
    $ignoreFlag = !empty($opts['ignore_flag']);
    if (!$ignoreFlag && !kinesica_rel_write_ids()) {
        return ['paciente_id' => null, 'status' => 'disabled', 'reason' => 'REL_WRITE_IDS off', 'candidates' => 0];
    }
    if (!kinesica_migrations_table_exists($pdo, 'pacientes')) {
        return ['paciente_id' => null, 'status' => 'unmatched', 'reason' => 'sin_tabla_pacientes', 'candidates' => 0];
    }

    $hasDeletedAt = kinesica_migrations_column_exists($pdo, 'pacientes', 'deleted_at');

    // Etapa 10: si ya viene paciente_id explícito, no join por tel/nombre.
    $explicitId = kinesica_rel_parse_positive_id($hints['paciente_id'] ?? null);
    if ($explicitId > 0) {
        $cols = $hasDeletedAt ? 'id, deleted_at' : 'id';
        $chk = $pdo->prepare("SELECT {$cols} FROM pacientes WHERE id = :id LIMIT 1");
        $chk->execute(['id' => $explicitId]);
        $row = $chk->fetch(PDO::FETCH_ASSOC);
        if (is_array($row)) {
            if ($hasDeletedAt && kinesica_rel_paciente_row_is_deleted($row)) {
                return [
                    'paciente_id' => null,
                    'status' => 'unmatched',
                    'reason' => 'paciente_id_eliminado',
                    'candidates' => 0,
                ];
            }
            return [
                'paciente_id' => $explicitId,
                'status' => 'matched',
                'reason' => 'paciente_id_explicit',
                'candidates' => 1,
            ];
        }
        return [
            'paciente_id' => null,
            'status' => 'unmatched',
            'reason' => 'paciente_id_inexistente',
            'candidates' => 0,
        ];
    }

    $phoneRaw = (string) ($hints['phone'] ?? $hints['wa_id'] ?? '');
    $phone = clean_phone_number($phoneRaw);
    if ($phone === '' && $phoneRaw !== '') {
        $digits = preg_replace('/\D+/', '', $phoneRaw) ?? '';
        if ($digits !== '') {
            $phone = clean_phone_number($digits) ?: $digits;
        }
    }
    $dni = clean_patient_dni(isset($hints['dni']) ? (string) $hints['dni'] : null);
    $nombre = trim((string) ($hints['nombre'] ?? ''));
    $nameKey = $nombre !== '' ? canonical_patient_name_key($nombre) : '';

    // 1) Teléfono normalizado exacto (pacientes.telefono + paciente_contactos)
    if ($phone !== '' && !is_placeholder_phone($phone)) {
        $matches = kinesica_rel_find_pacientes_by_phone($pdo, $phone);
        try {
            require_once __DIR__ . '/lib_relational_contactos.php';
            $fromContactos = kinesica_rel_find_pacientes_by_contacto_phone($pdo, $phone);
            if ($fromContactos !== []) {
                $byId = [];
                foreach (array_merge($matches, $fromContactos) as $m) {
                    $byId[(int) $m['id']] = $m;
                }
                $matches = array_values($byId);
            }
        } catch (Throwable $e) {
            error_log('kinesica rel resolve contactos lookup: ' . $e->getMessage());
        }
        if (count($matches) === 1) {
            return [
                'paciente_id' => (int) $matches[0]['id'],
                'status' => 'matched',
                'reason' => 'telefono',
                'candidates' => 1,
            ];
        }
        if (count($matches) > 1) {
            $keys = [];
            foreach ($matches as $m) {
                $keys[canonical_patient_name_key((string) ($m['nombre_completo'] ?? ''))] = true;
            }
            if (count($keys) === 1) {
                // Mismo nombre canónico: tomar el de menor id (estable); fusión real es etapa 4.
                usort($matches, static fn ($a, $b) => (int) $a['id'] <=> (int) $b['id']);
                return [
                    'paciente_id' => (int) $matches[0]['id'],
                    'status' => 'matched',
                    'reason' => 'telefono_mismo_nombre',
                    'candidates' => count($matches),
                ];
            }
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'telefono_compartido',
                'candidates' => count($matches),
            ];
        }
    }

    // 2) DNI único
    if ($dni !== '') {
        $matches = kinesica_rel_find_pacientes_by_dni($pdo, $dni);
        if (count($matches) === 1) {
            return [
                'paciente_id' => (int) $matches[0]['id'],
                'status' => 'matched',
                'reason' => 'dni',
                'candidates' => 1,
            ];
        }
        if (count($matches) > 1) {
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'dni_duplicado',
                'candidates' => count($matches),
            ];
        }
    }

    // 3) Nombre único solo si no hubo teléfono (evita vincular mal cuando el wa/tel no matcheó).
    //    Requiere DNI en hints: el paciente debe tener ese DNI o DNI vacío (nunca un DNI distinto).
    if ($nameKey !== '' && $phone === '' && $dni !== '') {
        $matches = kinesica_rel_find_pacientes_by_name_key($pdo, $nameKey);
        $compatible = [];
        foreach ($matches as $m) {
            $rowDni = clean_patient_dni($m['dni'] ?? null);
            if ($rowDni === '' || $rowDni === $dni) {
                $compatible[] = $m;
            }
        }
        if (count($compatible) === 1) {
            return [
                'paciente_id' => (int) $compatible[0]['id'],
                'status' => 'matched',
                'reason' => 'nombre_unico_con_dni_hint',
                'candidates' => 1,
            ];
        }
        if (count($compatible) > 1) {
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'nombre_ambiguo',
                'candidates' => count($compatible),
            ];
        }
    }

    return [
        'paciente_id' => null,
        'status' => 'unmatched',
        'reason' => 'sin_coincidencia',
        'candidates' => 0,
    ];
}

/**
 * @return list<array<string,mixed>>
 */
/**
 * Columnas base + opcionales. Solo filas activas (sin soft-delete).
 *
 * @return list<array<string,mixed>>
 */
