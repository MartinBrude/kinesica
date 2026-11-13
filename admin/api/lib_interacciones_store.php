<?php
declare(strict_types=1);

/**
 * Almacén durable de interacciones de WhatsApp.
 *
 * Principios:
 *  - Solo se AGREGA: los eventos (mensajes) son inmutables y tienen clave única (idempotencia).
 *  - Si la BD falla, el evento se guarda en un spool en disco y se reintegra luego: nunca se descarta.
 *  - La vista (conversaciones) se deriva de los eventos; ver lib_interacciones_view.php.
 */

require_once __DIR__ . '/lib_interacciones_spool.php';

const INTERACCIONES_MAX_BODY = 16000;
const INTERACCIONES_MAX_BATCH = 200;

require_once __DIR__ . '/lib_interacciones_store_interacciones_dir.php';
require_once __DIR__ . '/lib_interacciones_store_interacciones_normalize_event.php';
require_once __DIR__ . '/lib_interacciones_store_interacciones_store_events.php';
require_once __DIR__ . '/lib_interacciones_store_interacciones_media_resolve.php';
