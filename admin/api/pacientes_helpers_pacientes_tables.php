<?php
declare(strict_types=1);


function ensure_pacientes_tables(PDO $pdo, bool $force = false): void
{
    static $checked = false;
    if ($checked && !$force) return;

    // REL: puente DDL idempotente (CREATE/ADD IF NOT EXISTS). No borra datos.
    // Migrate CLI es la fuente preferida; este ensure no se apaga (seguridad productiva).

    $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
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
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS lista_espera (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paciente_telefono TEXT NOT NULL,
                paciente_nombre TEXT NOT NULL,
                rango_horario_preferido TEXT NULL,
                dias_preferidos TEXT NULL,
                profesional TEXT NOT NULL DEFAULT "indistinto",
                estado TEXT NOT NULL DEFAULT "activa",
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ');
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
                INDEX idx_pacientes_dni (dni),
                INDEX idx_pacientes_email (email),
                INDEX idx_pacientes_nombre (nombre, apellido)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS lista_espera (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                paciente_telefono VARCHAR(30) NOT NULL,
                paciente_nombre VARCHAR(120) NOT NULL,
                rango_horario_preferido VARCHAR(120) NULL,
                dias_preferidos VARCHAR(120) NULL,
                profesional ENUM("norberto", "maria", "indistinto") NOT NULL DEFAULT "indistinto",
                estado ENUM("activa", "contactado", "asignado", "cancelada") NOT NULL DEFAULT "activa",
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_espera_telefono (paciente_telefono),
                INDEX idx_espera_estado (estado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ');
    }

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN dejo_review TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable) {}

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN encuesta_enviada TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable) {}

    try {
        $pdo->exec('ALTER TABLE pacientes ADD COLUMN viene_de_campana TINYINT(1) NOT NULL DEFAULT 1');
    } catch (Throwable) {}

    // REL: puente DDL columnas (deleted_at/version/paciente_id/profesional_id)
    // si migrate.php aún no corrió. Fuente: admin/api/migrations/. Retirar tras etapa 10.
    require_once __DIR__ . '/lib_migrations.php';
    try {
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'deleted_at',
            'DATETIME NULL DEFAULT NULL',
            'TEXT NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'pacientes',
            'version',
            'INT UNSIGNED NOT NULL DEFAULT 1',
            'INTEGER NOT NULL DEFAULT 1'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'paciente_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
        kinesica_migrations_add_column_if_missing(
            $pdo,
            'lista_espera',
            'profesional_id',
            'INT UNSIGNED NULL',
            'INTEGER NULL'
        );
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
