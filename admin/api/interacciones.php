<?php
declare(strict_types=1);

/**
 * API de Interacciones (WhatsApp).
 *  GET                      lista (solo lectura salvo importar lo pendiente); requiere sesión
 *  POST action=ingest       eventos desde n8n (secreto del bot); idempotente
 *  POST (sin action)        formato legado del nodo viejo de n8n (secreto del bot)
 *  POST action=sync_all     compatibilidad con el script de sincronización (secreto del bot)
 *  POST action=reconcile    fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  POST archive|unarchive|toggle_answered   solo sesión, no-colaborador; solo cambia flags, nunca borra mensajes
 *  POST action=link_paciente  asocia conversación → paciente_id (etapa 7; no fusiona historias)
 *
 * Modelo: interaccion_eventos ≈ mensajes; interaccion_estado ≈ conversación (día+wa_id).
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer conversaciones.
 * Docs: docs/codigo-datos-relacionales.md
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_interacciones_view.php';
require_once __DIR__ . '/lib_interacciones_state.php';
require_once __DIR__ . '/lib_interacciones_n8n.php';
require_once __DIR__ . '/lib_interacciones_sla.php';

require_once __DIR__ . '/interacciones_interacciones_request_secret.php';
require_once __DIR__ . '/interacciones_interacciones_run_housekeeping.php';
