<?php
declare(strict_types=1);

/**
 * Puente columnas relacionales en fichas (migraciones 002/004). Retirar tras etapa 10.
 */
function kinesica_fichas_ensure_rel_columns(PDO $pdo): void
{
    static $done = null;
    $done = $done ?? new WeakMap();
    if (isset($done[$pdo])) {
        return;
    }
    require_once __DIR__ . '/lib_migrations.php';
    try {
        kinesica_migrations_add_column_if_missing($pdo, 'fichas', 'paciente_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing($pdo, 'fichas', 'profesional_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'fichas',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1',
            'INTEGER NOT NULL DEFAULT 1'
        );
    } catch (Throwable) {
    }
    $done[$pdo] = true;
}

function kinesica_fichas_check_structure(array $data): bool
{
    $checkValue = static function ($value, int $depth = 0) use (&$checkValue): bool {
        if ($depth > 4) return false;
        if (is_string($value)) return mb_strlen($value) <= 5000;
        if (is_int($value) || is_float($value) || is_bool($value) || $value === null) return true;
        if (is_array($value)) {
            if (count($value) > 200) return false;
            foreach ($value as $k => $v) {
                if (is_string($k) && !preg_match('/^[A-Za-z0-9_.-]{1,64}$/', $k)) return false;
                if (!$checkValue($v, $depth + 1)) return false;
            }
            return true;
        }
        return false;
    };
    return $checkValue($data);
}

function kinesica_fichas_get_all(PDO $pdo): void
{
    kinesica_fichas_ensure_rel_columns($pdo);
    require_once __DIR__ . '/lib_migrations.php';
    require_once __DIR__ . '/lib_relational_read.php';
    $hasPid = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $sql = $hasPid
        ? 'SELECT payload, paciente_id FROM fichas ORDER BY updated_at DESC'
        : 'SELECT payload FROM fichas ORDER BY updated_at DESC';
    $rows = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    json_out(200, kinesica_rel_map_ficha_rows($pdo, $rows));
}

function kinesica_fichas_find_inherited_owner(PDO $pdo, string $id, array $data, string $incomingDoc, string $incomingName, array $clinicians, callable $docKey, callable $nameKey): string
{
    $stmtSiblings = $pdo->prepare('
        SELECT id, profesional, payload FROM fichas 
        WHERE id != :id AND (
            JSON_UNQUOTE(JSON_EXTRACT(payload, "$.dni")) LIKE :dniPattern OR 
            JSON_UNQUOTE(JSON_EXTRACT(payload, "$.nombre")) LIKE :namePattern
        ) ORDER BY updated_at DESC LIMIT 50
    ');
    $dniPat = $incomingDoc !== '' ? '%' . trim((string) ($data['dni'] ?? '')) . '%' : '%NOMATCH%';
    $namePat = $incomingName !== '' ? '%' . trim((string) ($data['nombre'] ?? '')) . '%' : '%NOMATCH%';
    $stmtSiblings->execute(['id' => $id, 'dniPattern' => $dniPat, 'namePattern' => $namePat]);
    $siblingRows = $stmtSiblings->fetchAll() ?: $pdo->query('SELECT id, profesional, payload FROM fichas ORDER BY updated_at DESC LIMIT 100')->fetchAll();
    foreach ($siblingRows as $row) {
        if ((string) $row['id'] === $id) continue;
        $item = json_decode((string) $row['payload'], true);
        if (!is_array($item)) continue;
        $doc = $docKey((string) ($item['dni'] ?? ''));
        $name = $nameKey((string) ($item['nombre'] ?? ''));
        $sameDoc = $incomingDoc !== '' && $doc === $incomingDoc;
        $sameNameOnly = $incomingDoc === '' && $incomingName !== '' && $name === $incomingName && $doc === '';
        if (!$sameDoc && !$sameNameOnly) continue;
        $owner = (string) ($row['profesional'] ?? '');
        if (isset($clinicians[$owner])) return $owner;
    }
    return '';
}

function kinesica_fichas_save_record(PDO $pdo, array $auth, string $id, array $data, string $profesional): void
{
    $payload = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($payload === false) {
        $pdo->rollBack();
        json_out(422, ['error' => 'La ficha contiene datos no válidos']);
    }

    kinesica_fichas_ensure_rel_columns($pdo);

    $pacienteId = null;
    $profesionalId = null;
    $didSync = false;
    try {
        require_once __DIR__ . '/lib_relational_resolve.php';
        if (kinesica_rel_write_ids()) {
            // Sync primero para que el directorio exista antes de resolver.
            require_once __DIR__ . '/pacientes_helpers.php';
            if (function_exists('sync_pacientes_from_fichas')) {
                sync_pacientes_from_fichas($pdo, $id, $data, $profesional);
                $didSync = true;
            }
            $pacienteId = kinesica_rel_resolve_paciente_id_or_note($pdo, 'fichas', [
                'dni' => (string) ($data['dni'] ?? ''),
                'nombre' => (string) ($data['nombre'] ?? ''),
            ]);
            $profesionalId = kinesica_rel_resolve_profesional_id($pdo, $profesional);
        }
    } catch (Throwable) {
    }

    $hasPacienteCol = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $hasProfCol = kinesica_migrations_column_exists($pdo, 'fichas', 'profesional_id');
    $hasVersion = kinesica_migrations_column_exists($pdo, 'fichas', 'version');

    if ($hasPacienteCol || $hasProfCol) {
        $cols = 'id, payload, profesional, updated_at, updated_by';
        $vals = ':id, :payload, :profesional, UTC_TIMESTAMP(), :user';
        $upd = 'payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)';
        $params = [
            'id' => $id,
            'payload' => $payload,
            'profesional' => $profesional,
            'user' => $auth['username'],
        ];
        if ($hasPacienteCol) {
            $cols .= ', paciente_id';
            $vals .= ', :paciente_id';
            $upd .= ', paciente_id = COALESCE(VALUES(paciente_id), paciente_id)';
            $params['paciente_id'] = $pacienteId;
        }
        if ($hasProfCol) {
            $cols .= ', profesional_id';
            $vals .= ', :profesional_id';
            $upd .= ', profesional_id = COALESCE(VALUES(profesional_id), profesional_id)';
            $params['profesional_id'] = $profesionalId;
        }
        if ($hasVersion) {
            $upd .= ', version = version + 1';
        }
        $stmt = $pdo->prepare(
            "INSERT INTO fichas ({$cols}) VALUES ({$vals}) ON DUPLICATE KEY UPDATE {$upd}"
        );
        $stmt->execute($params);
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO fichas (id, payload, profesional, updated_at, updated_by)
             VALUES (:id, :payload, :profesional, UTC_TIMESTAMP(), :user)
             ON DUPLICATE KEY UPDATE payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)'
        );
        $stmt->execute(['id' => $id, 'payload' => $payload, 'profesional' => $profesional, 'user' => $auth['username']]);
    }
    $pdo->commit();

    // Sync legacy post-commit solo si no se hizo arriba (flag off).
    if (!$didSync) {
        try {
            require_once __DIR__ . '/pacientes_helpers.php';
            if (function_exists('sync_pacientes_from_fichas')) {
                sync_pacientes_from_fichas($pdo, $id, $data, $profesional);
            }
        } catch (Throwable) {
        }
    }
}
