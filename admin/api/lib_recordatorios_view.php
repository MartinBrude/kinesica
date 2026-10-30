<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_recordatorios_store.php';

const RECORDATORIOS_DEFAULT_DAYS = 14;

function recordatorios_tz(): DateTimeZone
{
    try {
        return new DateTimeZone('America/Argentina/Buenos_Aires');
    } catch (Throwable $e) {
        return new DateTimeZone('UTC');
    }
}

function recordatorios_status_label(string $status): string
{
    return match ($status) {
        'sent' => 'Enviado (WhatsApp)',
        'sent_email' => 'Enviado (email)',
        'failed' => 'Fallido',
        'missing_phone' => 'Sin teléfono ni mail',
        'skipped' => 'Omitido',
        'run_skipped' => 'Corrida omitida',
        default => $status,
    };
}

function recordatorios_skip_label(string $reason): string
{
    return match ($reason) {
        'clara_inactive' => 'Clara pausada',
        'cancelled' => 'Cancelado / anulado',
        'blocked' => 'Bloqueo / no disponible',
        'waitlist' => 'Lista de espera',
        'non_appointment' => 'No es un turno',
        'duplicate' => 'Duplicado en la corrida',
        'not_tomorrow' => 'Fuera de mañana',
        'other' => 'Otro',
        '' => '',
        default => $reason,
    };
}

/**
 * @return array{items:list,grouped:array,counts:array,total:int,days:int}
 */
function recordatorios_load_view(?PDO $pdo = null, int $days = RECORDATORIOS_DEFAULT_DAYS): array
{
    $pdo = recordatorios_pdo($pdo);
    recordatorios_ensure_schema($pdo);
    $days = max(1, min(90, $days));
    $since = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('-' . $days . ' days')
        ->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'SELECT id, event_key, exec_id, run_at, appointment_date, appointment_time, calendar_event_id,
                patient_name, wa_id, status, skip_reason, error_code, error_message, event_summary, received_at
         FROM recordatorio_eventos
         WHERE run_at >= :since
         ORDER BY run_at DESC, id DESC
         LIMIT 2000'
    );
    $stmt->execute(['since' => $since]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $tz = recordatorios_tz();
    $counts = [
        'sent' => 0,
        'sent_email' => 0,
        'failed' => 0,
        'missing_phone' => 0,
        'skipped' => 0,
        'run_skipped' => 0,
    ];
    $items = [];
    $grouped = [];

    foreach ($rows as $r) {
        $status = (string) ($r['status'] ?? '');
        if (isset($counts[$status])) {
            $counts[$status]++;
        }
        $runUtc = (string) ($r['run_at'] ?? '');
        $runDay = '';
        $runLocal = $runUtc;
        try {
            $dt = new DateTimeImmutable($runUtc . ' UTC');
            $local = $dt->setTimezone($tz);
            $runDay = $local->format('Y-m-d');
            $runLocal = $local->format('Y-m-d H:i');
        } catch (Throwable $e) {
            $runDay = substr($runUtc, 0, 10);
        }
        $item = [
            'id' => (string) ($r['id'] ?? ''),
            'event_key' => (string) ($r['event_key'] ?? ''),
            'exec_id' => (string) ($r['exec_id'] ?? ''),
            'run_at' => $runUtc,
            'run_at_local' => $runLocal,
            'run_day' => $runDay,
            'appointment_date' => $r['appointment_date'] !== null ? (string) $r['appointment_date'] : '',
            'appointment_time' => (string) ($r['appointment_time'] ?? ''),
            'calendar_event_id' => (string) ($r['calendar_event_id'] ?? ''),
            'patient_name' => (string) ($r['patient_name'] ?? ''),
            'wa_id' => (string) ($r['wa_id'] ?? ''),
            'status' => $status,
            'status_label' => recordatorios_status_label($status),
            'skip_reason' => (string) ($r['skip_reason'] ?? ''),
            'skip_reason_label' => recordatorios_skip_label((string) ($r['skip_reason'] ?? '')),
            'error_code' => (string) ($r['error_code'] ?? ''),
            'error_message' => (string) ($r['error_message'] ?? ''),
            'event_summary' => (string) ($r['event_summary'] ?? ''),
        ];
        $items[] = $item;
        if ($runDay === '') {
            $runDay = 'sin-fecha';
        }
        if (!isset($grouped[$runDay])) {
            $grouped[$runDay] = [];
        }
        $grouped[$runDay][] = $item;
    }

    return [
        'items' => $items,
        'grouped' => $grouped,
        'counts' => $counts,
        'total' => count($items),
        'days' => $days,
    ];
}
