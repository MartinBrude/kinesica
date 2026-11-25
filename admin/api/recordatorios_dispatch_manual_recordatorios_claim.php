<?php
declare(strict_types=1);

require_once __DIR__ . '/lib_recordatorios_store_schema.php';

/**
 * Claim atómico previo al envío manual (anti doble-clic / dos pestañas).
 * Usa error_code "claim:…" + run_at; no introduce status fuera del CHECK SQL.
 *
 * @return array{ok:bool,item?:array,error?:string,claim?:string}
 */
function recordatorios_claim_manual_send(int $id): array
{
    if ($id <= 0) {
        return ['ok' => false, 'error' => 'ID de recordatorio inválido'];
    }

    $pdo = recordatorios_pdo();
    recordatorios_ensure_schema($pdo);

    $existing = recordatorios_find_item_by_id($id, $pdo);
    if (!$existing) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado'];
    }
    if (in_array((string) ($existing['status'] ?? ''), ['sent', 'sent_email'], true)) {
        return ['ok' => false, 'error' => 'Este recordatorio ya fue enviado exitosamente hoy.'];
    }

    $claim = 'claim:' . bin2hex(random_bytes(8));
    $now = gmdate('Y-m-d H:i:s');
    $stale = gmdate('Y-m-d H:i:s', time() - 120);

    $stmt = $pdo->prepare(
        'UPDATE recordatorio_eventos
         SET error_code = :claim, run_at = :now
         WHERE id = :id
           AND status NOT IN ("sent", "sent_email")
           AND (
             error_code IS NULL OR error_code = ""
             OR error_code NOT LIKE "claim:%"
             OR run_at IS NULL OR run_at < :stale
           )'
    );
    $stmt->execute([
        'claim' => $claim,
        'now' => $now,
        'id' => $id,
        'stale' => $stale,
    ]);

    if ($stmt->rowCount() < 1) {
        $again = recordatorios_find_item_by_id($id, $pdo);
        if ($again && in_array((string) ($again['status'] ?? ''), ['sent', 'sent_email'], true)) {
            return ['ok' => false, 'error' => 'Este recordatorio ya fue enviado exitosamente hoy.'];
        }
        return ['ok' => false, 'error' => 'Otro envío está en curso para este recordatorio. Esperá unos segundos e intentá de nuevo.'];
    }

    $item = recordatorios_find_item_by_id($id, $pdo);
    if (!$item) {
        return ['ok' => false, 'error' => 'Registro de recordatorio no encontrado tras el claim'];
    }

    return ['ok' => true, 'item' => $item, 'claim' => $claim];
}

/**
 * Libera un claim manual si el envío falló y nadie más tomó el registro.
 */
function recordatorios_release_manual_claim(int $id, string $claim, string $fallbackStatus = 'pending'): void
{
    if ($id <= 0 || $claim === '' || !str_starts_with($claim, 'claim:')) {
        return;
    }
    try {
        $pdo = recordatorios_pdo();
        $pdo->prepare(
            'UPDATE recordatorio_eventos
             SET error_code = "", status = CASE
               WHEN status IN ("sent", "sent_email") THEN status
               ELSE :status
             END
             WHERE id = :id AND error_code = :claim'
        )->execute([
            'status' => $fallbackStatus,
            'id' => $id,
            'claim' => $claim,
        ]);
    } catch (Throwable $e) {
        error_log('recordatorios_release_manual_claim: ' . $e->getMessage());
    }
}
