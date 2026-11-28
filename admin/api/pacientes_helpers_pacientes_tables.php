<?php
declare(strict_types=1);


function ensure_pacientes_tables(PDO $pdo, bool $force = false): void
{
    static $checked = false;
    if ($checked && !$force) return;

    // REL: puente DDL idempotente (CREATE/ADD IF NOT EXISTS). No borra datos.
    // Migrate CLI es la fuente preferida; este ensure no se apaga (seguridad productiva).

    $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $marker = __DIR__ . '/data/.pacientes_schema_migrated';
    if ($driver !== 'sqlite' && !$force && is_file($marker)) {
        $checked = true;
        return;
    }
    if ($driver === 'sqlite') {
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS pacientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefono TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                apellido TEXT NOT NULL,
                nombre_completo TEXT NOT NULL,
                nombre_pila TEXT NOT NULL,
                dni TEXT,
                email TEXT,
                profesional_habitual TEXT NOT NULL DEFAULT "indistinto",
                motivo_consulta TEXT,
                notas TEXT,
                origen TEXT NOT NULL DEFAULT "whatsapp",
                contacto_nombre TEXT,
                contacto_telefono TEXT,
                contacto_email TEXT,
                contacto_notas TEXT,
                dejo_review INTEGER NOT NULL DEFAULT 0,
                encuesta_enviada INTEGER NOT NULL DEFAULT 0,
                viene_de_campana INTEGER NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');
        $hasDni = true;
        if (function_exists('kinesica_migrations_column_exists')) {
            $hasDni = kinesica_migrations_column_exists($pdo, 'pacientes', 'dni');
        } else {
            try {
                $cols = $pdo->query("PRAGMA table_info(pacientes)")->fetchAll(PDO::FETCH_ASSOC);
                $hasDni = false;
                foreach ($cols as $col) {
                    if (($col['name'] ?? '') === 'dni') { $hasDni = true; break; }
                }
            } catch (Throwable $e) {
                $hasDni = false;
            }
        }
        if ($hasDni) {
            $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_dni ON pacientes (dni) WHERE dni IS NOT NULL AND dni != ""');
        }
    } else {
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS pacientes (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                telefono VARCHAR(30) NOT NULL UNIQUE,
                nombre VARCHAR(60) NOT NULL,
                apellido VARCHAR(60) NOT NULL,
                nombre_completo VARCHAR(120) NOT NULL,
                nombre_pila VARCHAR(60) NOT NULL,
                dni VARCHAR(20) NULL,
                email VARCHAR(120) NULL,
                profesional_habitual ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
                motivo_consulta VARCHAR(255) NULL,
                notas TEXT NULL,
                origen ENUM("whatsapp", "web", "admin") NOT NULL DEFAULT "whatsapp",
                contacto_nombre VARCHAR(120) NULL,
                contacto_telefono VARCHAR(30) NULL,
                contacto_email VARCHAR(120) NULL,
                contacto_notas VARCHAR(100) NULL,
                dejo_review TINYINT(1) NOT NULL DEFAULT 0,
                encuesta_enviada TINYINT(1) NOT NULL DEFAULT 0,
                viene_de_campana TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_pacientes_dni (dni),
                INDEX idx_pacientes_email (email),
                INDEX idx_pacientes_nombre (nombre, apellido)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }

    // REL: puente DDL columnas si migrate.php aún no corrió. Fuente: admin/api/migrations/.
    require_once __DIR__ . '/lib_migrations.php';
    try {
        kinesica_migrations_add_column_if_missing($pdo, 'pacientes', 'dejo_review', 'TINYINT(1) NOT NULL DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0');
        kinesica_migrations_add_column_if_missing($pdo, 'pacientes', 'encuesta_enviada', 'TINYINT(1) NOT NULL DEFAULT 0', 'INTEGER NOT NULL DEFAULT 0');
        kinesica_migrations_add_column_if_missing($pdo, 'pacientes', 'viene_de_campana', 'TINYINT(1) NOT NULL DEFAULT 1', 'INTEGER NOT NULL DEFAULT 1');
        kinesica_migrations_add_column_if_missing($pdo, 'pacientes', 'deleted_at', 'DATETIME NULL DEFAULT NULL', 'TEXT NULL');
        kinesica_migrations_add_column_if_missing($pdo, 'pacientes', 'version', 'INT UNSIGNED NOT NULL DEFAULT 1', 'INTEGER NOT NULL DEFAULT 1');
        kinesica_migrations_add_column_if_missing($pdo, 'lista_espera', 'paciente_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        kinesica_migrations_add_column_if_missing($pdo, 'lista_espera', 'profesional_id', 'INT UNSIGNED NULL', 'INTEGER NULL');
        if ($driver !== 'sqlite') {
            if (!is_dir(dirname($marker))) {
                @mkdir(dirname($marker), 0775, true);
            }
            @file_put_contents($marker, (string) time());
        }
    } catch (Throwable) {
    }

    $checked = true;
    // Mantenimiento pesado SOLO con $force (cron / action=deduplicate / scripts).
    // Nunca en el hot path de alta/edición/listado.
    if ($force) {
        kinesica_pacientes_run_maintenance_if_due($pdo, true);
    }
}

/**
 * Mantenimiento pesado del directorio (sanitize + sync fichas + dedupe + indistintos).
 * Throttle por marker file para no bloquear POST insert/upsert del admin.
 */
