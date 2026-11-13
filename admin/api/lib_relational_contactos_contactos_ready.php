<?php
declare(strict_types=1);


function kinesica_rel_contactos_ready(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'paciente_contactos');
}


function kinesica_rel_normalize_email(string $raw): string
{
    $email = mb_strtolower(trim($raw), 'UTF-8');
    if ($email === '' || !str_contains($email, '@')) {
        return '';
    }
    return $email;
}

/**
 * Fija el contacto principal de un tipo. No borra otros valores del mismo tipo.
 *
 * @return 'inserted'|'updated'|'unchanged'|'skipped'
 */

/**
 * Fija el contacto principal de un tipo. No borra otros valores del mismo tipo.
 *
 * @return 'inserted'|'updated'|'unchanged'|'skipped'
 */
function kinesica_rel_set_principal_contacto(
    PDO $pdo,
    int $pacienteId,
    string $tipo,
    string $valor,
    string $valorNormalizado
): string {
    if ($pacienteId <= 0 || $valor === '' || $valorNormalizado === '') {
        return 'skipped';
    }
    if (!in_array($tipo, ['telefono', 'email'], true)) {
        return 'skipped';
    }
    if (!kinesica_rel_contactos_ready($pdo)) {
        return 'skipped';
    }

    $findExact = $pdo->prepare(
        'SELECT id, es_principal FROM paciente_contactos
         WHERE paciente_id = :pid AND tipo = :tipo AND valor_normalizado = :norm LIMIT 1'
    );
    $findExact->execute(['pid' => $pacienteId, 'tipo' => $tipo, 'norm' => $valorNormalizado]);
    $exact = $findExact->fetch(PDO::FETCH_ASSOC);

    $findPrincipal = $pdo->prepare(
        'SELECT id, valor_normalizado FROM paciente_contactos
         WHERE paciente_id = :pid AND tipo = :tipo AND es_principal = 1 LIMIT 1'
    );
    $findPrincipal->execute(['pid' => $pacienteId, 'tipo' => $tipo]);
    $principal = $findPrincipal->fetch(PDO::FETCH_ASSOC);

    if (is_array($exact)) {
        $id = (int) $exact['id'];
        if ((int) ($exact['es_principal'] ?? 0) === 1 && is_array($principal) && (int) $principal['id'] === $id) {
            $pdo->prepare(
                'UPDATE paciente_contactos SET valor = :v, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
            )->execute(['v' => $valor, 'id' => $id]);
            return 'unchanged';
        }
        // Quitar principal a otros del mismo tipo
        $pdo->prepare(
            'UPDATE paciente_contactos SET es_principal = 0, updated_at = CURRENT_TIMESTAMP
             WHERE paciente_id = :pid AND tipo = :tipo AND es_principal = 1 AND id != :id'
        )->execute(['pid' => $pacienteId, 'tipo' => $tipo, 'id' => $id]);
        $pdo->prepare(
            'UPDATE paciente_contactos SET valor = :v, es_principal = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
        )->execute(['v' => $valor, 'id' => $id]);
        return 'updated';
    }

    if (is_array($principal)) {
        $pdo->prepare(
            'UPDATE paciente_contactos
             SET valor = :v, valor_normalizado = :n, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        )->execute([
            'v' => $valor,
            'n' => $valorNormalizado,
            'id' => (int) $principal['id'],
        ]);
        return 'updated';
    }

    $pdo->prepare(
        'INSERT INTO paciente_contactos (paciente_id, tipo, valor, valor_normalizado, es_principal)
         VALUES (:pid, :tipo, :v, :n, 1)'
    )->execute([
        'pid' => $pacienteId,
        'tipo' => $tipo,
        'v' => $valor,
        'n' => $valorNormalizado,
    ]);
    return 'inserted';
}

/**
 * Añade contacto secundario si no existe (no toca el principal).
 *
 * @return 'inserted'|'unchanged'|'skipped'
 */

/**
 * Añade contacto secundario si no existe (no toca el principal).
 *
 * @return 'inserted'|'unchanged'|'skipped'
 */
function kinesica_rel_add_secondary_contacto(
    PDO $pdo,
    int $pacienteId,
    string $tipo,
    string $valor,
    string $valorNormalizado
): string {
    if ($pacienteId <= 0 || $valor === '' || $valorNormalizado === '') {
        return 'skipped';
    }
    if (!kinesica_rel_contactos_ready($pdo)) {
        return 'skipped';
    }
    $find = $pdo->prepare(
        'SELECT id FROM paciente_contactos
         WHERE paciente_id = :pid AND tipo = :tipo AND valor_normalizado = :norm LIMIT 1'
    );
    $find->execute(['pid' => $pacienteId, 'tipo' => $tipo, 'norm' => $valorNormalizado]);
    if ($find->fetchColumn()) {
        return 'unchanged';
    }
    $pdo->prepare(
        'INSERT INTO paciente_contactos (paciente_id, tipo, valor, valor_normalizado, es_principal)
         VALUES (:pid, :tipo, :v, :n, 0)'
    )->execute([
        'pid' => $pacienteId,
        'tipo' => $tipo,
        'v' => $valor,
        'n' => $valorNormalizado,
    ]);
    return 'inserted';
}

/**
 * Sincroniza contactos desde campos legacy de un paciente.
 *
 * @param array{telefono?:string,email?:string,contacto_telefono?:string,contacto_email?:string} $fields
 * @return array{telefono:string,email:string,secundarios:int}
 */

/**
 * Sincroniza contactos desde campos legacy de un paciente.
 *
 * @param array{telefono?:string,email?:string,contacto_telefono?:string,contacto_email?:string} $fields
 * @return array{telefono:string,email:string,secundarios:int}
 */
function kinesica_rel_sync_paciente_contactos(PDO $pdo, int $pacienteId, array $fields): array
{
    $out = ['telefono' => 'skipped', 'email' => 'skipped', 'secundarios' => 0];
    if ($pacienteId <= 0 || !kinesica_rel_contactos_ready($pdo)) {
        return $out;
    }

    $telRaw = (string) ($fields['telefono'] ?? '');
    if ($telRaw !== '' && !is_placeholder_phone($telRaw)) {
        $norm = clean_phone_number($telRaw);
        if ($norm !== '') {
            $out['telefono'] = kinesica_rel_set_principal_contacto($pdo, $pacienteId, 'telefono', $norm, $norm);
        }
    }

    $emailRaw = (string) ($fields['email'] ?? '');
    $emailNorm = kinesica_rel_normalize_email($emailRaw);
    if ($emailNorm !== '') {
        $out['email'] = kinesica_rel_set_principal_contacto($pdo, $pacienteId, 'email', $emailNorm, $emailNorm);
    }

    $cTel = (string) ($fields['contacto_telefono'] ?? '');
    if ($cTel !== '' && !is_placeholder_phone($cTel)) {
        $cNorm = clean_phone_number($cTel);
        $principalTel = clean_phone_number($telRaw);
        if ($cNorm !== '' && $cNorm !== $principalTel) {
            $r = kinesica_rel_add_secondary_contacto($pdo, $pacienteId, 'telefono', $cNorm, $cNorm);
            if ($r === 'inserted') {
                $out['secundarios']++;
            }
        }
    }

    $cEmail = kinesica_rel_normalize_email((string) ($fields['contacto_email'] ?? ''));
    if ($cEmail !== '' && $cEmail !== $emailNorm) {
        $r = kinesica_rel_add_secondary_contacto($pdo, $pacienteId, 'email', $cEmail, $cEmail);
        if ($r === 'inserted') {
            $out['secundarios']++;
        }
    }

    return $out;
}

/**
 * Sync best-effort tras write de pacientes (no lanza al caller).
 */

/**
 * Sync best-effort tras write de pacientes (no lanza al caller).
 */
function kinesica_rel_sync_paciente_contactos_safe(PDO $pdo, int $pacienteId, array $fields): void
{
    try {
        kinesica_rel_sync_paciente_contactos($pdo, $pacienteId, $fields);
    } catch (Throwable $e) {
        error_log('kinesica rel contactos sync: ' . $e->getMessage());
    }
}

/**
 * Backfill desde todos los pacientes.
 *
 * @return array{
 *   table:string,scanned:int,synced:int,skipped:int,errors:int,skipped_no_column:bool,samples:list<array>
 * }
 */
