<?php
declare(strict_types=1);

/**
 * Resolución de paciente_id / profesional_id para escrituras.
 *
 * Reglas (plan etapa 3–4):
 * - Orden: paciente_id explícito (etapa 10) → teléfono → DNI → nombre+DNI.
 * - Teléfono/nombre **no** son clave si ya hay paciente_id en hints.
 * - Teléfono compartido con nombres distintos → ambiguous (no fusionar).
 * - Con write_ids off → status disabled (salvo opts.ignore_flag en backfill).
 * - Fallos de match → rel_unlinked.jsonl (sin PII completa).
 * - Búsqueda UX por teléfono en listados sigue aparte (pacientes.php?q=).
 *
 * Docs: docs/codigo-datos-relacionales.md · docs/etapa10-retiro-compatibilidad.md
 */

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/lib_relational_flags.php';
require_once __DIR__ . '/lib_migrations.php';

/**
 * Parsea un ID positivo desde hint/body. Rechaza bools y strings no enteros puros.
 */

require_once __DIR__ . '/lib_relational_resolve_parse_positive_id.php';
require_once __DIR__ . '/lib_relational_resolve_fetch_pacientes_rows_for_resolve.php';
