<?php
declare(strict_types=1);

/**
 * Alta pacientes (rama sin match previo).
 */
function kinesica_pacientes_upsert_insert(
    PDO $pdo, string $phone, string $nombre, string $apellido, string $nombreCompleto, string $nombrePila,
    ?string $dni, ?string $email, string $profesional, ?string $motivo, ?string $notas, string $origen,
    ?string $contactoNombre, ?string $contactoTel, ?string $contactoEmail, ?string $contactoNotas, int $dejoReview
): void {
    $stmt = $pdo->prepare('
        INSERT INTO pacientes (
            telefono, nombre, apellido, nombre_completo, nombre_pila, dni, email, profesional_habitual, 
            motivo_consulta, notas, origen, contacto_nombre, contacto_telefono, contacto_email, contacto_notas, dejo_review
        ) VALUES (
            :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :email, :profesional_habitual, 
            :motivo_consulta, :notas, :origen, :contacto_nombre, :contacto_telefono, :contacto_email, :contacto_notas, :dejo_review
        )
        ON DUPLICATE KEY UPDATE
            nombre = CASE WHEN VALUES(nombre) != "" THEN VALUES(nombre) ELSE nombre END,
            apellido = CASE WHEN VALUES(apellido) != "" THEN VALUES(apellido) ELSE apellido END,
            nombre_completo = VALUES(nombre_completo),
            nombre_pila = VALUES(nombre_pila),
            dni = COALESCE(VALUES(dni), dni),
            email = COALESCE(VALUES(email), email),
            profesional_habitual = CASE WHEN VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END,
            motivo_consulta = COALESCE(VALUES(motivo_consulta), motivo_consulta),
            notas = COALESCE(VALUES(notas), notas),
            contacto_nombre = COALESCE(VALUES(contacto_nombre), contacto_nombre),
            contacto_telefono = COALESCE(VALUES(contacto_telefono), contacto_telefono),
            contacto_email = COALESCE(VALUES(contacto_email), contacto_email),
            contacto_notas = COALESCE(VALUES(contacto_notas), contacto_notas),
            dejo_review = CASE WHEN VALUES(dejo_review) = 1 THEN 1 ELSE dejo_review END
    ');

    try {
        $stmt->execute([
            'telefono' => $phone, 'nombre' => $nombre, 'apellido' => $apellido,
            'nombre_completo' => $nombreCompleto, 'nombre_pila' => $nombrePila,
            'dni' => $dni, 'email' => $email, 'profesional_habitual' => $profesional,
            'motivo_consulta' => $motivo, 'notas' => $notas, 'origen' => $origen,
            'contacto_nombre' => $contactoNombre, 'contacto_telefono' => $contactoTel,
            'contacto_email' => $contactoEmail, 'contacto_notas' => $contactoNotas,
            'dejo_review' => $dejoReview,
        ]);
    } catch (Throwable $e) {
        error_log('kinesica pacientes upsert insert: ' . $e->getMessage());
        json_out(500, ['status' => 'error', 'message' => 'No se pudo crear el paciente: ' . $e->getMessage()]);
    }

    $newId = (int) $pdo->lastInsertId();
    if ($newId <= 0) {
        // ON DUPLICATE KEY UPDATE no genera lastInsertId; recuperar por teléfono.
        $find = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel LIMIT 1');
        $find->execute(['tel' => $phone]);
        $newId = (int) ($find->fetchColumn() ?: 0);
    }
    error_log('kinesica pacientes upsert inserted/updated id=' . $newId . ' phone=' . $phone);
    if ($newId > 0) {
        // REL: sync contactos tras alta/upsert (lib_relational_contactos.php).
        require_once __DIR__ . '/lib_relational_contactos.php';
        kinesica_rel_sync_paciente_contactos_safe($pdo, $newId, [
            'telefono' => $phone,
            'email' => (string) ($email ?? ''),
            'contacto_telefono' => (string) ($contactoTel ?? ''),
            'contacto_email' => (string) ($contactoEmail ?? ''),
        ]);
    }
    json_out(200, [
        'status' => 'success',
        'action' => 'upsert',
        'merged' => false,
        'id' => $newId,
        'phone' => $phone,
        'nombre' => $nombre,
        'apellido' => $apellido,
        'nombre_pila' => $nombrePila,
        'email' => $email,
    ]);
}

}
