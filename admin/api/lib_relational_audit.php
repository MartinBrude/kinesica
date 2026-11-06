<?php
declare(strict_types=1);

/**
 * Auditoría read-only de datos para el refactor relacional (etapa 1).
 * No escribe ni fusiona. Ver docs/plan-refactor-datos-relacionales.md.
 */

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/lib_migrations.php';

/** @return list<string> */
function kinesica_audit_lista_espera_estados(): array
{
    return ['activa', 'notificado', 'asignado', 'expirada', 'contactado', 'cancelada'];
}

function kinesica_audit_mask_phone(string|int|float|null $raw): string
{
    $digits = preg_replace('/\D+/', '', (string) ($raw ?? '')) ?? '';
    if ($digits === '') {
        return '(vacío)';
    }
    if (strlen($digits) <= 4) {
        return str_repeat('*', strlen($digits));
    }
    return str_repeat('*', max(0, strlen($digits) - 4)) . substr($digits, -4);
}

function kinesica_audit_mask_email(string $email): string
{
    $email = trim($email);
    if ($email === '' || !str_contains($email, '@')) {
        return $email === '' ? '(vacío)' : '(inválido)';
    }
    [$name, $domain] = explode('@', $email, 2);
    $n = mb_strlen($name);
    $masked = $n <= 2
        ? mb_substr($name, 0, 1) . '*'
        : mb_substr($name, 0, 2) . str_repeat('*', min(4, max(1, $n - 3))) . mb_substr($name, -1);
    return $masked . '@' . $domain;
}

function kinesica_audit_is_test_name(string $name): bool
{
    $n = mb_strtolower(trim($name), 'UTF-8');
    if ($n === '') {
        return true;
    }
    if (is_tk3_or_blocked_name($name)) {
        return true;
    }
    foreach (['test', 'prueba', 'asdf', 'xxx', 'paciente demo', 'demo paciente'] as $kw) {
        if (str_contains($n, $kw)) {
            return true;
        }
    }
    return false;
}

/**
 * @return array{ok:bool,driver:string,tables:array<string,bool>,notes:list<string>}
 */
function kinesica_audit_schema(PDO $pdo): array
{
    $expected = [
        'pacientes',
        'lista_espera',
        'fichas',
        'interaccion_eventos',
        'recordatorio_eventos',
        'paciente_contactos',
        'schema_migrations',
    ];
    $tables = [];
    $notes = [];
    foreach ($expected as $t) {
        $tables[$t] = kinesica_migrations_table_exists($pdo, $t);
    }
    if (!$tables['paciente_contactos']) {
        $notes[] = 'Falta paciente_contactos (correr migrate.php migración 001).';
    }
    if (!$tables['schema_migrations']) {
        $notes[] = 'Falta schema_migrations (correr migrate.php).';
    }

    $relCols = [
        ['fichas', 'paciente_id'],
        ['fichas', 'profesional_id'],
        ['fichas', 'version'],
        ['lista_espera', 'paciente_id'],
        ['pacientes', 'deleted_at'],
        ['pacientes', 'version'],
        ['interaccion_eventos', 'paciente_id'],
        ['recordatorio_eventos', 'paciente_id'],
        ['recordatorio_eventos', 'turno_id'],
    ];
    foreach ($relCols as [$table, $col]) {
        if (!$tables[$table]) {
            continue;
        }
        if (!kinesica_migrations_column_exists($pdo, $table, $col)) {
            $notes[] = "Falta columna {$table}.{$col} (migración 002–004 o puente ensure_*).";
        }
    }

    // Drift documentado: ENUM lista_espera entre schema_pacientes.sql e install/helpers.
    $notes[] = 'Drift conocido: estados lista_espera difieren entre schema_pacientes.sql '
        . '(activa|notificado|asignado|expirada) y pacientes_helpers.php '
        . '(activa|contactado|asignado|cancelada). Auditoría acepta la unión.';

    return [
        'ok' => $tables['pacientes'] && $tables['fichas'],
        'driver' => (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME),
        'tables' => $tables,
        'notes' => $notes,
    ];
}

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */
function kinesica_audit_patient_ref(array $row, bool $fullPii): array
{
    $id = (int) ($row['id'] ?? 0);
    $tel = (string) ($row['telefono'] ?? '');
    $email = (string) ($row['email'] ?? '');
    $ref = [
        'id' => $id,
        'nombre_completo' => (string) ($row['nombre_completo'] ?? ''),
        'telefono' => $fullPii ? $tel : kinesica_audit_mask_phone($tel),
        'dni' => $fullPii ? (string) ($row['dni'] ?? '') : (
            ($d = clean_patient_dni($row['dni'] ?? null)) === '' ? '' : (str_repeat('*', max(0, strlen($d) - 3)) . substr($d, -3))
        ),
    ];
    if ($email !== '') {
        $ref['email'] = $fullPii ? $email : kinesica_audit_mask_email($email);
    }
    return $ref;
}

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
function kinesica_audit_fichas(PDO $pdo, bool $fullPii): array
{
    if (!kinesica_migrations_table_exists($pdo, 'fichas')) {
        return ['total' => 0, 'error' => 'tabla fichas ausente'];
    }

    $users = [];
    if (kinesica_migrations_table_exists($pdo, 'users')) {
        try {
            $urows = $pdo->query('SELECT username, active FROM users')->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($urows as $u) {
                $users[(string) $u['username']] = (int) ($u['active'] ?? 1) === 1;
            }
        } catch (Throwable) {
        }
    }

    $pacientes = [];
    if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
        $pacientes = $pdo->query('SELECT * FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
    $byDni = [];
    $byPhone = [];
    foreach ($pacientes as $p) {
        $d = clean_patient_dni($p['dni'] ?? null);
        if ($d !== '') {
            $byDni[$d][] = $p;
        }
        $tel = clean_phone_number((string) ($p['telefono'] ?? ''));
        if ($tel !== '' && !is_placeholder_phone((string) ($p['telefono'] ?? ''))) {
            $byPhone[$tel][] = $p;
        }
    }

    $rows = $pdo->query('SELECT * FROM fichas')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $invalidJson = [];
    $noPatient = [];
    $dniConflict = [];
    $profUnknown = [];
    $profInactive = [];
    $dupByPatientDate = [];
    $missingFoto = [];
    $byPatientDate = [];
    $hasPacienteIdCol = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');

    $uploadsRoot = dirname(__DIR__) . '/uploads';

    foreach ($rows as $row) {
        $id = (string) ($row['id'] ?? '');
        $payload = json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) {
            $invalidJson[] = ['ficha_id' => $id];
            continue;
        }
        $nombre = sanitize_patient_name((string) ($payload['nombre'] ?? ''));
        $dni = clean_patient_dni($payload['dni'] ?? null);
        $fecha = trim((string) ($payload['fecha'] ?? $payload['date'] ?? $row['updated_at'] ?? ''));
        $prof = strtolower(trim((string) ($row['profesional'] ?? $payload['profesional'] ?? '')));
        $pacienteId = $hasPacienteIdCol && isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
            ? (int) $row['paciente_id']
            : null;

        $matched = [];
        if ($pacienteId) {
            foreach ($pacientes as $p) {
                if ((int) $p['id'] === $pacienteId) {
                    $matched[] = $p;
                }
            }
        }
        if ($matched === [] && $dni !== '' && isset($byDni[$dni])) {
            $matched = $byDni[$dni];
        }
        // Teléfono rara vez está en ficha; si hay campo contacto se ignora aquí.

        if ($matched === []) {
            $noPatient[] = [
                'ficha_id' => $id,
                'nombre' => $nombre,
                'dni' => $fullPii ? $dni : ($dni === '' ? '' : '***' . substr($dni, -3)),
                'profesional' => $prof,
                'paciente_id' => $pacienteId,
            ];
        } elseif (count($matched) > 1) {
            $dniConflict[] = [
                'ficha_id' => $id,
                'dni' => $fullPii ? $dni : '***' . substr($dni, -3),
                'matches' => array_map(static fn ($p) => kinesica_audit_patient_ref($p, $fullPii), $matched),
                'clasificacion' => 'conflicto_dni_multiple',
            ];
        }

        if ($prof !== '' && $users !== []) {
            if (!array_key_exists($prof, $users) && !in_array($prof, ['norberto', 'maria', 'indistinto'], true)) {
                $profUnknown[] = ['ficha_id' => $id, 'profesional' => $prof];
            } elseif (isset($users[$prof]) && $users[$prof] === false) {
                $profInactive[] = ['ficha_id' => $id, 'profesional' => $prof];
            }
        }

        $matchId = $matched !== [] ? (int) $matched[0]['id'] : ('dni:' . $dni . '|name:' . canonical_patient_name_key($nombre));
        $dateKey = $fecha !== '' ? substr($fecha, 0, 10) : 'sin-fecha';
        $byPatientDate[$matchId . '|' . $dateKey][] = $id;

        $foto = trim((string) ($payload['fotoUrl'] ?? $payload['foto'] ?? ''));
        if ($foto !== '' && !preg_match('#^https?://#i', $foto)) {
            $path = $foto;
            if (str_starts_with($path, '/')) {
                $path = dirname(__DIR__, 2) . $path;
            } elseif (!str_starts_with($path, '/')) {
                $candidate = $uploadsRoot . '/' . ltrim($path, '/');
                if (!is_file($path) && is_file($candidate)) {
                    $path = $candidate;
                }
            }
            if (!is_file($path) && !is_file($uploadsRoot . '/' . basename($foto))) {
                $missingFoto[] = ['ficha_id' => $id, 'foto' => basename($foto)];
            }
        }
    }

    foreach ($byPatientDate as $key => $ids) {
        if (count($ids) < 2) {
            continue;
        }
        $dupByPatientDate[] = [
            'key' => $key,
            'ficha_ids' => $ids,
            'count' => count($ids),
            'clasificacion' => 'posible_duplicado_paciente_fecha',
        ];
    }

    return [
        'total' => count($rows),
        'invalid_json' => $invalidJson,
        'without_patient_match' => $noPatient,
        'dni_multiple_patients' => $dniConflict,
        'profesional_unknown' => $profUnknown,
        'profesional_inactive' => $profInactive,
        'duplicate_patient_date' => $dupByPatientDate,
        'missing_foto_file' => $missingFoto,
        'counts' => [
            'invalid_json' => count($invalidJson),
            'without_patient_match' => count($noPatient),
            'dni_multiple_patients' => count($dniConflict),
            'profesional_unknown' => count($profUnknown),
            'profesional_inactive' => count($profInactive),
            'duplicate_patient_date' => count($dupByPatientDate),
            'missing_foto_file' => count($missingFoto),
        ],
    ];
}

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
function kinesica_audit_whatsapp_recordatorios(PDO $pdo, bool $fullPii): array
{
    $out = [
        'interacciones' => ['total' => 0],
        'recordatorios' => ['total' => 0],
    ];

    $phoneIndex = [];
    if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
        foreach ($pdo->query('SELECT id, telefono, nombre_completo FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $p) {
            $tel = clean_phone_number((string) ($p['telefono'] ?? ''));
            if ($tel !== '') {
                $phoneIndex[$tel][] = $p;
            }
            $digits = preg_replace('/\D+/', '', (string) ($p['telefono'] ?? '')) ?? '';
            if ($digits !== '') {
                $phoneIndex[$digits][] = $p;
            }
        }
    }

    if (kinesica_migrations_table_exists($pdo, 'interaccion_eventos')) {
        $rows = $pdo->query(
            'SELECT wa_id, patient_name, event_key'
            . (kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id') ? ', paciente_id' : '')
            . ' FROM interaccion_eventos'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $byWa = [];
        $keys = [];
        $dupKeys = [];
        $withoutPatient = [];
        foreach ($rows as $row) {
            $wa = preg_replace('/\D+/', '', (string) ($row['wa_id'] ?? '')) ?? '';
            $name = trim((string) ($row['patient_name'] ?? ''));
            $ek = (string) ($row['event_key'] ?? '');
            if ($ek !== '') {
                if (isset($keys[$ek])) {
                    $dupKeys[$ek] = ($dupKeys[$ek] ?? 1) + 1;
                }
                $keys[$ek] = true;
            }
            if ($wa === '') {
                continue;
            }
            $byWa[$wa]['names'][$name !== '' ? $name : '(vacío)'] = true;
            $pid = isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
                ? (int) $row['paciente_id']
                : null;
            $matched = $pid !== null || isset($phoneIndex[$wa]) || isset($phoneIndex['549' . $wa]);
            if (!$matched) {
                $withoutPatient[$wa] = [
                    'wa_id' => $fullPii ? $wa : kinesica_audit_mask_phone($wa),
                    'sample_name' => $name,
                ];
            }
        }
        $multiNames = [];
        foreach ($byWa as $wa => $info) {
            $names = array_keys($info['names'] ?? []);
            if (count($names) > 1) {
                $waStr = (string) $wa;
                $multiNames[] = [
                    'wa_id' => $fullPii ? $waStr : kinesica_audit_mask_phone($waStr),
                    'names' => $names,
                ];
            }
        }
        $out['interacciones'] = [
            'total' => count($rows),
            'unique_wa_ids' => count($byWa),
            'wa_without_patient' => array_values($withoutPatient),
            'wa_multiple_names' => $multiNames,
            'duplicate_event_keys' => array_map(
                static fn ($k, $c) => ['event_key' => $k, 'count' => $c],
                array_keys($dupKeys),
                array_values($dupKeys)
            ),
            'counts' => [
                'wa_without_patient' => count($withoutPatient),
                'wa_multiple_names' => count($multiNames),
                'duplicate_event_keys' => count($dupKeys),
            ],
        ];
    }

    if (kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        $cols = 'event_key, wa_id, patient_name, calendar_event_id, status';
        if (kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id')) {
            $cols .= ', paciente_id';
        }
        if (kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id')) {
            $cols .= ', turno_id';
        }
        $rows = $pdo->query('SELECT ' . $cols . ' FROM recordatorio_eventos')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $keys = [];
        $dupKeys = [];
        $cal = [];
        $dupCal = [];
        $withoutTurno = [];
        $nameOnly = [];
        foreach ($rows as $row) {
            $ek = (string) ($row['event_key'] ?? '');
            if ($ek !== '') {
                if (isset($keys[$ek])) {
                    $dupKeys[$ek] = ($dupKeys[$ek] ?? 1) + 1;
                }
                $keys[$ek] = true;
            }
            $cid = trim((string) ($row['calendar_event_id'] ?? ''));
            if ($cid !== '') {
                if (isset($cal[$cid])) {
                    $dupCal[$cid] = ($dupCal[$cid] ?? 1) + 1;
                }
                $cal[$cid] = true;
            }
            $turnoId = isset($row['turno_id']) && $row['turno_id'] !== null && $row['turno_id'] !== ''
                ? (int) $row['turno_id']
                : null;
            if ($turnoId === null) {
                $withoutTurno[] = [
                    'event_key' => $ek,
                    'calendar_event_id' => $cid,
                    'status' => (string) ($row['status'] ?? ''),
                ];
            }
            $wa = preg_replace('/\D+/', '', (string) ($row['wa_id'] ?? '')) ?? '';
            $pid = isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
                ? (int) $row['paciente_id']
                : null;
            $matched = $pid !== null || ($wa !== '' && (isset($phoneIndex[$wa]) || isset($phoneIndex['549' . $wa])));
            $name = trim((string) ($row['patient_name'] ?? ''));
            if (!$matched && $name !== '' && $wa === '') {
                $nameOnly[] = ['event_key' => $ek, 'patient_name' => $name];
            }
        }
        // Sin tabla turnos aún: "sin turno" es esperado; se reporta como informativo.
        $out['recordatorios'] = [
            'total' => count($rows),
            'without_turno_id' => array_slice($withoutTurno, 0, 200),
            'without_turno_id_total' => count($withoutTurno),
            'note' => 'turno_id aún no es obligatorio (etapa 6). Se lista para baseline.',
            'duplicate_event_keys' => array_map(
                static fn ($k, $c) => ['event_key' => $k, 'count' => $c],
                array_keys($dupKeys),
                array_values($dupKeys)
            ),
            'duplicate_calendar_event_id' => array_map(
                static fn ($k, $c) => ['calendar_event_id' => $k, 'count' => $c],
                array_keys($dupCal),
                array_values($dupCal)
            ),
            'identifiable_only_by_name' => $nameOnly,
            'counts' => [
                'without_turno_id' => count($withoutTurno),
                'duplicate_event_keys' => count($dupKeys),
                'duplicate_calendar_event_id' => count($dupCal),
                'identifiable_only_by_name' => count($nameOnly),
            ],
        ];
    }

    return $out;
}

/**
 * @return array{generated_at:string,full_pii:bool,schema:array,pacientes:array,fichas:array,lista_espera:array,whatsapp_recordatorios:array,manual_review:list<array>,resolution_rules:list<string>,summary:array}
 */
function kinesica_audit_run(PDO $pdo, bool $fullPii = false): array
{
    $pacientes = kinesica_audit_pacientes($pdo, $fullPii);
    $fichas = kinesica_audit_fichas($pdo, $fullPii);
    $lista = kinesica_audit_lista_espera($pdo, $fullPii);
    $wa = kinesica_audit_whatsapp_recordatorios($pdo, $fullPii);
    $schema = kinesica_audit_schema($pdo);

    $manual = [];
    foreach ($pacientes['shared_phones_different_names'] ?? [] as $item) {
        $manual[] = ['area' => 'pacientes', 'reason' => 'telefono_compartido', 'item' => $item];
    }
    foreach ($pacientes['duplicate_dni'] ?? [] as $item) {
        $manual[] = ['area' => 'pacientes', 'reason' => 'dni_duplicado', 'item' => $item];
    }
    foreach ($pacientes['same_name_groups'] ?? [] as $item) {
        if (($item['clasificacion'] ?? '') === 'no_fusionar_ambiguo') {
            $manual[] = ['area' => 'pacientes', 'reason' => 'nombre_ambiguo', 'item' => $item];
        }
    }
    foreach ($fichas['dni_multiple_patients'] ?? [] as $item) {
        $manual[] = ['area' => 'fichas', 'reason' => 'conflicto_dni', 'item' => $item];
    }
    foreach ($lista['name_conflicts_vs_paciente'] ?? [] as $item) {
        $manual[] = ['area' => 'lista_espera', 'reason' => 'nombre_vs_telefono', 'item' => $item];
    }
    foreach ($wa['interacciones']['wa_multiple_names'] ?? [] as $item) {
        $manual[] = ['area' => 'whatsapp', 'reason' => 'wa_multi_nombre', 'item' => $item];
    }

    $rules = [
        'No fusionar automáticamente casos ambiguos.',
        'Teléfono compartido con nombres distintos → revisión manual (familia), no fusión.',
        'DNI duplicado → bloqueo hasta revisión.',
        'Candidato a fusión: mismo teléfono normalizado y mismo name_key, o mismo DNI único tras limpieza.',
        'Ficha sin paciente: backfill por DNI único; si no hay match, pendiente.',
        'Lista de espera: asociar por teléfono normalizado; conflicto de nombre → manual.',
        'wa_id es identificador externo; no es paciente_id.',
    ];

    $summary = [
        'pacientes_total' => $pacientes['total'] ?? 0,
        'fichas_total' => $fichas['total'] ?? 0,
        'lista_espera_total' => $lista['total'] ?? 0,
        'manual_review_count' => count($manual),
        'pacientes_counts' => $pacientes['counts'] ?? [],
        'fichas_counts' => $fichas['counts'] ?? [],
        'lista_espera_counts' => $lista['counts'] ?? [],
        'interacciones_counts' => $wa['interacciones']['counts'] ?? [],
        'recordatorios_counts' => $wa['recordatorios']['counts'] ?? [],
        'schema_ok' => $schema['ok'] ?? false,
    ];

    return [
        'generated_at' => gmdate('c'),
        'full_pii' => $fullPii,
        'schema' => $schema,
        'pacientes' => $pacientes,
        'fichas' => $fichas,
        'lista_espera' => $lista,
        'whatsapp_recordatorios' => $wa,
        'manual_review' => $manual,
        'resolution_rules' => $rules,
        'summary' => $summary,
    ];
}

function kinesica_audit_summary_markdown(array $report): string
{
    $s = $report['summary'] ?? [];
    $lines = [
        '# Informe auditoría datos relacionales',
        '',
        'Generado: `' . ($report['generated_at'] ?? '') . '`',
        'PII completo: `' . (($report['full_pii'] ?? false) ? 'sí' : 'no (enmascarado)') . '`',
        '',
        '## Resumen',
        '',
        '- Pacientes: ' . (int) ($s['pacientes_total'] ?? 0),
        '- Fichas: ' . (int) ($s['fichas_total'] ?? 0),
        '- Lista de espera: ' . (int) ($s['lista_espera_total'] ?? 0),
        '- Ítems revisión manual: ' . (int) ($s['manual_review_count'] ?? 0),
        '- Schema OK: ' . (($s['schema_ok'] ?? false) ? 'sí' : 'no'),
        '',
        '## Conteos pacientes',
        '',
    ];
    foreach ($s['pacientes_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Conteos fichas';
    $lines[] = '';
    foreach ($s['fichas_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Conteos lista de espera';
    $lines[] = '';
    foreach ($s['lista_espera_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Reglas de resolución';
    $lines[] = '';
    foreach ($report['resolution_rules'] ?? [] as $rule) {
        $lines[] = '- ' . $rule;
    }
    $lines[] = '';
    $lines[] = '## Notas de esquema';
    $lines[] = '';
    foreach ($report['schema']['notes'] ?? [] as $note) {
        $lines[] = '- ' . $note;
    }
    $lines[] = '';
    $lines[] = '_Detalle completo en el JSON acompañante. No fusionar ni borrar desde este informe._';
    $lines[] = '';
    return implode("\n", $lines);
}
