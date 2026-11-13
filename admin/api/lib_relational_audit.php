<?php
declare(strict_types=1);

/**
 * Auditoría read-only de datos para el refactor relacional (etapa 1).
 *
 * Produce un informe con:
 * - pacientes (dups teléfono/DNI/email, compartidos, sin ID)
 * - fichas (huérfanas, JSON inválido, prof)
 * - lista_espera / WhatsApp / recordatorios
 * - notas de esquema + lista manual_review + reglas de resolución
 *
 * No escribe, no fusiona, no borra. PII enmascarada salvo $fullPii=true.
 * CLI: php admin/api/audit_relational.php
 * Docs: docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/lib_migrations.php';

/** @return list<string> */

require_once __DIR__ . '/lib_relational_audit_lista_espera_estados.php';
require_once __DIR__ . '/lib_relational_audit_pacientes.php';
require_once __DIR__ . '/lib_relational_audit_fichas.php';
require_once __DIR__ . '/lib_relational_audit_lista_espera.php';
require_once __DIR__ . '/lib_relational_audit_whatsapp_recordatorios.php';
require_once __DIR__ . '/lib_relational_audit_run.php';
