<?php
declare(strict_types=1);

/**
 * Script de deduplicación y consolidación de pacientes en Kinésica.
 * Uso CLI: php scripts/deduplicate-pacientes.php
 *
 * Reglas de consolidación:
 * 1. "si uno dice con review y otro sin, queda que si"
 * 2. "si uno dice indistinto y otro dice con tal, queda tal"
 * 3. Teléfono real prevalece sobre placeholder (sin-tel-...)
 * 4. DNI, email, motivos y notas se preservan y consolidan.
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib.php';
require_once $root . '/admin/api/pacientes_helpers.php';

echo "=== Kinésica: Deduplicación y Consolidación de Directorio de Pacientes ===\n";

try {
    $pdo = db();
    echo "✓ Conectado a la base de datos.\n";

    ensure_pacientes_tables($pdo);

    $countBefore = (int) $pdo->query('SELECT COUNT(*) FROM pacientes')->fetchColumn();
    echo "• Total pacientes antes de deduplicar: $countBefore\n";

    $merged = deduplicate_pacientes_table($pdo);

    $countAfter = (int) $pdo->query('SELECT COUNT(*) FROM pacientes')->fetchColumn();
    echo "✓ Deduplicación completada: $merged registros duplicados unificados.\n";
    echo "• Total pacientes después de deduplicar: $countAfter\n";

    if ($merged > 0) {
        echo "✓ Base de pacientes consolidada exitosamente.\n";
    } else {
        echo "✓ El directorio ya se encontraba completamente deduplicado.\n";
    }
} catch (Throwable $e) {
    echo "✗ Error al conectar o deduplicar: " . $e->getMessage() . "\n";
    exit(1);
}
