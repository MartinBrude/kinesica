<?php
declare(strict_types=1);

/**
 * Motor de match de pacientes con políticas nombradas.
 *
 * Policies:
 * - strict: tel exacto → DNI → nombre ≥2 tokens (alta/upsert/recordatorios)
 * - campana: strict + suffix-8 único + nombre ≥1 token (agenda campaña)
 * - email_suffix: tel exacto → suffix-8 único con email (get_email_by_phone)
 *
 * @param array{phone?:?string,name?:?string,dni?:?string,name_fallback?:?string} $query
 * @return array<string,mixed>|null
 */
function kinesica_match_patient(PDO $pdo, array $query, string $policy = 'strict'): ?array
{
    require_once __DIR__ . '/pacientes_helpers_alive.php';
    require_once __DIR__ . '/pacientes_helpers_match_steps.php';

    $policy = strtolower(trim($policy));
    if (!in_array($policy, ['strict', 'campana', 'email_suffix'], true)) {
        $policy = 'strict';
    }

    $alive = kinesica_pacientes_alive_sql($pdo);
    $rawPhone = (string) ($query['phone'] ?? '');
    $cleanPhone = clean_phone_number($rawPhone);
    $phoneForMatch = ($cleanPhone !== '' && !is_placeholder_phone($cleanPhone)) ? $cleanPhone : '';
    $name = isset($query['name']) ? trim((string) $query['name']) : '';
    $nameFallback = isset($query['name_fallback']) ? trim((string) $query['name_fallback']) : '';
    $dni = clean_patient_dni($query['dni'] ?? null);

    // 1) Teléfono exacto
    if ($phoneForMatch !== '') {
        $hit = kinesica_match_by_exact_phone($pdo, $phoneForMatch, $alive);
        if ($hit) {
            if ($policy !== 'email_suffix' || !empty($hit['email'])) {
                return $hit;
            }
        }
    }

    if ($policy === 'email_suffix') {
        if ($phoneForMatch === '') {
            return null;
        }
        return kinesica_match_by_phone_suffix_unique(
            $pdo,
            $phoneForMatch,
            $alive,
            "email IS NOT NULL AND email != ''"
        );
    }

    // 2) DNI
    if ($dni !== '') {
        $hit = kinesica_match_by_dni($pdo, $dni, $alive);
        if ($hit) {
            return $hit;
        }
    }

    // 3) Nombre ≥2 tokens (strict + campana)
    if ($name !== '') {
        $hit = kinesica_match_by_canonical_name($pdo, $name, $phoneForMatch, $alive, 2);
        if ($hit) {
            return $hit;
        }
    }

    if ($policy === 'strict') {
        return null;
    }

    // campana extras: suffix-8 → nombre ≥1 token (fallback raw si difiere)
    if ($phoneForMatch !== '') {
        $hit = kinesica_match_by_phone_suffix_unique($pdo, $phoneForMatch, $alive);
        if ($hit) {
            return $hit;
        }
    }

    $fallbackName = $nameFallback !== '' ? $nameFallback : $name;
    if ($fallbackName !== '') {
        $hit = kinesica_match_by_canonical_name($pdo, $fallbackName, $phoneForMatch, $alive, 1);
        if ($hit) {
            return $hit;
        }
    }

    return null;
}
