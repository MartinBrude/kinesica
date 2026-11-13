<?php
declare(strict_types=1);

/**
 * SLA de interacciones: si un mensaje de paciente queda sin respuesta (pending en
 * /admin/interacciones) más de 3 horas, notificar a Norberto. Como máximo una
 * notificación por mensaje (event_key del primer mensaje del paciente en el hilo).
 * Las alertas WhatsApp solo se envían entre las 10:00 y las 20:00 (hora Argentina).
 */

require_once __DIR__ . '/lib_interacciones_view.php';
require_once __DIR__ . '/lib_interacciones_state.php';

/** Segundos sin marcar respondida antes de alertar. */
const INTERACCIONES_SLA_SECONDS = 10800; // 3 horas
/** Ventana de conversaciones a revisar (días locales). */
const INTERACCIONES_SLA_LOOKBACK_DAYS = 3;
/** No correr el chequeo más de una vez cada N segundos (housekeeping). */
const INTERACCIONES_SLA_THROTTLE_SECONDS = 600; // 10 min
/** Inicio inclusive de la ventana de envío (hora local Argentina, 0–23). */
const INTERACCIONES_SLA_NOTIFY_HOUR_FROM = 10;
/** Fin exclusive de la ventana de envío (10:00–20:00 → hasta 19:59). */
const INTERACCIONES_SLA_NOTIFY_HOUR_TO = 20;

/**
 * @return string Teléfono E.164-ish de Norberto para alertas WhatsApp.
 */

require_once __DIR__ . '/lib_interacciones_sla_interacciones_sla_norberto_phone.php';
require_once __DIR__ . '/lib_interacciones_sla_interacciones_sla_check.php';
