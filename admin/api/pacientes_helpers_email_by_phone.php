<?php
declare(strict_types=1);

/**
 * Resuelve email por teléfono sin LIKE ambiguo de sufijos.
 * 1) Match exacto (activo). 2) Sufijo de 8 dígitos solo si hay exactamente 1 candidato con email.
 *
 * @return array{status:string,email:string}
 */
function kinesica_pacientes_email_by_phone(PDO $pdo, string $rawPhone): array
{
    require_once __DIR__ . '/pacientes_helpers_match.php';

    // Pasar raw: el motor limpia una sola vez (evitar doble clean → E.164 expandido).
    if (clean_phone_number($rawPhone) === '') {
        return ['status' => 'not_found', 'email' => ''];
    }

    $row = kinesica_match_patient($pdo, ['phone' => $rawPhone], 'email_suffix');
    if ($row && !empty($row['email'])) {
        return ['status' => 'success', 'email' => (string) $row['email']];
    }

    return ['status' => 'not_found', 'email' => ''];
}
