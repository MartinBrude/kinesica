<?php
declare(strict_types=1);


/**
 * Puente columnas relacionales en fichas (migraciones 002/004).
 * Idempotente (ADD IF MISSING). No se apaga: red de seguridad productiva.
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
    } catch (Throwable $e) {
        error_log('kinesica fichas ensure_rel_columns: ' . $e->getMessage());
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
    // REL: enriquecer filas con datos canónicos si REL_READ_IDS (lib_relational_read.php).
    require_once __DIR__ . '/lib_relational_read.php';
    $hasPid = kinesica_migrations_column_exists($pdo, 'fichas', 'paciente_id');
    $hasVersion = kinesica_migrations_column_exists($pdo, 'fichas', 'version');
    $cols = 'payload';
    if ($hasPid) {
        $cols .= ', paciente_id';
    }
    if ($hasVersion) {
        $cols .= ', version';
    }
    $rows = $pdo->query("SELECT {$cols} FROM fichas ORDER BY updated_at DESC")->fetchAll(PDO::FETCH_ASSOC) ?: [];
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

/**
 * Optimistic locking: si el cliente envía version y no coincide → 409.
 * Clientes legacy sin version siguen pudiendo guardar.
 *
 * @return int versión actual en DB (0 si no hay fila / columna)
 */

/**
 * Optimistic locking: si el cliente envía version y no coincide → 409.
 * Clientes legacy sin version siguen pudiendo guardar.
 *
 * @return int versión actual en DB (0 si no hay fila / columna)
 */
function kinesica_fichas_assert_version(PDO $pdo, string $id, array $data): int
{
    require_once __DIR__ . '/lib_migrations.php';
    if (!kinesica_migrations_column_exists($pdo, 'fichas', 'version')) {
        return 0;
    }
    $stmt = $pdo->prepare('SELECT version FROM fichas WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!is_array($row)) {
        return 0;
    }
    $dbVersion = (int) ($row['version'] ?? 1);
    if (!array_key_exists('version', $data)) {
        return $dbVersion;
    }
    $clientVersion = (int) $data['version'];
    if ($clientVersion > 0 && $clientVersion !== $dbVersion) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        json_out(409, [
            'error' => 'La ficha fue modificada por otro usuario. Recargá e intentá de nuevo.',
            'version' => $dbVersion,
            'code' => 'ficha_version_conflict',
        ]);
    }
    return $dbVersion;
}

/**
 * @return array{version:int}
 */
