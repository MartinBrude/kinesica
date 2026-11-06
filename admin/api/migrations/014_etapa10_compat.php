<?php
declare(strict_types=1);

/**
 * Migración 014 — marcador etapa 10 (compat / identidad por ID).
 *
 * Efectos seguros (sin pérdida de data ni corte de funcionalidad):
 * - Índice `profesionales.deleted_at` si falta (soft-delete).
 * - Marca en `schema_migrations` = “etapa 10 en código aplicada”.
 *
 * NO apaga `ensure_*` (siguen como red de seguridad idempotente).
 * NO DROP de columnas legacy (`telefono`, `fichas.profesional`, …).
 *
 * Docs: docs/etapa10-retiro-compatibilidad.md
 */

return [
    'id' => '014_etapa10_compat',
    'up' => static function (PDO $pdo): void {
        require_once dirname(__DIR__) . '/lib_migrations.php';

        if (kinesica_migrations_table_exists($pdo, 'profesionales')
            && kinesica_migrations_column_exists($pdo, 'profesionales', 'deleted_at')
        ) {
            kinesica_migrations_ensure_index(
                $pdo,
                'profesionales',
                'idx_profesionales_deleted_at',
                'deleted_at'
            );
        }
    },
];
