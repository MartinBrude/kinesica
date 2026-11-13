<?php
declare(strict_types=1);


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
