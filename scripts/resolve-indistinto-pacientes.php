<?php
declare(strict_types=1);

/**
 * Script CLI para inferir y resolver pacientes con 'profesional_habitual = indistinto'
 * en función del calendario oficial de Google Calendar y horarios de consultorio.
 * 
 * Regla de camilla única (1 sola camilla física, sin solapamiento):
 * - Miércoles: Norberto exclusivo (09:00 a 16:30).
 * - Jueves: Norberto exclusivo (15:00 a 19:00).
 * - Lunes: María 09:00 a 17:00 | Norberto 17:30 a 19:30.
 * - Martes: María 09:00 a 16:00 | Norberto 16:30 a 19:30.
 * - Viernes: María 09:00 a 13:00 | Norberto 13:30 a 19:30.
 * - Creador norberto1712@gmail.com -> Norberto.
 * - Creador manosmagicas7116@gmail.com -> María.
 *
 * Uso: php scripts/resolve-indistinto-pacientes.php
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib.php';
require_once $root . '/admin/api/pacientes_helpers.php';

echo "=== Kinésica: Resolución de Profesionales Indistintos por Horario/Calendario ===\n";

try {
    $pdo = db();
    echo "✓ Conectado a la base de datos de Kinésica.\n";

    ensure_pacientes_tables($pdo);

    $indistintosBefore = (int) $pdo->query("SELECT COUNT(*) FROM pacientes WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''")->fetchColumn();
    echo "• Pacientes con profesional indistinto antes de resolver: $indistintosBefore\n";

    $resolved = resolve_indistinto_pacientes_from_calendar($pdo);
    echo "✓ Pacientes actualizados con profesional habitual según calendario/horario: $resolved\n";

    $indistintosAfter = (int) $pdo->query("SELECT COUNT(*) FROM pacientes WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''")->fetchColumn();
    echo "• Pacientes con profesional indistinto restantes: $indistintosAfter\n";

    $stmtProfs = $pdo->query("SELECT profesional_habitual, COUNT(*) as cnt FROM pacientes GROUP BY profesional_habitual");
    echo "• Distribución actual de pacientes por profesional:\n";
    while ($row = $stmtProfs->fetch(PDO::FETCH_ASSOC)) {
        echo "  - {$row['profesional_habitual']}: {$row['cnt']}\n";
    }

} catch (Throwable $e) {
    echo "ℹ Nota: No se pudo conectar a la base de datos remota desde CLI local: " . $e->getMessage() . "\n";
    echo "  (La resolución automática se ejecutará de forma nativa en Hostinger en el próximo despliegue).\n";
}
