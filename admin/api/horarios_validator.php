<?php
declare(strict_types=1);

function hm_to_minutes(string $hm): int
{
    $parts = explode(':', trim($hm));
    return ((int) ($parts[0] ?? 0)) * 60 + ((int) ($parts[1] ?? 0));
}

function minutes_to_hm(int $totalMin): string
{
    $h = str_pad((string) intdiv($totalMin, 60), 2, '0', STR_PAD_LEFT);
    $m = str_pad((string) ($totalMin % 60), 2, '0', STR_PAD_LEFT);
    return "{$h}:{$m}";
}

function is_valid_hm(string $hm): bool
{
    return (bool) preg_match('/^([01]\d|2[0-3]):(00|30)$/', trim($hm));
}

/**
 * Valida las reglas de negocio de horarios (1 sola camilla, máx 2 franjas/día, mín 60 min).
 */
function validate_practitioner_hours_php(mixed $input): array
{
    $errors = [];
    $conflicts = [];
    $normalized = [
        'norberto' => [],
        'maria' => [],
    ];

    if (!is_array($input)) {
        return [
            'isValid' => false,
            'errors' => ['El formato de horarios enviado no es válido.'],
            'conflicts' => [],
            'normalized' => default_practitioner_hours(),
        ];
    }

    $dayNames = [
        1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes',
    ];

    $parsedByDay = [1 => [], 2 => [], 3 => [], 4 => [], 5 => []];

    foreach (['maria' => 'María', 'norberto' => 'Norberto'] as $pid => $pLabel) {
        $pSource = $input[$pid] ?? [];
        if (!is_array($pSource)) continue;

        foreach ($pSource as $rawDow => $rawList) {
            if (!is_array($rawList) || count($rawList) === 0) continue;
            $dow = (int) $rawDow;
            if ($dow < 1 || $dow > 5) {
                $errors[] = "Solo se permiten días de lunes a viernes ({$pLabel}).";
                continue;
            }
            $dayName = $dayNames[$dow];
            if (count($rawList) > 2) {
                $errors[] = "{$pLabel} ({$dayName}): se permiten hasta 2 franjas horarias por día.";
                continue;
            }

            $dayRanges = [];
            foreach (array_values($rawList) as $idx => $item) {
                $fNum = $idx + 1;
                $start = is_array($item) && isset($item['start']) ? trim((string) $item['start']) : '';
                $end = is_array($item) && isset($item['end']) ? trim((string) $item['end']) : '';

                if (!is_valid_hm($start) || !is_valid_hm($end)) {
                    $errors[] = "{$pLabel} ({$dayName}, franja {$fNum}): formato de hora inválido (usar HH:00 o HH:30).";
                    continue;
                }
                $startMin = hm_to_minutes($start);
                $endMin = hm_to_minutes($end);

                if ($startMin < 8 * 60 || $endMin > 20 * 60) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): el horario debe estar entre las 08:00 y las 20:00 hs.";
                    continue;
                }
                if ($endMin <= $startMin) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): la hora de fin debe ser posterior a la de inicio.";
                    continue;
                }
                if ($endMin - $startMin < 60) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): cada franja debe durar al menos 60 minutos.";
                    continue;
                }

                $dayRanges[] = [
                    'start' => $start,
                    'end' => $end,
                    'startMin' => $startMin,
                    'endMin' => $endMin,
                ];
            }

            usort($dayRanges, static fn(array $a, array $b): int => $a['startMin'] <=> $b['startMin']);

            if (count($dayRanges) === 2 && $dayRanges[0]['endMin'] > $dayRanges[1]['startMin']) {
                $errors[] = "{$pLabel} ({$dayName}): las dos franjas del mismo día se superponen ({$dayRanges[0]['start']}–{$dayRanges[0]['end']} y {$dayRanges[1]['start']}–{$dayRanges[1]['end']}).";
            }

            if (count($dayRanges) > 0) {
                $parsedByDay[$dow][$pid] = $dayRanges;
                $normalized[$pid][(string) $dow] = array_map(
                    static fn(array $r): array => ['start' => $r['start'], 'end' => $r['end']],
                    $dayRanges
                );
            }
        }
    }

    // Validar que Norberto y María no se superpongan en la única camilla del consultorio
    foreach ([1, 2, 3, 4, 5] as $dow) {
        $mList = $parsedByDay[$dow]['maria'] ?? [];
        $nList = $parsedByDay[$dow]['norberto'] ?? [];
        $dayName = $dayNames[$dow];

        foreach ($mList as $mRange) {
            foreach ($nList as $nRange) {
                $overlapStart = max($mRange['startMin'], $nRange['startMin']);
                $overlapEnd = min($mRange['endMin'], $nRange['endMin']);
                if ($overlapStart < $overlapEnd) {
                    $oStartStr = minutes_to_hm($overlapStart);
                    $oEndStr = minutes_to_hm($overlapEnd);
                    $msg = "Superposición de camilla el {$dayName}: María ({$mRange['start']} a {$mRange['end']}) se pisa con Norberto ({$nRange['start']} a {$nRange['end']}) entre las {$oStartStr} y las {$oEndStr} hs.";
                    $errors[] = $msg;
                    $conflicts[] = [
                        'day' => $dow,
                        'dayName' => $dayName,
                        'overlapStart' => $oStartStr,
                        'overlapEnd' => $oEndStr,
                        'maria' => ['start' => $mRange['start'], 'end' => $mRange['end']],
                        'norberto' => ['start' => $nRange['start'], 'end' => $nRange['end']],
                        'message' => $msg,
                    ];
                }
            }
        }
    }

    return [
        'isValid' => count($errors) === 0,
        'errors' => $errors,
        'conflicts' => $conflicts,
        'normalized' => $normalized,
    ];
}
