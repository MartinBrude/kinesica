<?php
declare(strict_types=1);

/**
 * Reconciliador de recordatorios: importa desde n8n lo que el push no entregó.
 * Solo corridas NUEVAS tras el primer deploy (baseline_ts); sin backfill histórico.
 * Requiere: n8n_url, n8n_user, n8n_password, n8n_recordatorios_workflow_id.
 */

require_once __DIR__ . '/lib_recordatorios_store.php';
require_once __DIR__ . '/lib_interacciones_n8n_io.php';

const RECORDATORIOS_BUILD_NODES = [
    'Build Sent Reminder Report',
    'Build Failed Reminder Report',
    'Build Skip Reminder Report',
    'Build Missing Phone Reminder Report',
];

require_once __DIR__ . '/lib_recordatorios_n8n_recordatorios_reconcile_config.php';
require_once __DIR__ . '/lib_recordatorios_n8n_recordatorios_reconcile.php';
