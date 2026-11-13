<?php
declare(strict_types=1);


/**
 * @return array{ok:bool,dry?:bool,processed:int,sent:int,sent_email:int,skipped:int,failed:int,missing_phone:int,error?:string,details?:list}
 */
function recordatorios_sameday_run(bool $dry = false): array
{
    $out = [
        'ok' => true,
        'dry' => $dry,
        'processed' => 0,
        'sent' => 0,
        'sent_email' => 0,
        'skipped' => 0,
        'failed' => 0,
        'missing_phone' => 0,
        'details' => [],
    ];

    if (!recordatorios_clara_is_active()) {
        $out['ok'] = true;
        $out['error'] = 'clara_inactive';
        return $out;
    }

    $tz = recordatorios_tz();
    $today = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
    $gas = campana_fetch_appointments_from_gas($today, $today);
    if (empty($gas['ok'])) {
        return [
            'ok' => false,
            'processed' => 0,
            'sent' => 0,
            'sent_email' => 0,
            'skipped' => 0,
            'failed' => 0,
            'missing_phone' => 0,
            'error' => (string) ($gas['error'] ?? 'GAS list_appointments falló'),
        ];
    }

    $execId = 'sameday-' . (new DateTimeImmutable('now', $tz))->format('Ymd-Hi');
    $appointments = $gas['appointments'] ?? [];
    if (!is_array($appointments)) {
        $appointments = [];
    }

    foreach ($appointments as $appt) {
        if (!is_array($appt)) {
            continue;
        }
        $out['processed']++;
        if ($dry) {
            $name = trim((string) ($appt['patientName'] ?? $appt['title'] ?? ''));
            $cal = trim((string) ($appt['eventId'] ?? ''));
            $hhmm = recordatorios_sameday_extract_hhmm($appt);
            $already = $cal !== '' && recordatorios_was_sent_for_event($cal);
            $lead = recordatorios_sameday_lead_ok($today, $hhmm);
            $out['details'][] = [
                'patient' => $name,
                'cal' => $cal,
                'time' => $hhmm,
                'already_sent' => $already,
                'lead_ok' => $lead['ok'],
                'lead_reason' => $lead['reason'] ?? null,
            ];
            if ($already || empty($lead['ok'])) {
                $out['skipped']++;
            }
            continue;
        }
        $res = recordatorios_sameday_process_appointment($appt, $today, $execId);
        $st = (string) ($res['status'] ?? 'skipped');
        if (isset($out[$st])) {
            $out[$st]++;
        } elseif ($st === 'skipped') {
            $out['skipped']++;
        } else {
            $out['skipped']++;
        }
        $out['details'][] = $res;
    }

    return $out;
}
