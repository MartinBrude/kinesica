<?php
declare(strict_types=1);


/**
 * Mantenimiento pesado del directorio (sanitize + sync fichas + dedupe + indistintos).
 * Throttle por marker file para no bloquear POST insert/upsert del admin.
 */
function kinesica_pacientes_run_maintenance_if_due(PDO $pdo, bool $force = false): void
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $marker = $dir . '/.pacientes_maintenance';
    $ttlSeconds = 6 * 3600;
    if (!$force && is_file($marker)) {
        $age = time() - (int) @filemtime($marker);
        if ($age >= 0 && $age < $ttlSeconds) {
            return;
        }
    }

    try {
        $pdo->exec("DELETE FROM pacientes WHERE LOWER(nombre_completo) LIKE '%tk3%' OR LOWER(nombre_completo) LIKE '%tk 3%' OR LOWER(nombre) LIKE '%tk3%' OR LOWER(nombre) LIKE '%tk 3%' OR LOWER(nombre_completo) LIKE '%no dar%' OR LOWER(nombre) LIKE '%no dar%' OR LOWER(apellido) LIKE '%no dar%'");

        $pdo->exec("UPDATE pacientes SET 
            nombre = TRIM(REPLACE(REPLACE(REPLACE(nombre, '\r', ' '), '\n', ' '), ',', '')),
            apellido = TRIM(REPLACE(REPLACE(REPLACE(apellido, '\r', ' '), '\n', ' '), ',', '')),
            nombre_completo = TRIM(REPLACE(REPLACE(REPLACE(nombre_completo, '\r', ' '), '\n', ' '), ',', '')),
            nombre_pila = TRIM(REPLACE(REPLACE(REPLACE(nombre_pila, '\r', ' '), '\n', ' '), ',', '')),
            contacto_nombre = CASE WHEN contacto_nombre IS NOT NULL THEN TRIM(REPLACE(REPLACE(REPLACE(contacto_nombre, '\r', ' '), '\n', ' '), ',', '')) ELSE NULL END
        WHERE nombre LIKE '%,%' OR nombre LIKE '%\n%' OR nombre LIKE '%\r%'
           OR apellido LIKE '%,%' OR apellido LIKE '%\n%' OR apellido LIKE '%\r%'
           OR nombre_completo LIKE '%,%' OR nombre_completo LIKE '%\n%' OR nombre_completo LIKE '%\r%'
           OR contacto_nombre LIKE '%,%' OR contacto_nombre LIKE '%\n%' OR contacto_nombre LIKE '%\r%'");

        $pdo->exec("UPDATE lista_espera SET
            paciente_nombre = TRIM(REPLACE(REPLACE(REPLACE(paciente_nombre, '\r', ' '), '\n', ' '), ',', ''))
        WHERE paciente_nombre LIKE '%,%' OR paciente_nombre LIKE '%\n%' OR paciente_nombre LIKE '%\r%'");

        $stmtSanitize = $pdo->query("SELECT id, nombre, apellido, nombre_completo, contacto_nombre FROM pacientes");
        if ($stmtSanitize) {
            $updateStmt = $pdo->prepare("UPDATE pacientes SET nombre = :nom, apellido = :ape, nombre_completo = :full, nombre_pila = :pila, contacto_nombre = :cont WHERE id = :id");
            while ($row = $stmtSanitize->fetch(PDO::FETCH_ASSOC)) {
                $nom = sanitize_patient_name($row['nombre'] ?? '');
                $ape = sanitize_patient_name($row['apellido'] ?? '');
                $full = sanitize_patient_name($row['nombre_completo'] ?? '');
                $cont = isset($row['contacto_nombre']) && $row['contacto_nombre'] !== null ? sanitize_patient_name($row['contacto_nombre']) : null;
                if ($nom !== $row['nombre'] || $ape !== $row['apellido'] || $full !== $row['nombre_completo'] || $cont !== ($row['contacto_nombre'] ?? null)) {
                    $pila = extract_first_name($full);
                    $updateStmt->execute(['id' => (int) $row['id'], 'nom' => $nom, 'ape' => $ape, 'full' => $full, 'pila' => $pila, 'cont' => $cont]);
                }
            }
        }

        try {
            $stmtSanitizeEsp = $pdo->query("SELECT id, paciente_nombre FROM lista_espera");
            if ($stmtSanitizeEsp) {
                $updateEspStmt = $pdo->prepare("UPDATE lista_espera SET paciente_nombre = :nom WHERE id = :id");
                while ($row = $stmtSanitizeEsp->fetch(PDO::FETCH_ASSOC)) {
                    $cleanNom = sanitize_patient_name($row['paciente_nombre'] ?? '');
                    if ($cleanNom !== ($row['paciente_nombre'] ?? '')) {
                        $updateEspStmt->execute(['id' => (int) $row['id'], 'nom' => $cleanNom]);
                    }
                }
            }
        } catch (Throwable) {
        }

        try {
            $stmtSanitizeFichas = $pdo->query("SELECT id, payload FROM fichas");
            if ($stmtSanitizeFichas) {
                $updateFichaStmt = $pdo->prepare("UPDATE fichas SET payload = :p WHERE id = :id");
                while ($row = $stmtSanitizeFichas->fetch(PDO::FETCH_ASSOC)) {
                    $payload = json_decode((string) ($row['payload'] ?? ''), true);
                    if (is_array($payload) && isset($payload['nombre'])) {
                        $cleanNom = sanitize_patient_name((string) $payload['nombre']);
                        if ($cleanNom !== $payload['nombre']) {
                            $payload['nombre'] = $cleanNom;
                            $updateFichaStmt->execute(['id' => (string) $row['id'], 'p' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
                        }
                    }
                }
            }
        } catch (Throwable) {
        }
    } catch (Throwable) {
    }

    try {
        sync_pacientes_from_fichas($pdo, null, null, null, $force);
    } catch (Throwable) {
    }
    try {
        deduplicate_pacientes_table($pdo);
    } catch (Throwable) {
    }
    try {
        resolve_indistinto_pacientes_from_calendar($pdo);
    } catch (Throwable) {
    }

    @file_put_contents($marker, (string) time());
}

/**
 * Sincroniza pacientes desde las historias clínicas (`fichas`) hacia la tabla `pacientes`.
 * Si se pasa $singleId o $singlePayload, sincroniza una ficha puntual; de lo contrario procesa todas.
 */
