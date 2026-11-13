<?php
declare(strict_types=1);


/**
 * @return array<string,mixed>
 */
function kinesica_audit_whatsapp_recordatorios(PDO $pdo, bool $fullPii): array
{
    $out = [
        'interacciones' => ['total' => 0],
        'recordatorios' => ['total' => 0],
    ];

    $phoneIndex = [];
    if (kinesica_migrations_table_exists($pdo, 'pacientes')) {
        foreach ($pdo->query('SELECT id, telefono, nombre_completo FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [] as $p) {
            $tel = clean_phone_number((string) ($p['telefono'] ?? ''));
            if ($tel !== '') {
                $phoneIndex[$tel][] = $p;
            }
            $digits = preg_replace('/\D+/', '', (string) ($p['telefono'] ?? '')) ?? '';
            if ($digits !== '') {
                $phoneIndex[$digits][] = $p;
            }
        }
    }

    if (kinesica_migrations_table_exists($pdo, 'interaccion_eventos')) {
        $rows = $pdo->query(
            'SELECT wa_id, patient_name, event_key'
            . (kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id') ? ', paciente_id' : '')
            . ' FROM interaccion_eventos'
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $byWa = [];
        $keys = [];
        $dupKeys = [];
        $withoutPatient = [];
        foreach ($rows as $row) {
            $wa = preg_replace('/\D+/', '', (string) ($row['wa_id'] ?? '')) ?? '';
            $name = trim((string) ($row['patient_name'] ?? ''));
            $ek = (string) ($row['event_key'] ?? '');
            if ($ek !== '') {
                if (isset($keys[$ek])) {
                    $dupKeys[$ek] = ($dupKeys[$ek] ?? 1) + 1;
                }
                $keys[$ek] = true;
            }
            if ($wa === '') {
                continue;
            }
            $byWa[$wa]['names'][$name !== '' ? $name : '(vacío)'] = true;
            $pid = isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
                ? (int) $row['paciente_id']
                : null;
            $matched = $pid !== null || isset($phoneIndex[$wa]) || isset($phoneIndex['549' . $wa]);
            if (!$matched) {
                $withoutPatient[$wa] = [
                    'wa_id' => $fullPii ? $wa : kinesica_audit_mask_phone($wa),
                    'sample_name' => $name,
                ];
            }
        }
        $multiNames = [];
        foreach ($byWa as $wa => $info) {
            $names = array_keys($info['names'] ?? []);
            if (count($names) > 1) {
                $waStr = (string) $wa;
                $multiNames[] = [
                    'wa_id' => $fullPii ? $waStr : kinesica_audit_mask_phone($waStr),
                    'names' => $names,
                ];
            }
        }
        $out['interacciones'] = [
            'total' => count($rows),
            'unique_wa_ids' => count($byWa),
            'wa_without_patient' => array_values($withoutPatient),
            'wa_multiple_names' => $multiNames,
            'duplicate_event_keys' => array_map(
                static fn ($k, $c) => ['event_key' => $k, 'count' => $c],
                array_keys($dupKeys),
                array_values($dupKeys)
            ),
            'counts' => [
                'wa_without_patient' => count($withoutPatient),
                'wa_multiple_names' => count($multiNames),
                'duplicate_event_keys' => count($dupKeys),
            ],
        ];
    }

    if (kinesica_migrations_table_exists($pdo, 'recordatorio_eventos')) {
        $cols = 'event_key, wa_id, patient_name, calendar_event_id, status';
        if (kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'paciente_id')) {
            $cols .= ', paciente_id';
        }
        if (kinesica_migrations_column_exists($pdo, 'recordatorio_eventos', 'turno_id')) {
            $cols .= ', turno_id';
        }
        $rows = $pdo->query('SELECT ' . $cols . ' FROM recordatorio_eventos')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $keys = [];
        $dupKeys = [];
        $cal = [];
        $dupCal = [];
        $withoutTurno = [];
        $nameOnly = [];
        foreach ($rows as $row) {
            $ek = (string) ($row['event_key'] ?? '');
            if ($ek !== '') {
                if (isset($keys[$ek])) {
                    $dupKeys[$ek] = ($dupKeys[$ek] ?? 1) + 1;
                }
                $keys[$ek] = true;
            }
            $cid = trim((string) ($row['calendar_event_id'] ?? ''));
            if ($cid !== '') {
                if (isset($cal[$cid])) {
                    $dupCal[$cid] = ($dupCal[$cid] ?? 1) + 1;
                }
                $cal[$cid] = true;
            }
            $turnoId = isset($row['turno_id']) && $row['turno_id'] !== null && $row['turno_id'] !== ''
                ? (int) $row['turno_id']
                : null;
            if ($turnoId === null) {
                $withoutTurno[] = [
                    'event_key' => $ek,
                    'calendar_event_id' => $cid,
                    'status' => (string) ($row['status'] ?? ''),
                ];
            }
            $wa = preg_replace('/\D+/', '', (string) ($row['wa_id'] ?? '')) ?? '';
            $pid = isset($row['paciente_id']) && $row['paciente_id'] !== null && $row['paciente_id'] !== ''
                ? (int) $row['paciente_id']
                : null;
            $matched = $pid !== null || ($wa !== '' && (isset($phoneIndex[$wa]) || isset($phoneIndex['549' . $wa])));
            $name = trim((string) ($row['patient_name'] ?? ''));
            if (!$matched && $name !== '' && $wa === '') {
                $nameOnly[] = ['event_key' => $ek, 'patient_name' => $name];
            }
        }
        // Sin tabla turnos aún: "sin turno" es esperado; se reporta como informativo.
        $out['recordatorios'] = [
            'total' => count($rows),
            'without_turno_id' => array_slice($withoutTurno, 0, 200),
            'without_turno_id_total' => count($withoutTurno),
            'note' => 'turno_id aún no es obligatorio (etapa 6). Se lista para baseline.',
            'duplicate_event_keys' => array_map(
                static fn ($k, $c) => ['event_key' => $k, 'count' => $c],
                array_keys($dupKeys),
                array_values($dupKeys)
            ),
            'duplicate_calendar_event_id' => array_map(
                static fn ($k, $c) => ['calendar_event_id' => $k, 'count' => $c],
                array_keys($dupCal),
                array_values($dupCal)
            ),
            'identifiable_only_by_name' => $nameOnly,
            'counts' => [
                'without_turno_id' => count($withoutTurno),
                'duplicate_event_keys' => count($dupKeys),
                'duplicate_calendar_event_id' => count($dupCal),
                'identifiable_only_by_name' => count($nameOnly),
            ],
        ];
    }

    return $out;
}

/**
 * @return array{generated_at:string,full_pii:bool,schema:array,pacientes:array,fichas:array,lista_espera:array,whatsapp_recordatorios:array,manual_review:list<array>,resolution_rules:list<string>,summary:array}
 */
