<?php
declare(strict_types=1);

/**
 * Criterios de enlace compartidos para dedupe (full + around_patient).
 */

/**
 * Keys de unión para una fila activa.
 *
 * @param array<string,mixed> $row
 * @return array{dni:?string,phone:?string,name:?string}
 */
function kinesica_dedupe_link_keys(array $row): array
{
    $dni = clean_patient_dni($row['dni'] ?? null);
    if ($dni === '' && str_starts_with((string) ($row['telefono'] ?? ''), 'sin-tel-dni-')) {
        $dni = substr((string) $row['telefono'], 12);
    }

    $rawPhone = (string) ($row['telefono'] ?? '');
    $cleanPhone = clean_phone_number($rawPhone);
    $phoneKey = null;
    if ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone) && !is_placeholder_phone($rawPhone)) {
        $phoneKey = $cleanPhone;
    }

    $full = trim((string) (($row['nombre_completo'] ?? '') ?: trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''))));
    $nameKey = canonical_patient_name_key($full);
    if ($nameKey === '' || !str_contains($nameKey, ' ')) {
        $nameKey = null;
    }

    return [
        'dni' => $dni !== '' ? $dni : null,
        'phone' => $phoneKey,
        'name' => $nameKey,
    ];
}

function kinesica_dedupe_should_union_by_name(string $phoneA, string $phoneB): bool
{
    return kinesica_phones_compatible_for_name_merge($phoneA, $phoneB);
}

/**
 * Construye clusters union-find a partir de filas (mismas reglas DNI/tel/nombre).
 *
 * @param list<array<string,mixed>> $rows
 * @return list<list<array<string,mixed>>>
 */
function kinesica_dedupe_build_clusters(array $rows): array
{
    $n = count($rows);
    if ($n <= 1) {
        return $n === 1 ? [[$rows[0]]] : [];
    }

    $parent = range(0, $n - 1);
    $find = static function (int $i) use (&$parent, &$find): int {
        if ($parent[$i] === $i) {
            return $i;
        }
        return $parent[$i] = $find($parent[$i]);
    };
    $union = static function (int $i, int $j) use (&$parent, &$find): void {
        $rootI = $find($i);
        $rootJ = $find($j);
        if ($rootI !== $rootJ) {
            $parent[$rootI] = $rootJ;
        }
    };

    $byDni = [];
    $byName = [];
    $byPhone = [];

    foreach ($rows as $idx => $r) {
        $keys = kinesica_dedupe_link_keys($r);
        if ($keys['dni'] !== null) {
            $dni = $keys['dni'];
            if (isset($byDni[$dni])) {
                $union($idx, $byDni[$dni]);
            } else {
                $byDni[$dni] = $idx;
            }
        }
        if ($keys['phone'] !== null) {
            $ph = $keys['phone'];
            if (isset($byPhone[$ph])) {
                $union($idx, $byPhone[$ph]);
            } else {
                $byPhone[$ph] = $idx;
            }
        }
        if ($keys['name'] !== null) {
            $nk = $keys['name'];
            $rawPhone = (string) ($r['telefono'] ?? '');
            if (isset($byName[$nk])) {
                $otherIdx = $byName[$nk];
                if (kinesica_dedupe_should_union_by_name(
                    (string) ($rows[$otherIdx]['telefono'] ?? ''),
                    $rawPhone
                )) {
                    $union($idx, $otherIdx);
                }
            } else {
                $byName[$nk] = $idx;
            }
        }
    }

    $clusters = [];
    for ($i = 0; $i < $n; $i++) {
        $clusters[$find($i)][] = $rows[$i];
    }
    return array_values($clusters);
}
