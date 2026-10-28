<?php
declare(strict_types=1);

function normalize_search_key(string $str): string
{
    $str = mb_strtolower(trim($str), 'UTF-8');
    $unaccent = strtr($str, [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n',
    ]);
    return preg_replace('/[^a-z0-9]/', '', $unaccent) ?? '';
}

function clean_phone_number(string $raw): string
{
    $digits = preg_replace('/\D+/', '', $raw) ?? '';
    if ($digits === '') return '';

    if (str_starts_with($digits, '00')) {
        $digits = substr($digits, 2);
    }
    if (str_starts_with($digits, '549')) {
        return $digits;
    }
    if (str_starts_with($digits, '54')) {
        $rest = substr($digits, 2);
        if (str_starts_with($rest, '0')) $rest = substr($rest, 1);
        return '549' . $rest;
    }
    if (str_starts_with($digits, '0')) {
        $digits = substr($digits, 1);
    }
    if (str_starts_with($digits, '15')) {
        $digits = '11' . substr($digits, 2);
    }
    if (strlen($digits) === 8) {
        $digits = '11' . $digits;
    }
    if (strlen($digits) === 10 && str_starts_with($digits, '11')) {
        return '549' . $digits;
    }
    if (strlen($digits) >= 10 && strlen($digits) <= 11) {
        return '549' . $digits;
    }
    return $digits;
}

function is_valid_email_strict(?string $raw): bool
{
    if ($raw === null) return true;
    $email = trim($raw);
    if ($email === '') return true;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    if (strlen($email) > 254) return false;

    $parts = explode('@', $email);
    if (count($parts) !== 2) return false;
    [$local, $domain] = $parts;
    if (strlen($local) > 64) return false;

    $invalidDomains = ['gmail.con', 'gmai.com', 'hotmai.com', 'hotmial.com', 'outlok.com', 'yahoo.con'];
    if (in_array(strtolower($domain), $invalidDomains, true)) return false;
    if (!str_contains($domain, '.')) return false;

    $tld = strtolower(substr(strrchr($domain, '.') ?: '', 1));
    if (strlen($tld) < 2) return false;

    return true;
}

function extract_first_name(string $fullName): string
{
    $clean = trim($fullName);
    if ($clean === '') return '';

    if (str_contains($clean, ',')) {
        $parts = explode(',', $clean, 2);
        $clean = trim($parts[1] ?? $parts[0]);
    }
    $clean = preg_replace('/^(lic\.|dr\.|dra\.|sr\.|sra\.)\s+/i', '', $clean) ?? $clean;
    $words = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($words) === 0) return '';

    $first = $words[0];
    if (count($words) >= 2) {
        $compound = mb_strtolower($first, 'UTF-8');
        if (in_array($compound, ['maria', 'maría', 'juan', 'ana', 'jose', 'josé'], true)) {
            return $first . ' ' . $words[1];
        }
    }
    return $first;
}

function ensure_pacientes_tables(PDO $pdo): void
{
    static $checked = false;
    if ($checked) return;

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS pacientes (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            telefono VARCHAR(30) NOT NULL UNIQUE,
            nombre VARCHAR(60) NOT NULL,
            apellido VARCHAR(60) NOT NULL,
            nombre_completo VARCHAR(120) NOT NULL,
            nombre_pila VARCHAR(60) NOT NULL,
            dni VARCHAR(20) NULL,
            email VARCHAR(120) NULL,
            profesional_habitual ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
            motivo_consulta VARCHAR(255) NULL,
            notas TEXT NULL,
            origen ENUM("whatsapp", "web", "admin") NOT NULL DEFAULT "whatsapp",
            contacto_nombre VARCHAR(120) NULL,
            contacto_telefono VARCHAR(30) NULL,
            contacto_email VARCHAR(120) NULL,
            contacto_notas VARCHAR(100) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_pacientes_dni (dni),
            INDEX idx_pacientes_email (email),
            INDEX idx_pacientes_nombre (nombre, apellido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS lista_espera (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            paciente_telefono VARCHAR(30) NOT NULL,
            paciente_nombre VARCHAR(120) NOT NULL,
            rango_horario_preferido VARCHAR(120) NULL,
            dias_preferidos VARCHAR(120) NULL,
            profesional ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
            estado ENUM("activa", "contactado", "asignado", "cancelada") NOT NULL DEFAULT "activa",
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_espera_telefono (paciente_telefono),
            INDEX idx_espera_estado (estado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    $checked = true;
}
