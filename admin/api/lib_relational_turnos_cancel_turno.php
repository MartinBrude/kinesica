<?php
declare(strict_types=1);


/**
 * Cancela un turno sombra y anula recordatorios pending vinculados.
 *
 * @param array{calendar_event_id?:string,turno_id?:int} $ref
 * @return array{ok:bool,turno_id:?int,calendar_event_id:string,reminders_updated:int,reason?:string}
 */
function kinesica_rel_cancel_turno(PDO $pdo, array $ref): array
{
    $out = [
        'ok' => false,
        'turno_id' => null,
        'calendar_event_id' => '',
        'reminders_updated' => 0,
    ];
    if (!kinesica_rel_turnos_ready($pdo)) {
        $out['reason'] = 'turnos_table_missing';
        return $out;
    }

    $turnoId = isset($ref['turno_id']) ? (int) $ref['turno_id'] : 0;
    $calId = kinesica_rel_normalize_calendar_event_id((string) ($ref['calendar_event_id'] ?? ''));

    if ($turnoId > 0) {
        $stmt = $pdo->prepare('SELECT id, calendar_event_id, status FROM turnos WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $turnoId]);
    } elseif ($calId !== '') {
        $stmt = $pdo->prepare('SELECT id, calendar_event_id, status FROM turnos WHERE calendar_event_id = :c LIMIT 1');
        $stmt->execute(['c' => $calId]);
    } else {
        $out['reason'] = 'missing_ref';
        return $out;
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        if ($calId !== '') {
            $tid = kinesica_rel_upsert_turno_by_calendar_event($pdo, [
                'calendar_event_id' => $calId,
                'status' => 'cancelled',
                'source' => 'manual',
            ]);
            $out['turno_id'] = $tid;
            $out['calendar_event_id'] = $calId;
            $out['reminders_updated'] = kinesica_rel_cancel_recordatorios_for_calendar_event($pdo, $calId, $tid);
            $out['ok'] = true;
            return $out;
        }
        $out['reason'] = 'not_found';
        return $out;
    }

    $turnoId = (int) $row['id'];
    $calId = kinesica_rel_normalize_calendar_event_id((string) $row['calendar_event_id']);
    $pdo->prepare(
        'UPDATE turnos SET status = \'cancelled\', updated_at = CURRENT_TIMESTAMP WHERE id = :id'
    )->execute(['id' => $turnoId]);

    $out['turno_id'] = $turnoId;
    $out['calendar_event_id'] = $calId;
    $out['reminders_updated'] = kinesica_rel_cancel_recordatorios_for_calendar_event($pdo, $calId, $turnoId);
    $out['ok'] = true;
    return $out;
}

/**
 * Marca recordatorios no terminales del evento como skipped/cancelled.
 */

/**
 * Marca recordatorios no terminales del evento como skipped/cancelled.
 */
function kinesica_rel_cancel_recordatorios_for_calendar_event(PDO $pdo, string $calId, ?int $turnoId = null): int
{
    $calId = kinesica_rel_normalize_calendar_event_id($calId);
    if ($calId === '' || !kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        return 0;
    }
    $updated = 0;
    try {
        $stmt = $pdo->prepare(
            'UPDATE recordatorio_eventos
             SET status = \'skipped\', skip_reason = \'cancelled\'
             WHERE calendar_event_id = :c
               AND status IN (\'pending\', \'missing_phone\', \'failed\')'
        );
        $stmt->execute(['c' => $calId]);
        $updated = $stmt->rowCount();

        if (
            $turnoId !== null
            && $turnoId > 0
            && kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id')
        ) {
            $link = $pdo->prepare(
                'UPDATE recordatorio_eventos SET turno_id = COALESCE(turno_id, :tid)
                 WHERE calendar_event_id = :c AND turno_id IS NULL'
            );
            $link->execute(['tid' => $turnoId, 'c' => $calId]);
        }
    } catch (Throwable $e) {
        error_log('kinesica rel cancel recordatorios: ' . $e->getMessage());
    }
    return $updated;
}
