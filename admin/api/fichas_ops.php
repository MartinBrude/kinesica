<?php
declare(strict_types=1);

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
    $rows = $pdo->query('SELECT payload FROM fichas ORDER BY updated_at DESC')->fetchAll();
    $items = [];
    foreach ($rows as $row) {
        $item = json_decode($row['payload'], true);
        if (is_array($item)) {
            $items[] = $item;
        }
    }
    json_out(200, $items);
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
    $stmt = $pdo->prepare(
        'INSERT INTO fichas (id, payload, profesional, updated_at, updated_by)
         VALUES (:id, :payload, :profesional, UTC_TIMESTAMP(), :user)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), profesional = VALUES(profesional), updated_at = UTC_TIMESTAMP(), updated_by = VALUES(updated_by)'
    );
    $stmt->execute(['id' => $id, 'payload' => $payload, 'profesional' => $profesional, 'user' => $auth['username']]);
    $pdo->commit();
}
