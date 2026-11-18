<?php
declare(strict_types=1);

/**
 * Resuelve email por teléfono sin LIKE ambiguo de sufijos.
 * 1) Match exacto (activo). 2) Sufijo de 8 dígitos solo si hay exactamente 1 candidato.
 *
 * @return array{status:string,email:string}
 */
function kinesica_pacientes_email_by_phone(PDO $pdo, string $rawPhone): array
{
    $phone = clean_phone_number($rawPhone);
    if ($phone === '') {
        return ['status' => 'not_found', 'email' => ''];
    }

    $alive = function_exists('kinesica_pacientes_alive_sql')
        ? kinesica_pacientes_alive_sql($pdo)
        : '1=1';

    $stmt = $pdo->prepare("SELECT email FROM pacientes WHERE telefono = :tel AND ({$alive}) LIMIT 1");
    $stmt->execute(['tel' => $phone]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row['email'])) {
        return ['status' => 'success', 'email' => (string) $row['email']];
    }

    $suffix = substr($phone, -8);
    if (strlen($suffix) < 8) {
        return ['status' => 'not_found', 'email' => ''];
    }

    $stmt = $pdo->prepare(
        "SELECT email FROM pacientes
         WHERE ({$alive})
           AND email IS NOT NULL AND email != ''
           AND telefono LIKE :tel_end
         LIMIT 2"
    );
    $stmt->execute(['tel_end' => '%' . $suffix]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    if (count($rows) === 1 && !empty($rows[0]['email'])) {
        return ['status' => 'success', 'email' => (string) $rows[0]['email']];
    }

    return ['status' => 'not_found', 'email' => ''];
}
