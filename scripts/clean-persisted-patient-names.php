<?php
declare(strict_types=1);

/**
 * Script de limpieza y migración para eliminar comas, emojis y saltos de línea
 * en campos de nombres y apellidos de pacientes y fichas persistidas.
 * Uso CLI: php scripts/clean-persisted-patient-names.php
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib.php';
require_once $root . '/admin/api/pacientes_helpers.php';

echo "=== Kinésica: Limpieza de nombres persistidos (comas, emojis, saltos de línea) ===\n";

// 1. Limpieza en archivos locales (ej. interacciones.json)
$interaccionesFile = $root . '/admin/api/data/interacciones.json';
if (is_file($interaccionesFile)) {
    $raw = file_get_contents($interaccionesFile);
    $data = json_decode($raw ?: '[]', true);
    if (is_array($data)) {
        $changed = 0;
        foreach ($data as &$item) {
            if (!empty($item['patient_name'])) {
                $clean = sanitize_patient_name((string) $item['patient_name']);
                if ($clean !== $item['patient_name']) {
                    $item['patient_name'] = $clean;
                    $changed++;
                }
            }
        }
        unset($item);
        if ($changed > 0) {
            file_put_contents($interaccionesFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            echo "✓ interacciones.json: $changed nombres de pacientes limpiados.\n";
        } else {
            echo "✓ interacciones.json: 0 registros con caracteres inválidos.\n";
        }
    }
}

// 2. Limpieza en Base de Datos (si hay conexión disponible)
try {
    $pdo = db();
    echo "✓ Conectado a la base de datos.\n";

    // A. Tabla pacientes
    $pacientesUpdated = 0;
    $stmt = $pdo->query("SELECT id, nombre, apellido, nombre_completo, contacto_nombre FROM pacientes");
    if ($stmt) {
        $updateStmt = $pdo->prepare("UPDATE pacientes SET nombre = :nom, apellido = :ape, nombre_completo = :full, nombre_pila = :pila, contacto_nombre = :cont WHERE id = :id");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $id = (int) $row['id'];
            $nom = sanitize_patient_name($row['nombre'] ?? '');
            $ape = sanitize_patient_name($row['apellido'] ?? '');
            $full = sanitize_patient_name($row['nombre_completo'] ?? '');
            $cont = isset($row['contacto_nombre']) && $row['contacto_nombre'] !== null ? sanitize_patient_name($row['contacto_nombre']) : null;
            if ($nom !== $row['nombre'] || $ape !== $row['apellido'] || $full !== $row['nombre_completo'] || $cont !== ($row['contacto_nombre'] ?? null)) {
                $pila = extract_first_name($full);
                $updateStmt->execute(['id' => $id, 'nom' => $nom, 'ape' => $ape, 'full' => $full, 'pila' => $pila, 'cont' => $cont]);
                $pacientesUpdated++;
            }
        }
    }
    echo "✓ Tabla pacientes: $pacientesUpdated registros saneados.\n";

    // B. Tabla lista_espera
    $esperaUpdated = 0;
    $stmtEsp = $pdo->query("SELECT id, paciente_nombre FROM lista_espera");
    if ($stmtEsp) {
        $updateEsp = $pdo->prepare("UPDATE lista_espera SET paciente_nombre = :nom WHERE id = :id");
        while ($row = $stmtEsp->fetch(PDO::FETCH_ASSOC)) {
            $id = (int) $row['id'];
            $cleanNom = sanitize_patient_name($row['paciente_nombre'] ?? '');
            if ($cleanNom !== $row['paciente_nombre']) {
                $updateEsp->execute(['id' => $id, 'nom' => $cleanNom]);
                $esperaUpdated++;
            }
        }
    }
    echo "✓ Tabla lista_espera: $esperaUpdated registros saneados.\n";

    // C. Tabla fichas
    $fichasUpdated = 0;
    $stmtFichas = $pdo->query("SELECT id, payload FROM fichas");
    if ($stmtFichas) {
        $updateFicha = $pdo->prepare("UPDATE fichas SET payload = :payload WHERE id = :id");
        while ($row = $stmtFichas->fetch(PDO::FETCH_ASSOC)) {
            $payload = json_decode($row['payload'] ?? '{}', true);
            if (is_array($payload) && isset($payload['nombre'])) {
                $cleanNom = sanitize_patient_name((string) $payload['nombre']);
                if ($cleanNom !== $payload['nombre']) {
                    $payload['nombre'] = $cleanNom;
                    $updateFicha->execute(['id' => (string) $row['id'], 'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
                    $fichasUpdated++;
                }
            }
        }
    }
    echo "✓ Tabla fichas: $fichasUpdated historias clínicas saneadas.\n";

} catch (Throwable $e) {
    echo "ℹ️ Nota: No se pudo conectar a la base de datos local ({$e->getMessage()}).\n";
    echo "  El trigger automático se ejecutará en Hostinger al conectar en producción.\n";
}

echo "=== Limpieza completada ===\n";
