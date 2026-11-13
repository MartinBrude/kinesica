<?php
declare(strict_types=1);

/**
 * API de Recordatorios WhatsApp 24h.
 *  POST action=ingest     outcomes desde n8n (secreto del bot); idempotente
 *  POST action=reconcile  fuerza reconciliación con n8n (bot o sesión no-colaborador)
 *  GET                    listado (sesión); colaborador puede leer; housekeeping reconcile
 * El secreto del bot SOLO sirve para ingestar/reconciliar: nunca para leer el historial.
 */

require __DIR__ . '/lib.php';
require_once __DIR__ . '/lib_recordatorios_view.php';
require_once __DIR__ . '/lib_recordatorios_n8n.php';
require_once __DIR__ . '/lib_whatsapp.php';
require_once __DIR__ . '/lib_mail.php';
require_once __DIR__ . '/pacientes_helpers.php';

require_once __DIR__ . '/recordatorios_lib.php';
require_once __DIR__ . '/recordatorios_dispatch_manual.php';

require __DIR__ . '/recordatorios_routes.php';
