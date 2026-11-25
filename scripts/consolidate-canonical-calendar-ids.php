<?php
declare(strict_types=1);

/**
 * Script de consolidación y normalización histórica de calendar_event_id.
 *
 * Unifica identificadores de Google Calendar eliminando el sufijo '@google.com'
 * tanto en la tabla 'turnos' como en 'recordatorio_eventos'.
 *
 * Maneja de forma segura duplicados en 'turnos':
 * - Si existe 'xyz@google.com' y NO existe 'xyz': renombra a 'xyz'.
 * - Si existen ambos ('xyz' y 'xyz@google.com'): consolida campos no nulos,
 *   reasigna los recordatorios apuntados al ID duplicado y elimina la fila redundante.
 *
 * Uso CLI:
 *   php scripts/consolidate-canonical-calendar-ids.php            (Modo dry-run, solo diagnóstico)
 *   php scripts/consolidate-canonical-calendar-ids.php --apply    (Aplica los cambios en transacción)
 */

$root = dirname(__DIR__);
require_once $root . '/admin/api/lib_migrations.php';
require_once $root . '/admin/api/lib_relational_turnos.php';
require_once $root . '/admin/api/lib_relational_turnos_turnos_ready.php';

/**
 * @return array{
 *   dry_run: bool,
 *   turnos_scanned: int,
 *   turnos_renamed: int,
 *   turnos_merged: int,
 *   recordatorios_scanned: int,
 *   recordatorios_renamed: int,
 *   recordatorios_linked: int,
 *   details: list<string>
 * }
 */
function kinesica_consolidate_calendar_ids(PDO $pdo, bool $apply = false): array
{
    $report = [
        'dry_run' => !$apply,
        'turnos_scanned' => 0,
        'turnos_renamed' => 0,
        'turnos_merged' => 0,
        'recordatorios_scanned' => 0,
        'recordatorios_renamed' => 0,
        'recordatorios_linked' => 0,
        'details' => [],
    ];

    $hasTurnos = kinesica_migrations_table_exists($pdo, 'turnos');
    $hasRecordatorios = kinesica_migrations_table_exists($pdo, 'recordatorio_eventos');
    $hasTurnosCalCol = $hasTurnos && kinesica_migrations_column_exists($pdo, 'turnos', 'calendar_event_id');
    $hasRecCalCol = $hasRecordatorios && kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'calendar_event_id');
    $hasTurnoIdCol = $hasRecordatorios && kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id');

    if (!$hasTurnosCalCol && !$hasRecCalCol) {
        $report['details'][] = 'No se encontraron las tablas o columnas calendar_event_id necesarias.';
        return $report;
    }

    $inTx = false;
    if ($apply && !$pdo->inTransaction()) {
        $pdo->beginTransaction();
        $inTx = true;
    }

    try {
        // 1. CONSOLIDAR TABLA TURNOS
        if ($hasTurnosCalCol) {
            $stmt = $pdo->query(
                "SELECT id, calendar_event_id, paciente_id, profesional_id, starts_at, ends_at, status, summary
                 FROM turnos
                 WHERE calendar_event_id LIKE '%@google.com%' OR calendar_event_id LIKE '%@GOOGLE.COM%'"
            );
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $report['turnos_scanned'] = count($rows);

            $findBase = $pdo->prepare('SELECT id, paciente_id, profesional_id, status, summary FROM turnos WHERE calendar_event_id = :base LIMIT 1');
            $updTurno = $apply ? $pdo->prepare('UPDATE turnos SET calendar_event_id = :base WHERE id = :id') : null;
            $delTurno = $apply ? $pdo->prepare('DELETE FROM turnos WHERE id = :id') : null;
            $relinkRecs = ($apply && $hasTurnoIdCol) ? $pdo->prepare('UPDATE recordatorio_eventos SET turno_id = :master_id WHERE turno_id = :dup_id') : null;
            $mergeTurno = $apply ? $pdo->prepare(
                'UPDATE turnos SET
                    paciente_id = COALESCE(paciente_id, :paciente_id),
                    profesional_id = COALESCE(profesional_id, :profesional_id),
                    summary = CASE WHEN summary = \'\' OR summary IS NULL THEN :summary ELSE summary END
                 WHERE id = :id'
            ) : null;

            foreach ($rows as $row) {
                $rawId = (string) $row['calendar_event_id'];
                $baseId = str_ireplace('@google.com', '', $rawId);
                if ($baseId === '') {
                    continue;
                }

                $findBase->execute(['base' => $baseId]);
                $existing = $findBase->fetch(PDO::FETCH_ASSOC);

                if ($existing) {
                    // Conflicto: existen 'base' y 'base@google.com'
                    $masterId = (int) $existing['id'];
                    $dupId = (int) $row['id'];

                    $report['turnos_merged']++;
                    $report['details'][] = "Turno duplicado consolidado: {$rawId} (ID {$dupId}) -> base ID {$masterId}";

                    if ($apply) {
                        // Reasignar recordatorios dependientes
                        if ($relinkRecs) {
                            $relinkRecs->execute(['master_id' => $masterId, 'dup_id' => $dupId]);
                        }
                        // Fusionar datos faltantes en el turno maestro
                        if ($mergeTurno) {
                            $mergeTurno->execute([
                                'paciente_id' => $row['paciente_id'],
                                'profesional_id' => $row['profesional_id'],
                                'summary' => $row['summary'],
                                'id' => $masterId,
                            ]);
                        }
                        // Eliminar fila duplicada
                        if ($delTurno) {
                            $delTurno->execute(['id' => $dupId]);
                        }
                    }
                } else {
                    // Sin conflicto: solo renombrar a formato canónico
                    $report['turnos_renamed']++;
                    $report['details'][] = "Turno renombrado a canónico: {$rawId} -> {$baseId} (ID {$row['id']})";

                    if ($apply && $updTurno) {
                        $updTurno->execute(['base' => $baseId, 'id' => $row['id']]);
                    }
                }
            }
        }

        // 2. CONSOLIDAR TABLA RECORDATORIO_EVENTOS
        if ($hasRecCalCol) {
            $stmt = $pdo->query(
                "SELECT id, calendar_event_id, turno_id
                 FROM recordatorio_eventos
                 WHERE calendar_event_id LIKE '%@google.com%' OR calendar_event_id LIKE '%@GOOGLE.COM%'"
            );
            $recs = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $report['recordatorios_scanned'] = count($recs);

            $updRec = $apply ? $pdo->prepare('UPDATE recordatorio_eventos SET calendar_event_id = :base WHERE id = :id') : null;

            foreach ($recs as $rec) {
                $rawId = (string) $rec['calendar_event_id'];
                $baseId = str_ireplace('@google.com', '', $rawId);
                if ($baseId === '') {
                    continue;
                }
                $report['recordatorios_renamed']++;
                if ($apply && $updRec) {
                    $updRec->execute(['base' => $baseId, 'id' => $rec['id']]);
                }
            }

            // 3. VINCULAR RECORDATORIOS SIN TURNO_ID
            if ($hasTurnoIdCol && $hasTurnos) {
                $stmtNull = $pdo->query('SELECT id, calendar_event_id FROM recordatorio_eventos WHERE turno_id IS NULL');
                $unlinked = $stmtNull ? ($stmtNull->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

                $findMaster = $pdo->prepare(
                    "SELECT id FROM turnos
                     WHERE calendar_event_id = :c OR calendar_event_id = :c_google
                     LIMIT 1"
                );
                $linkStmt = $apply ? $pdo->prepare('UPDATE recordatorio_eventos SET turno_id = :tid WHERE id = :id') : null;

                foreach ($unlinked as $u) {
                    $cid = trim((string) ($u['calendar_event_id'] ?? ''));
                    if ($cid === '') {
                        continue;
                    }
                    $base = str_ireplace('@google.com', '', $cid);
                    $findMaster->execute(['c' => $base, 'c_google' => $base . '@google.com']);
                    $tid = $findMaster->fetchColumn();
                    if ($tid) {
                        $report['recordatorios_linked']++;
                        if ($apply && $linkStmt) {
                            $linkStmt->execute(['tid' => (int) $tid, 'id' => $u['id']]);
                        }
                    }
                }
            }
        }

        if ($inTx) {
            $pdo->commit();
            $inTx = false;
        }
    } catch (Throwable $e) {
        if ($inTx) {
            $pdo->rollBack();
        }
        throw $e;
    }

    return $report;
}

// Ejecución vía CLI directa
if (PHP_SAPI === 'cli' && realpath($argv[0] ?? '') === __FILE__) {
    echo "=== Kinésica: Consolidación Canónica de calendar_event_id ===\n";

    $apply = in_array('--apply', $argv, true);
    if (!$apply) {
        echo "MODO: DRY-RUN (simulación segura, no se modificará ninguna fila)\n";
        echo "Para aplicar los cambios reales ejecutá con: --apply\n\n";
    } else {
        echo "MODO: APPLY (aplicando cambios en transacción atómica)\n\n";
    }

    try {
        require_once $root . '/admin/api/lib_db_config_candidate_paths.php';
        $pdo = db();
        echo "✓ Conectado a la base de datos.\n";

        $res = kinesica_consolidate_calendar_ids($pdo, $apply);

        echo "\n--- Resumen de Consolidación ---\n";
        echo "• Turnos escaneados con @google.com: {$res['turnos_scanned']}\n";
        echo "• Turnos renombrados a formato canónico: {$res['turnos_renamed']}\n";
        echo "• Turnos duplicados fusionados: {$res['turnos_merged']}\n";
        echo "• Recordatorios escaneados con @google.com: {$res['recordatorios_scanned']}\n";
        echo "• Recordatorios renombrados a formato canónico: {$res['recordatorios_renamed']}\n";
        echo "• Recordatorios vinculados a turnos (turno_id): {$res['recordatorios_linked']}\n";

        if (!empty($res['details'])) {
            echo "\nDetalle de operaciones:\n";
            foreach (array_slice($res['details'], 0, 50) as $line) {
                echo "  - $line\n";
            }
            if (count($res['details']) > 50) {
                echo "  ... y " . (count($res['details']) - 50) . " operaciones más.\n";
            }
        }

        if ($res['dry_run']) {
            echo "\n✓ Simulación finalizada con éxito. Si los cambios son correctos, ejecutá con --apply.\n";
        } else {
            echo "\n✓ Cambios aplicados y confirmados en la base de datos exitosamente.\n";
        }
    } catch (Throwable $e) {
        echo "\n✗ Error durante la consolidación: " . $e->getMessage() . "\n";
        exit(1);
    }
}
