<?php
declare(strict_types=1);

/**
 * Helpers de normalización de apellido y código de gestión web para turnos.
 */

const KINESICA_MANAGE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KINESICA_MANAGE_CODE_LEN = 7;
const KINESICA_MANAGE_CANCEL_HOURS = 24;
/** Aviso de cortesía si anulan con esta anticipación o menos (horas). */
const KINESICA_LATE_CANCEL_NOTICE_HOURS = 2;
const KINESICA_LATE_CANCEL_NOTICE_ES =
    'Te pedimos que, de ser posible, en una próxima ocasión, nos avises con más tiempo para poder disponer de horario para otros pacientes. Muchas gracias';

function kinesica_rel_turnos_manage_ready(PDO $pdo): bool
{
    return kinesica_rel_turnos_ready($pdo)
        && kinesica_migrations_column_exists($pdo, 'turnos', 'manage_code_hash');
}

function kinesica_normalize_apellido(string $raw): string
{
    $s = trim(mb_strtolower($raw, 'UTF-8'));
    if ($s === '') {
        return '';
    }
    $map = [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
        'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
        'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
        'ñ' => 'n', 'ç' => 'c',
    ];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9\s\'\-]/u', '', $s) ?? '';
    $s = preg_replace('/\s+/u', ' ', $s) ?? '';
    return trim($s);
}

/** Apellido = todo lo que sigue al primer nombre (misma regla que send-confirmation). */
function kinesica_apellido_from_full_name(string $fullName): string
{
    $full = trim(preg_replace('/\s+/u', ' ', $fullName) ?? '');
    if ($full === '') {
        return '';
    }
    $parts = preg_split('/\s+/u', $full, 2, PREG_SPLIT_NO_EMPTY) ?: [];
    return trim((string) ($parts[1] ?? $parts[0] ?? ''));
}

function kinesica_apellido_matches(string $inputNorm, string $storedNorm): bool
{
    if ($inputNorm === '' || $storedNorm === '') {
        return false;
    }
    if (hash_equals($storedNorm, $inputNorm)) {
        return true;
    }
    if (str_ends_with($storedNorm, ' ' . $inputNorm)) {
        return true;
    }
    $tokens = preg_split('/\s+/u', $storedNorm, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $last = (string) end($tokens);
    return $last !== '' && hash_equals($last, $inputNorm);
}

function kinesica_generate_manage_code(): string
{
    $alphabet = KINESICA_MANAGE_CODE_ALPHABET;
    $max = strlen($alphabet) - 1;
    $out = '';
    for ($i = 0; $i < KINESICA_MANAGE_CODE_LEN; $i++) {
        $out .= $alphabet[random_int(0, $max)];
    }
    return $out;
}

function kinesica_hash_manage_code(string $code): string
{
    return hash('sha256', strtoupper(trim($code)));
}
