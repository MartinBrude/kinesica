<?php
declare(strict_types=1);

function convert_hours_to_python_weekdays(array $hours): array
{
    $out = ['norberto' => [], 'maria' => []];
    foreach (['norberto', 'maria'] as $pid) {
        $pDays = $hours[$pid] ?? [];
        if (!is_array($pDays)) continue;
        foreach ($pDays as $jsDow => $ranges) {
            $pyDow = ((int) $jsDow) - 1;
            if ($pyDow >= 0 && $pyDow <= 4 && is_array($ranges) && count($ranges) > 0) {
                $out[$pid][(string) $pyDow] = array_map(
                    static fn(array $r): array => [$r['start'], $r['end']],
                    $ranges
                );
            }
        }
    }
    return $out;
}

function join_day_names_es(array $names): string
{
    $count = count($names);
    if ($count === 0) return '';
    if ($count === 1) return $names[0];
    if ($count === 2) return "{$names[0]} y {$names[1]}";
    $last = array_pop($names);
    return implode(', ', $names) . " y {$last}";
}

/**
 * Construye el resumen textual exacto para el prompt del chatbot Clara (WhatsApp / n8n).
 */
function build_clara_schedule_summary(array $hours): string
{
    $dayNames = [
        1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes',
    ];
    $lines = ['Horarios oficiales:'];

    $profs = [
        ['id' => 'maria', 'title' => 'Lic. María Gulin', 'short' => 'María'],
        ['id' => 'norberto', 'title' => 'Lic. Norberto Brude', 'short' => 'Norberto'],
    ];

    foreach ($profs as $prof) {
        $lines[] = "- {$prof['title']}:";
        $pHours = $hours[$prof['id']] ?? [];
        $offDays = [];

        foreach ([1, 2, 3, 4, 5] as $dow) {
            $dayName = $dayNames[$dow];
            $ranges = $pHours[(string) $dow] ?? $pHours[$dow] ?? [];
            if (!is_array($ranges) || count($ranges) === 0) {
                $offDays[] = $dayName;
                continue;
            }
            if (count($ranges) === 1) {
                $r = $ranges[0];
                $lastTurn = minutes_to_hm(hm_to_minutes($r['end']) - 60);
                $lines[] = "  * {$dayName}: {$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive; el último turno finaliza a las {$r['end']} hs).";
            } else {
                $parts = [];
                $total = count($ranges);
                foreach (array_values($ranges) as $idx => $r) {
                    $lastTurn = minutes_to_hm(hm_to_minutes($r['end']) - 60);
                    if ($idx === $total - 1) {
                        $parts[] = "{$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive; el último turno finaliza a las {$r['end']} hs)";
                    } else {
                        $parts[] = "{$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive)";
                    }
                }
                $lines[] = "  * {$dayName}: " . implode(' y ', $parts) . '.';
            }
        }

        if (count($offDays) === 5) {
            $lines[] = "  * Lunes a Viernes: {$prof['short']} sin horarios de consultorio asignados.";
        } elseif (count($offDays) > 0) {
            $joined = join_day_names_es($offDays);
            $lines[] = "  * {$joined}: {$prof['short']} no atiende en consultorio.";
        }
    }

    return implode("\n", $lines);
}
