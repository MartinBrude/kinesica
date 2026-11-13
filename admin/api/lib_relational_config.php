<?php
declare(strict_types=1);

/**
 * Configuración operativa relacional (etapa 8).
 *
 * Tabla: migrations/010_configuraciones.php
 * Auditoría: migrations/011_auditoria_cambios.php
 *
 * Solo claves allowlisted (horarios, fees, Clara, phones, flags…).
 * Secrets de config.php / tokens nunca se espejan aquí.
 *
 * Lectura: overlay DB sobre JSON en kinesica_settings_storage.
 * Escritura: dual-write tras kinesica_update_settings.
 *
 * Docs: docs/etapa8-config-gastos.md · docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

/** @return list<string> */

require_once __DIR__ . '/lib_relational_config_config_allowed_keys.php';
require_once __DIR__ . '/lib_relational_config_config_mirror_settings.php';
