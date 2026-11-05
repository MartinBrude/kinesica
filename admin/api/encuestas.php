<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';
require_once __DIR__ . '/encuestas_io.php';

require_header();
$auth = require_auth();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $encuestas = kinesica_encuestas_load();
    usort($encuestas, static function (array $a, array $b): int {
        return strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
    });

    $total = count($encuestas);
    $sumExp = 0;
    $recSi = 0;
    $recTalVez = 0;
    $recNo = 0;
    $porTratamiento = [
        'excelente' => 0,
        'bien' => 0,
        'reciente' => 0,
        'poco' => 0,
        'sin_cambios' => 0,
    ];

    foreach ($encuestas as $item) {
        $exp = (int) ($item['experiencia'] ?? 0);
        if ($exp >= 1 && $exp <= 5) {
            $sumExp += $exp;
        }
        $rec = (string) ($item['recomendaria'] ?? '');
        if ($rec === 'si') {
            $recSi++;
        } elseif ($rec === 'tal_vez') {
            $recTalVez++;
        } elseif ($rec === 'no') {
            $recNo++;
        }
        $trat = (string) ($item['tratamiento_resultado'] ?? '');
        if (isset($porTratamiento[$trat])) {
            $porTratamiento[$trat]++;
        }
    }

    $promedio = $total > 0 ? round($sumExp / $total, 2) : 0.0;
    $pctRec = $total > 0 ? (int) round(($recSi / $total) * 100) : 0;

    json_out(200, [
        'status' => 'success',
        'encuestas' => $encuestas,
        'totales' => [
            'total' => $total,
            'promedio_experiencia' => $promedio,
            'recomendaria_si' => $recSi,
            'recomendaria_tal_vez' => $recTalVez,
            'recomendaria_no' => $recNo,
            'pct_recomendaria' => $pctRec,
            'por_tratamiento' => $porTratamiento,
        ],
    ]);
}

if ($method !== 'POST') {
    json_out(405, ['error' => 'Método no permitido']);
}

if (is_colaborador($auth)) {
    json_out(403, ['error' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
}

$input = read_json();
$action = (string) ($input['action'] ?? '');

if ($action === 'delete') {
    $id = trim((string) ($input['id'] ?? ''));
    if ($id === '') {
        json_out(422, ['error' => 'ID no especificado.']);
    }

    $encuestas = kinesica_encuestas_load();
    $filtrados = array_values(array_filter($encuestas, static fn (array $e): bool => ($e['id'] ?? '') !== $id));

    if (count($filtrados) === count($encuestas)) {
        json_out(404, ['error' => 'Respuesta de encuesta no encontrada.']);
    }

    kinesica_encuestas_save($filtrados);
    json_out(200, [
        'status' => 'success',
        'message' => 'Respuesta eliminada.',
    ]);
}

json_out(400, ['error' => 'Acción no válida']);
