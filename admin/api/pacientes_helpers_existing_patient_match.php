<?php
declare(strict_types=1);

/**
 * Match de alta (strict) + re-exports alive / merge phone.
 * Dedupe full: pacientes_helpers_dedupe_full.php
 */

require_once __DIR__ . '/pacientes_helpers_alive.php';
require_once __DIR__ . '/pacientes_helpers_match_steps.php';
require_once __DIR__ . '/pacientes_helpers_match.php';

/**
 * Busca paciente activo por tel / DNI / nombre (≥2 tokens). Soft-deleted ignorados.
 *
 * @return array<string,mixed>|null
 */
function find_existing_patient_match(PDO $pdo, ?string $phone, ?string $name = null, ?string $dni = null): ?array
{
    return kinesica_match_patient($pdo, [
        'phone' => $phone,
        'name' => $name,
        'dni' => $dni,
    ], 'strict');
}
