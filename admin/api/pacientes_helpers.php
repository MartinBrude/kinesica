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

function is_tk3_or_blocked_name(string $text): bool
{
    $t = trim($text);
    if ($t === '') {
        return false;
    }
    // Coincide con Tk3, TK 3, tk-3, tk_3, [TK3], etc. pero no con otros apellidos o nombres
    if (preg_match('/(^|[\s\-_\[\(])tk[\s\-_]*3($|[\s\-_\]\)])/iu', $t)) {
        return true;
    }
    $norm = mb_strtolower($t, 'UTF-8');
    foreach (['no dar', 'bloqueado', 'bloqueo', 'feriado', 'vacaciones'] as $kw) {
        if (str_contains($norm, $kw)) {
            return true;
        }
    }
    return false;
}

function clean_phone_number(string $raw): string
{
    $t = trim($raw);
    if ($t === '' || str_starts_with($t, 'sin-tel') || str_starts_with($t, 'sin-telefono') || str_starts_with($t, 'ficha-')) {
        return '';
    }

    // Descartar prefijos de texto habituales ("WhatsApp:", "tel:", etc.)
    $withoutPrefix = preg_replace('/^(?:whatsapp|wa\.me|tel|cel|movil)[:\s\/]*/iu', '', $t) ?? $t;
    // Si contiene letras sueltas que no eran prefijos conocidos, no es un teléfono válido
    if (preg_match('/[a-zA-Z]/', $withoutPrefix)) {
        return '';
    }

    $digits = preg_replace('/\D+/', '', $withoutPrefix) ?? '';
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
        if (str_starts_with($rest, '15')) $rest = '11' . substr($rest, 2);
        if (preg_match('/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/', $rest, $m)) {
            $rest = $m[1] . $m[2];
        }
        return '549' . $rest;
    }
    if (str_starts_with($digits, '0')) {
        $digits = substr($digits, 1);
    }
    if (preg_match('/^(11|2\d{2,3}|3\d{2,3})15(\d{6,8})$/', $digits, $m)) {
        $digits = $m[1] . $m[2];
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
            dejo_review TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_pacientes_dni (dni),
            INDEX idx_pacientes_email (email),
            INDEX idx_pacientes_nombre (nombre, apellido)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN dejo_review TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable) {}

    try {
        $pdo->exec("DELETE FROM pacientes WHERE LOWER(nombre_completo) LIKE '%tk3%' OR LOWER(nombre_completo) LIKE '%tk 3%' OR LOWER(nombre) LIKE '%tk3%' OR LOWER(nombre) LIKE '%tk 3%' OR LOWER(nombre_completo) LIKE '%no dar%' OR LOWER(nombre) LIKE '%no dar%' OR LOWER(apellido) LIKE '%no dar%'");

        // Limpieza de caracteres no permitidos persistidos (comas, saltos de línea y emojis) en pacientes
        $pdo->exec("UPDATE pacientes SET 
            nombre = TRIM(REPLACE(REPLACE(REPLACE(nombre, '\r', ' '), '\n', ' '), ',', '')),
            apellido = TRIM(REPLACE(REPLACE(REPLACE(apellido, '\r', ' '), '\n', ' '), ',', '')),
            nombre_completo = TRIM(REPLACE(REPLACE(REPLACE(nombre_completo, '\r', ' '), '\n', ' '), ',', '')),
            nombre_pila = TRIM(REPLACE(REPLACE(REPLACE(nombre_pila, '\r', ' '), '\n', ' '), ',', '')),
            contacto_nombre = CASE WHEN contacto_nombre IS NOT NULL THEN TRIM(REPLACE(REPLACE(REPLACE(contacto_nombre, '\r', ' '), '\n', ' '), ',', '')) ELSE NULL END
        WHERE nombre LIKE '%,%' OR nombre LIKE '%\n%' OR nombre LIKE '%\r%'
           OR apellido LIKE '%,%' OR apellido LIKE '%\n%' OR apellido LIKE '%\r%'
           OR nombre_completo LIKE '%,%' OR nombre_completo LIKE '%\n%' OR nombre_completo LIKE '%\r%'
           OR contacto_nombre LIKE '%,%' OR contacto_nombre LIKE '%\n%' OR contacto_nombre LIKE '%\r%'");

        $pdo->exec("UPDATE lista_espera SET
            paciente_nombre = TRIM(REPLACE(REPLACE(REPLACE(paciente_nombre, '\r', ' '), '\n', ' '), ',', ''))
        WHERE paciente_nombre LIKE '%,%' OR paciente_nombre LIKE '%\n%' OR paciente_nombre LIKE '%\r%'");

        $stmtSanitize = $pdo->query("SELECT id, nombre, apellido, nombre_completo, contacto_nombre FROM pacientes");
        if ($stmtSanitize) {
            $updateStmt = $pdo->prepare("UPDATE pacientes SET nombre = :nom, apellido = :ape, nombre_completo = :full, nombre_pila = :pila, contacto_nombre = :cont WHERE id = :id");
            while ($row = $stmtSanitize->fetch(PDO::FETCH_ASSOC)) {
                $nom = sanitize_patient_name($row['nombre'] ?? '');
                $ape = sanitize_patient_name($row['apellido'] ?? '');
                $full = sanitize_patient_name($row['nombre_completo'] ?? '');
                $cont = isset($row['contacto_nombre']) && $row['contacto_nombre'] !== null ? sanitize_patient_name($row['contacto_nombre']) : null;
                if ($nom !== $row['nombre'] || $ape !== $row['apellido'] || $full !== $row['nombre_completo'] || $cont !== ($row['contacto_nombre'] ?? null)) {
                    $pila = extract_first_name($full);
                    $updateStmt->execute(['id' => (int) $row['id'], 'nom' => $nom, 'ape' => $ape, 'full' => $full, 'pila' => $pila, 'cont' => $cont]);
                }
            }
        }
    } catch (Throwable) {}

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
    try {
        sync_pacientes_from_fichas($pdo);
    } catch (Throwable) {}
}

/**
 * Sincroniza pacientes desde las historias clínicas (`fichas`) hacia la tabla `pacientes`.
 * Si se pasa $singleId o $singlePayload, sincroniza una ficha puntual; de lo contrario procesa todas.
 */
function sync_pacientes_from_fichas(PDO $pdo, ?string $singleId = null, ?array $singlePayload = null, ?string $singleProf = null): void
{
    static $syncedAll = false;

    if ($singleId === null && $singlePayload === null) {
        if ($syncedAll) return;
        $syncedAll = true;
        try {
            $stmt = $pdo->query('SELECT id, payload, profesional FROM fichas ORDER BY updated_at ASC');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable) {
            return;
        }
    } else {
        $rows = [[
            'id' => $singleId ?? '',
            'payload' => $singlePayload !== null ? json_encode($singlePayload) : '',
            'profesional' => $singleProf ?? '',
        ]];
    }

    foreach ($rows as $row) {
        $payload = is_array($row['payload'] ?? null) ? $row['payload'] : json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) continue;

        $nombreRaw = sanitize_patient_name(trim((string) ($payload['nombre'] ?? '')));
        if ($nombreRaw === '' || is_tk3_or_blocked_name($nombreRaw)) continue;

        $dniRaw = trim((string) ($payload['dni'] ?? ''));
        $dniClean = preg_replace('/[^0-9kK]/', '', $dniRaw) ?? '';

        $motivoRaw = trim((string) ($payload['motivo'] ?? ''));
        $profRaw = strtolower(trim((string) ($row['profesional'] ?? $payload['profesional'] ?? '')));
        $prof = in_array($profRaw, ['norberto', 'maria'], true) ? $profRaw : 'indistinto';

        // Intentar ubicar paciente existente por DNI o por nombre
        $existing = null;
        if ($dniClean !== '') {
            $stmtFind = $pdo->prepare('SELECT id, telefono, nombre_completo, dni, motivo_consulta, profesional_habitual FROM pacientes WHERE dni = :dni OR REPLACE(REPLACE(COALESCE(dni, ""), ".", ""), " ", "") = :dni_clean LIMIT 1');
            $stmtFind->execute(['dni' => $dniClean, 'dni_clean' => $dniClean]);
            $existing = $stmtFind->fetch(PDO::FETCH_ASSOC);
        }

        if (!$existing) {
            $normName = normalize_search_key($nombreRaw);
            if ($normName !== '') {
                $stmtFind = $pdo->prepare('SELECT id, telefono, nombre_completo, dni, motivo_consulta, profesional_habitual FROM pacientes WHERE LOWER(nombre_completo) = :full OR LOWER(TRIM(CONCAT(nombre, " ", apellido))) = :full LIMIT 1');
                $stmtFind->execute(['full' => mb_strtolower($nombreRaw, 'UTF-8')]);
                $existing = $stmtFind->fetch(PDO::FETCH_ASSOC);
            }
        }

        if ($existing) {
            // Actualizar campos faltantes
            $updates = [];
            $params = ['id' => $existing['id']];
            if (empty($existing['dni']) && $dniClean !== '') {
                $updates[] = 'dni = :dni';
                $params['dni'] = mb_substr($dniClean, 0, 20, 'UTF-8');
            }
            if (empty($existing['motivo_consulta']) && $motivoRaw !== '') {
                $updates[] = 'motivo_consulta = :motivo';
                $params['motivo'] = mb_substr($motivoRaw, 0, 255, 'UTF-8');
            }
            if (($existing['profesional_habitual'] === 'indistinto' || empty($existing['profesional_habitual'])) && $prof !== 'indistinto') {
                $updates[] = 'profesional_habitual = :prof';
                $params['prof'] = $prof;
            }
            if (count($updates) > 0) {
                try {
                    $sql = 'UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id';
                    $pdo->prepare($sql)->execute($params);
                } catch (Throwable) {}
            }
            continue;
        }

        // Si no existe, crear nuevo registro
        $parts = preg_split('/\s+/u', $nombreRaw, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nombre = $parts[0] ?? $nombreRaw;
        $apellido = $parts[1] ?? '';
        $nombrePila = extract_first_name($nombreRaw) ?: $nombre;

        // Generar identificador para teléfono placeholder (VARCHAR(30) UNIQUE)
        if ($dniClean !== '') {
            $placeholderTel = 'sin-tel-dni-' . substr($dniClean, 0, 18);
        } else {
            $fichaId = (string) ($row['id'] ?? '');
            $cleanFichaId = preg_replace('/[^0-9a-fA-F]/', '', $fichaId) ?? '';
            if (strlen($cleanFichaId) >= 12) {
                $placeholderTel = 'sin-tel-f-' . substr($cleanFichaId, 0, 18);
            } else {
                $placeholderTel = 'sin-tel-' . substr(md5($nombreRaw), 0, 18);
            }
        }

        try {
            $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON CONFLICT(telefono) DO UPDATE SET
                        dni = COALESCE(dni, excluded.dni),
                        motivo_consulta = COALESCE(motivo_consulta, excluded.motivo_consulta),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN excluded.profesional_habitual ELSE profesional_habitual END
                ';
            } else {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON DUPLICATE KEY UPDATE
                        dni = COALESCE(dni, VALUES(dni)),
                        motivo_consulta = COALESCE(motivo_consulta, VALUES(motivo_consulta)),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END
                ';
            }
            $stmtIns = $pdo->prepare($sql);
            $stmtIns->execute([
                'tel' => mb_substr($placeholderTel, 0, 30, 'UTF-8'),
                'nombre' => mb_substr($nombre, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($apellido, 0, 60, 'UTF-8'),
                'full' => mb_substr($nombreRaw, 0, 120, 'UTF-8'),
                'pila' => mb_substr($nombrePila, 0, 60, 'UTF-8'),
                'dni' => $dniClean !== '' ? mb_substr($dniClean, 0, 20, 'UTF-8') : null,
                'prof' => $prof,
                'motivo' => $motivoRaw !== '' ? mb_substr($motivoRaw, 0, 255, 'UTF-8') : null,
            ]);
        } catch (Throwable) {}
    }
}
