<?php
declare(strict_types=1);

/**
 * Feature flags del refactor relacional (etapa 2+).
 *
 * Defaults productivos: todo false (comportamiento legacy intacto).
 * Fuentes (env gana sobre settings):
 *   settings.json → relational_flags.{write_ids,read_ids,enforce_fk}
 *   env           → KINESICA_REL_WRITE_IDS / READ_IDS / ENFORCE_FK
 *
 * Mapeo plan → clave:
 *   REL_WRITE_IDS  → write_ids   (persistir paciente_id en writes)
 *   REL_READ_IDS   → read_ids    (enriquecer lecturas desde pacientes)
 *   REL_ENFORCE_FK → enforce_fk  (etapa 9: validación app estricta de IDs;
 *                                  las FKs SQL se aplican con mig 013 en MariaDB
 *                                  y NO se apagan con el flag — rollback = DROP/restore)
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/plan-refactor-datos-relacionales.md
 */

require_once __DIR__ . '/kinesica_settings_storage.php';

/** @return array{write_ids:bool,read_ids:bool,enforce_fk:bool} */
function kinesica_rel_flags_defaults(): array
{
    return [
        'write_ids' => false,
        'read_ids' => false,
        'enforce_fk' => false,
    ];
}

/**
 * Bool seguro: evita el pie de PHP donde (bool)"false" === true.
 */
function kinesica_rel_coerce_bool(mixed $raw): bool
{
    if (is_bool($raw)) {
        return $raw;
    }
    if (is_int($raw) || is_float($raw)) {
        return ((int) $raw) === 1;
    }
    if (is_string($raw)) {
        $v = strtolower(trim($raw));
        if (in_array($v, ['1', 'true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($v, ['0', 'false', 'no', 'off', ''], true)) {
            return false;
        }
        return false;
    }
    return false;
}

/**
 * @return array{cache:?array{write_ids:bool,read_ids:bool,enforce_fk:bool}}
 */
function &kinesica_rel_flags_state(): array
{
    static $state = ['cache' => null];
    return $state;
}

/**
 * @return array{write_ids:bool,read_ids:bool,enforce_fk:bool}
 */
function kinesica_rel_flags(): array
{
    $state = &kinesica_rel_flags_state();
    if (is_array($state['cache'])) {
        return $state['cache'];
    }

    $flags = kinesica_rel_flags_defaults();
    $raw = kinesica_settings_raw(kinesica_settings_source_file());
    $fromSettings = $raw['relational_flags'] ?? null;
    if (is_array($fromSettings)) {
        foreach (array_keys($flags) as $key) {
            if (array_key_exists($key, $fromSettings)) {
                $flags[$key] = kinesica_rel_coerce_bool($fromSettings[$key]);
            }
        }
    }

    $envMap = [
        'write_ids' => 'KINESICA_REL_WRITE_IDS',
        'read_ids' => 'KINESICA_REL_READ_IDS',
        'enforce_fk' => 'KINESICA_REL_ENFORCE_FK',
    ];
    foreach ($envMap as $key => $envName) {
        $env = getenv($envName);
        if ($env === false || $env === '') {
            continue;
        }
        $flags[$key] = kinesica_rel_coerce_bool($env);
    }

    $state['cache'] = $flags;
    return $flags;
}

function kinesica_rel_flag(string $name): bool
{
    $flags = kinesica_rel_flags();
    return (bool) ($flags[$name] ?? false);
}

function kinesica_rel_write_ids(): bool
{
    return kinesica_rel_flag('write_ids');
}

function kinesica_rel_read_ids(): bool
{
    return kinesica_rel_flag('read_ids');
}

function kinesica_rel_enforce_fk(): bool
{
    return kinesica_rel_flag('enforce_fk');
}

function kinesica_rel_flags_reset_cache(): void
{
    $state = &kinesica_rel_flags_state();
    $state['cache'] = null;
}

/**
 * Guarda flags en settings runtime (admin). No toca secrets.
 *
 * @param array{write_ids?:bool,read_ids?:bool,enforce_fk?:bool} $partial
 * @return array{write_ids:bool,read_ids:bool,enforce_fk:bool}
 */
function kinesica_rel_flags_save(array $partial): array
{
    $saved = kinesica_rel_flags_defaults();
    kinesica_update_settings(static function (array $current) use ($partial, &$saved): array {
        $flags = kinesica_rel_flags_defaults();
        $existing = $current['relational_flags'] ?? [];
        if (is_array($existing)) {
            foreach (array_keys($flags) as $key) {
                if (array_key_exists($key, $existing)) {
                    $flags[$key] = kinesica_rel_coerce_bool($existing[$key]);
                }
            }
        }
        foreach (array_keys($flags) as $key) {
            if (array_key_exists($key, $partial)) {
                $flags[$key] = kinesica_rel_coerce_bool($partial[$key]);
            }
        }
        $current['relational_flags'] = $flags;
        $saved = $flags;
        return $current;
    });
    kinesica_rel_flags_reset_cache();
    return $saved;
}
