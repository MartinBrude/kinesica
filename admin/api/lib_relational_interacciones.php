<?php
declare(strict_types=1);

/**
 * Capa relacional sobre interacciones (etapa 7).
 *
 * Modelo conceptual (sin rename / sin romper Clara-n8n):
 *   interaccion_estado  ≈ conversación (día + wa_id)
 *   interaccion_eventos ≈ mensajes (append-only, UNIQUE event_key)
 *
 * - touch: al insertar mensajes (no pisa paciente_id existente)
 * - link_interaccion_conversacion: asociación posterior (force)
 * - backfill: estado ← eventos / resolve por wa_id
 *
 * Docs: docs/etapa7-whatsapp-encuestas.md · docs/codigo-datos-relacionales.md
 */

require_once __DIR__ . '/lib_migrations.php';

require_once __DIR__ . '/lib_relational_interacciones_interaccion_estado_has_paciente.php';
require_once __DIR__ . '/lib_relational_interacciones_set_interaccion_estado_paciente.php';
