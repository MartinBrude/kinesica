<?php
declare(strict_types=1);

/**
 * Adjunta estado de takeover Clara a items de la bandeja.
 */

/** @return array<string, array> */
function interacciones_view_load_takeover_index(?PDO $pdo): array
{
    try {
        require_once __DIR__ . '/lib_clara_takeover.php';
        return clara_takeover_index_active($pdo);
    } catch (Throwable $e) {
        return [];
    }
}

/**
 * @param array<string, array> $takeoverIndex
 * @return array{takeover_active:bool,takeover:?array{wa_id:string,paused_at:string,paused_until:string,paused_by:string}}
 */
function interacciones_view_item_takeover_fields(string $waId, bool $isIgConv, array $takeoverIndex): array
{
    if ($isIgConv || !function_exists('clara_takeover_lookup_in_index')) {
        return ['takeover_active' => false, 'takeover' => null];
    }
    $row = clara_takeover_lookup_in_index($waId, $takeoverIndex);
    if (!is_array($row)) {
        return ['takeover_active' => false, 'takeover' => null];
    }
    return [
        'takeover_active' => true,
        'takeover' => [
            'wa_id' => (string) ($row['wa_id'] ?? ''),
            'paused_at' => (string) ($row['paused_at'] ?? ''),
            'paused_until' => (string) ($row['paused_until'] ?? ''),
            'paused_by' => (string) ($row['paused_by'] ?? ''),
        ],
    ];
}
