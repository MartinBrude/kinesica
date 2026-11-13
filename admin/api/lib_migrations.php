<?php
declare(strict_types=1);

/**
 * Runner de migraciones versionadas (MariaDB/MySQL + SQLite de pruebas).
 *
 * Responsabilidad
 * - Descubrir `migrations/NNN_nombre.php` (orden lexicográfico).
 * - Ejecutar `up(PDO)` una sola vez; registrar id + checksum en `schema_migrations`.
 * - Helpers seguros: tabla/columna/índice; FK/CHECK (etapa 9, MariaDB; SQLite ADD FK = no-op).
 *
 * Límites
 * - Solo CLI vía `migrate.php` (o tests). No invocar desde requests HTTP del admin.
 * - MySQL hace commit implícito en DDL: las migraciones no van en transacción ahí.
 * - No editar migraciones ya aplicadas en producción (checksum distinto → error).
 * - FKs InnoDB no se “apagan” con REL_ENFORCE_FK; rollback SQL = DROP CONSTRAINT / restore.
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/etapa9-integridad-referencial.md
 */

/** Directorio absoluto de archivos de migración. */

require_once __DIR__ . '/lib_migrations_migrations_dir.php';
require_once __DIR__ . '/lib_migrations_migrations_add_check_if_missing.php';
require_once __DIR__ . '/lib_migrations_migrations_run.php';
