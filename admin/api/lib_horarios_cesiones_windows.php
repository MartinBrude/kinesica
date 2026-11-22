<?php
declare(strict_types=1);

/**
 * Aritmética de franjas y resolución de agendas con cesiones/cierres.
 * Complementa lib_horarios_cesiones.php.
 */

require_once __DIR__ . '/horarios_validator.php';

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
                $onLeave = !empty($ov['practitioner_on_leave']);
                if ($pid === $from) {
                    // De baja = ausente todo el día (disciplinas exclusivas no se ofrecen).
                    if ($onLeave || $scope === 'all_day') {
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
