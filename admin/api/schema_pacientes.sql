-- Esquema de Tablas para Directorio de Pacientes y Lista de Espera en Kinésica
-- Base de datos: MySQL 8+ / MariaDB (Hostinger)

CREATE TABLE IF NOT EXISTS pacientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    nombre_completo VARCHAR(120) NOT NULL,
    nombre_pila VARCHAR(60) NOT NULL,
    dni VARCHAR(20) DEFAULT NULL,
    profesional_habitual ENUM('norberto', 'maria', 'indistinto') NOT NULL DEFAULT 'indistinto',
    motivo_consulta VARCHAR(255) DEFAULT NULL,
    fecha_primera_sesion VARCHAR(64) DEFAULT NULL,
    total_sesiones INT UNSIGNED NOT NULL DEFAULT 1,
    notas TEXT DEFAULT NULL,
    origen ENUM('whatsapp', 'web', 'admin') NOT NULL DEFAULT 'whatsapp',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pacientes_tel (telefono),
    INDEX idx_pacientes_nombre (nombre_completo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lista_espera (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paciente_telefono VARCHAR(20) NOT NULL,
    paciente_nombre VARCHAR(120) NOT NULL,
    rango_horario_preferido VARCHAR(100) DEFAULT NULL,
    dias_preferidos VARCHAR(100) DEFAULT NULL,
    profesional ENUM('norberto', 'maria', 'indistinto') NOT NULL DEFAULT 'indistinto',
    estado ENUM('activa', 'notificado', 'asignado', 'expirada') NOT NULL DEFAULT 'activa',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_waitlist_tel (paciente_telefono)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
