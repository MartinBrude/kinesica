<?php
declare(strict_types=1);

/**
 * Horarios de profesionales + carga unificada de settings runtime.
 *
 * `load_full_runtime_settings()` aplica defaults (horas, fees, Clara) sobre
 * el blob de settings. REL etapa 8: lee vía `kinesica_settings_load()`
 * (JSON + overlay `configuraciones`). POST guarda con lock + mirror DB.
 *
 * Docs: docs/etapa8-config-gastos.md
 */

require_once __DIR__ . '/horarios_validator.php';
require_once __DIR__ . '/horarios_summary.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

function default_practitioner_hours(): array
{
    return [
        'norberto' => [
            '1' => [['start' => '17:30', 'end' => '19:30']],
            '2' => [['start' => '16:30', 'end' => '19:30']],
            '3' => [['start' => '09:00', 'end' => '16:30']],
            '4' => [['start' => '15:00', 'end' => '19:00']],
            '5' => [['start' => '13:30', 'end' => '19:30']],
        ],
        'maria' => [
            '1' => [['start' => '09:00', 'end' => '17:00']],
            '2' => [['start' => '09:00', 'end' => '16:00']],
            '5' => [['start' => '09:00', 'end' => '13:00']],
        ],
    ];
}

require_once __DIR__ . '/horarios_write.php';
