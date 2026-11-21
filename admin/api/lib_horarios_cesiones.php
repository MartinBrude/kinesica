<?php
declare(strict_types=1);

/**
 * Lógica de negocio para cesión de tiempo y cierre de consultorio.
 * Administra excepciones temporales sobre el cronograma semanal base.
 *
 * Docs: docs/etapa8-config-gastos.md
 */

require_once __DIR__ . '/horarios_validator.php';

function is_valid_iso_date(string $date): bool
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m)) return false;
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
}

/**
 * Valida y normaliza un registro de cesión o cierre.
 * @return array{isValid:bool, errors:list<string>, normalized:?array}
 */
function validate_schedule_override(array $input): array
{
    $errors = [];
    $action = trim((string) ($input['action'] ?? 'transfer'));
    if (!in_array($action, ['transfer', 'closure'], true)) {
        $errors[] = 'Tipo de acción inválido (debe ser transfer o closure).';
    }

    $from = null;
    $to = null;
    if ($action === 'transfer') {
        $from = trim((string) ($input['from_practitioner'] ?? ''));
        $to = trim((string) ($input['to_practitioner'] ?? ''));
        if (!in_array($from, ['norberto', 'maria'], true) || !in_array($to, ['norberto', 'maria'], true)) {
            $errors[] = 'Profesionales de cesión inválidos (norberto o maria).';
        } elseif ($from === $to) {
            $errors[] = 'El profesional cedente y receptor deben ser distintos.';
        }
    }

    $periodType = trim((string) ($input['period_type'] ?? 'single_day'));
    if (!in_array($periodType, ['single_day', 'date_range'], true)) $periodType = 'single_day';

    $startDate = trim((string) ($input['start_date'] ?? ''));
    $endDate = trim((string) ($input['end_date'] ?? ''));
    if (!is_valid_iso_date($startDate)) $errors[] = 'La fecha de inicio es inválida (usar YYYY-MM-DD).';
    if ($periodType === 'single_day') {
        $endDate = $startDate;
    } elseif (!is_valid_iso_date($endDate)) {
        $errors[] = 'La fecha de fin es inválida (usar YYYY-MM-DD).';
    } elseif ($endDate < $startDate) {
        $errors[] = 'La fecha de fin no puede ser anterior a la de inicio.';
    }

    $timeScope = trim((string) ($input['time_scope'] ?? 'all_day'));
    if (!in_array($timeScope, ['all_day', 'custom_hours'], true)) $timeScope = 'all_day';

    $customRanges = [];
    if ($timeScope === 'custom_hours') {
        $rawRanges = isset($input['custom_ranges']) && is_array($input['custom_ranges'])
            ? $input['custom_ranges']
            : (isset($input['custom_range']) && is_array($input['custom_range']) ? [$input['custom_range']] : []);
        if ($rawRanges === []) $errors[] = 'Debes especificar al menos una franja horaria.';
        foreach ($rawRanges as $r) {
            $s = is_array($r) ? trim((string) ($r['start'] ?? '')) : '';
            $e = is_array($r) ? trim((string) ($r['end'] ?? '')) : '';
            if (!is_valid_hm($s) || !is_valid_hm($e)) {
                $errors[] = 'Formato de hora inválido (usar HH:00 o HH:30).';
                break;
            }
            $sMin = hm_to_minutes($s);
            $eMin = hm_to_minutes($e);
            if ($sMin < 480 || $eMin > 1200 || $eMin <= $sMin || ($eMin - $sMin) < 60) {
                $errors[] = "Franja inválida: {$s} a {$e} (debe ser de 08:00 a 20:00 y mínimo 60 min).";
                break;
            }
            $customRanges[] = ['start' => $s, 'end' => $e];
        }
    }

    if ($errors !== []) return ['isValid' => false, 'errors' => $errors, 'normalized' => null];

    $rawId = trim((string) ($input['id'] ?? ''));
    $id = ($rawId !== '' && preg_match('/^[a-z0-9_-]{4,64}$/i', $rawId)) ? $rawId : 'cov_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));

    $normalized = [
        'id' => $id,
        'action' => $action,
        'from_practitioner' => $from,
        'to_practitioner' => $to,
        'period_type' => $periodType,
        'start_date' => $startDate,
        'end_date' => $endDate,
        'time_scope' => $timeScope,
        'custom_range' => $customRanges[0] ?? null,
        'custom_ranges' => $customRanges,
        'reason' => mb_substr(trim((string) ($input['reason'] ?? '')), 0, 200),
        'active' => isset($input['active']) ? (bool) $input['active'] : true,
        'created_at' => (string) ($input['created_at'] ?? gmdate('Y-m-d\TH:i:s\Z')),
        'created_by' => trim((string) ($input['created_by'] ?? 'admin')),
    ];

    return ['isValid' => true, 'errors' => [], 'normalized' => $normalized];
}

/**
 * Consulta turnos existentes en el rango para informar al admin.
 * @return list<array<string,mixed>>
 */
function fetch_conflicting_turnos(PDO $pdo, string $startDate, string $endDate, ?string $practitionerId = null): array
{
    require_once __DIR__ . '/lib_migrations_migrations_dir.php';
    require_once __DIR__ . '/lib_relational_turnos_turnos_ready.php';
    if (!kinesica_rel_turnos_ready($pdo)) return [];
    $sql = 'SELECT id, appointment_date, appointment_time, patient_name, practitioner_id, status FROM turnos '
        . 'WHERE appointment_date BETWEEN :start_date AND :end_date AND status NOT IN ("cancelled", "rescheduled")';
    $params = [':start_date' => $startDate, ':end_date' => $endDate];
    if ($practitionerId !== null && in_array($practitionerId, ['norberto', 'maria'], true)) {
        $sql .= ' AND practitioner_id = :pid';
        $params[':pid'] = $practitionerId;
    }
    $sql .= ' ORDER BY appointment_date ASC, appointment_time ASC LIMIT 50';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

/**
 * Resuelve las franjas horarias de un profesional para una fecha ISO aplicando excepciones.
 * @return list<array{start:string,end:string}>
 */
function resolve_practitioner_windows_for_date(
    array $baseHours,
    array $overrides,
    string $dateIso,
    ?string $practitionerId = null
): array {
    $ts = strtotime($dateIso);
    if ($ts === false) return [];
    $dow = (int) date('N', $ts);
    if ($dow > 5) return [];

    $activeForDate = array_values(array_filter($overrides, static function ($ov) use ($dateIso): bool {
        return is_array($ov) && !empty($ov['active'])
            && $dateIso >= ($ov['start_date'] ?? '')
            && $dateIso <= ($ov['end_date'] ?? '');
    }));

    foreach ($activeForDate as $ov) {
        if (($ov['action'] ?? '') === 'closure' && ($ov['time_scope'] ?? 'all_day') === 'all_day') {
            return [];
        }
    }

    $dowKey = (string) $dow;
    $getWindows = static fn(string $pid): array => $baseHours[$pid][$dowKey] ?? $baseHours[$pid][$dow] ?? [];

    if ($practitionerId !== null && trim($practitionerId) !== '') {
        $pid = strtolower(trim($practitionerId));
        $windows = $getWindows($pid);
        $getRanges = static fn(array $o): array => !empty($o['custom_ranges']) && is_array($o['custom_ranges'])
            ? $o['custom_ranges']
            : (!empty($o['custom_range']) && is_array($o['custom_range']) ? [$o['custom_range']] : []);
        foreach ($activeForDate as $ov) {
            $action = $ov['action'] ?? '';
            $ranges = $getRanges($ov);
            if ($action === 'closure' && ($ov['time_scope'] ?? '') === 'custom_hours') {
                foreach ($ranges as $r) {
                    $windows = subtract_time_window($windows, (string) $r['start'], (string) $r['end']);
                }
            } elseif ($action === 'transfer') {
                $from = strtolower(trim((string) ($ov['from_practitioner'] ?? '')));
                $to = strtolower(trim((string) ($ov['to_practitioner'] ?? '')));
                $scope = $ov['time_scope'] ?? 'all_day';
                if ($pid === $from) {
                    if ($scope === 'all_day') {
                        $windows = [];
                    } elseif ($scope === 'custom_hours') {
                        foreach ($ranges as $r) {
                            $windows = subtract_time_window($windows, (string) $r['start'], (string) $r['end']);
                        }
                    }
                } elseif ($pid === $to) {
                    if ($scope === 'all_day') {
                        $windows = merge_time_windows($windows, $getWindows($from));
                    } elseif ($scope === 'custom_hours') {
                        $windows = merge_time_windows($windows, $ranges);
                    }
                }
            }
        }
        return $windows;
    }

    $m = resolve_practitioner_windows_for_date($baseHours, $overrides, $dateIso, 'maria');
    $n = resolve_practitioner_windows_for_date($baseHours, $overrides, $dateIso, 'norberto');
    return merge_time_windows($m, $n);
}

function subtract_time_window(array $windows, string $cutStart, string $cutEnd): array
{
    $cStartMin = hm_to_minutes($cutStart);
    $cEndMin = hm_to_minutes($cutEnd);
    $result = [];
    foreach ($windows as $w) {
        $sMin = hm_to_minutes((string) ($w['start'] ?? ''));
        $eMin = hm_to_minutes((string) ($w['end'] ?? ''));
        if ($cEndMin <= $sMin || $cStartMin >= $eMin) {
            $result[] = $w;
            continue;
        }
        if ($cStartMin > $sMin && ($cStartMin - $sMin) >= 60) {
            $result[] = ['start' => minutes_to_hm($sMin), 'end' => minutes_to_hm($cStartMin)];
        }
        if ($cEndMin < $eMin && ($eMin - $cEndMin) >= 60) {
            $result[] = ['start' => minutes_to_hm($cEndMin), 'end' => minutes_to_hm($eMin)];
        }
    }
    return $result;
}

function merge_time_windows(array $w1, array $w2): array
{
    $all = array_merge($w1, $w2);
    if (count($all) <= 1) return $all;
    usort($all, static fn($a, $b) => hm_to_minutes($a['start']) <=> hm_to_minutes($b['start']));
    $merged = [];
    $curr = $all[0];
    for ($i = 1, $len = count($all); $i < $len; $i++) {
        $next = $all[$i];
        $currEnd = hm_to_minutes($curr['end']);
        $nextStart = hm_to_minutes($next['start']);
        if ($nextStart <= $currEnd) {
            $curr['end'] = minutes_to_hm(max($currEnd, hm_to_minutes($next['end'])));
        } else {
            $merged[] = $curr;
            $curr = $next;
        }
    }
    $merged[] = $curr;
    return $merged;
}
