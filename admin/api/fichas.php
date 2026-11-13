<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/fichas_ops.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
require_header();
$auth = require_auth();
$pdo = db();
// REL: puente columnas paciente_id/profesional_id/version (fichas_ops.php / mig 002+004).
kinesica_fichas_ensure_rel_columns($pdo);
require __DIR__ . '/fichas_routes.php';
