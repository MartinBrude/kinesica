<?php
declare(strict_types=1);

/**
 * Vista derivada de interacciones: conversaciones = eventos agrupados por teléfono + día (zona del consultorio)
 * más el estado mutable (respondida / archivada) guardado aparte. Nada de esto borra eventos.
 */

require_once __DIR__ . '/lib_interacciones_store.php';

/** Ventana por defecto del panel (días locales del consultorio). */
const INTERACCIONES_DEFAULT_DAYS = 7;
/** Máximo pedible por query ?days= (evita tirar de todo el historial). */
const INTERACCIONES_MAX_DAYS = 90;
/** Tope de eventos crudos por request (los más recientes dentro de la ventana). */
const INTERACCIONES_MAX_EVENTS = 5000;

require_once __DIR__ . '/lib_interacciones_view_names.php';
require_once __DIR__ . '/lib_interacciones_view_classify.php';
require_once __DIR__ . '/lib_interacciones_view_load.php';
require_once __DIR__ . '/lib_interacciones_view_build.php';
