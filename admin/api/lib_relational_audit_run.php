<?php
declare(strict_types=1);


/**
 * @return array{generated_at:string,full_pii:bool,schema:array,pacientes:array,fichas:array,lista_espera:array,whatsapp_recordatorios:array,manual_review:list<array>,resolution_rules:list<string>,summary:array}
 */
function kinesica_audit_run(PDO $pdo, bool $fullPii = false): array
{
    $pacientes = kinesica_audit_pacientes($pdo, $fullPii);
    $fichas = kinesica_audit_fichas($pdo, $fullPii);
    $lista = kinesica_audit_lista_espera($pdo, $fullPii);
    $wa = kinesica_audit_whatsapp_recordatorios($pdo, $fullPii);
    $schema = kinesica_audit_schema($pdo);

    $manual = [];
    foreach ($pacientes['shared_phones_different_names'] ?? [] as $item) {
        $manual[] = ['area' => 'pacientes', 'reason' => 'telefono_compartido', 'item' => $item];
    }
    foreach ($pacientes['duplicate_dni'] ?? [] as $item) {
        $manual[] = ['area' => 'pacientes', 'reason' => 'dni_duplicado', 'item' => $item];
    }
    foreach ($pacientes['same_name_groups'] ?? [] as $item) {
        if (($item['clasificacion'] ?? '') === 'no_fusionar_ambiguo') {
            $manual[] = ['area' => 'pacientes', 'reason' => 'nombre_ambiguo', 'item' => $item];
        }
    }
    foreach ($fichas['dni_multiple_patients'] ?? [] as $item) {
        $manual[] = ['area' => 'fichas', 'reason' => 'conflicto_dni', 'item' => $item];
    }
    foreach ($lista['name_conflicts_vs_paciente'] ?? [] as $item) {
        $manual[] = ['area' => 'lista_espera', 'reason' => 'nombre_vs_telefono', 'item' => $item];
    }
    foreach ($wa['interacciones']['wa_multiple_names'] ?? [] as $item) {
        $manual[] = ['area' => 'whatsapp', 'reason' => 'wa_multi_nombre', 'item' => $item];
    }

    $rules = [
        'No fusionar automáticamente casos ambiguos.',
        'Teléfono compartido con nombres distintos → revisión manual (familia), no fusión.',
        'DNI duplicado → bloqueo hasta revisión.',
        'Candidato a fusión: mismo teléfono normalizado y mismo name_key, o mismo DNI único tras limpieza.',
        'Ficha sin paciente: backfill por DNI único; si no hay match, pendiente.',
        'Lista de espera: asociar por teléfono normalizado; conflicto de nombre → manual.',
        'wa_id es identificador externo; no es paciente_id.',
    ];

    $summary = [
        'pacientes_total' => $pacientes['total'] ?? 0,
        'fichas_total' => $fichas['total'] ?? 0,
        'lista_espera_total' => $lista['total'] ?? 0,
        'manual_review_count' => count($manual),
        'pacientes_counts' => $pacientes['counts'] ?? [],
        'fichas_counts' => $fichas['counts'] ?? [],
        'lista_espera_counts' => $lista['counts'] ?? [],
        'interacciones_counts' => $wa['interacciones']['counts'] ?? [],
        'recordatorios_counts' => $wa['recordatorios']['counts'] ?? [],
        'schema_ok' => $schema['ok'] ?? false,
    ];

    return [
        'generated_at' => gmdate('c'),
        'full_pii' => $fullPii,
        'schema' => $schema,
        'pacientes' => $pacientes,
        'fichas' => $fichas,
        'lista_espera' => $lista,
        'whatsapp_recordatorios' => $wa,
        'manual_review' => $manual,
        'resolution_rules' => $rules,
        'summary' => $summary,
    ];
}


function kinesica_audit_summary_markdown(array $report): string
{
    $s = $report['summary'] ?? [];
    $lines = [
        '# Informe auditoría datos relacionales',
        '',
        'Generado: `' . ($report['generated_at'] ?? '') . '`',
        'PII completo: `' . (($report['full_pii'] ?? false) ? 'sí' : 'no (enmascarado)') . '`',
        '',
        '## Resumen',
        '',
        '- Pacientes: ' . (int) ($s['pacientes_total'] ?? 0),
        '- Fichas: ' . (int) ($s['fichas_total'] ?? 0),
        '- Lista de espera: ' . (int) ($s['lista_espera_total'] ?? 0),
        '- Ítems revisión manual: ' . (int) ($s['manual_review_count'] ?? 0),
        '- Schema OK: ' . (($s['schema_ok'] ?? false) ? 'sí' : 'no'),
        '',
        '## Conteos pacientes',
        '',
    ];
    foreach ($s['pacientes_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Conteos fichas';
    $lines[] = '';
    foreach ($s['fichas_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Conteos lista de espera';
    $lines[] = '';
    foreach ($s['lista_espera_counts'] ?? [] as $k => $v) {
        $lines[] = "- `{$k}`: {$v}";
    }
    $lines[] = '';
    $lines[] = '## Reglas de resolución';
    $lines[] = '';
    foreach ($report['resolution_rules'] ?? [] as $rule) {
        $lines[] = '- ' . $rule;
    }
    $lines[] = '';
    $lines[] = '## Notas de esquema';
    $lines[] = '';
    foreach ($report['schema']['notes'] ?? [] as $note) {
        $lines[] = '- ' . $note;
    }
    $lines[] = '';
    $lines[] = '_Detalle completo en el JSON acompañante. No fusionar ni borrar desde este informe._';
    $lines[] = '';
    return implode("\n", $lines);
}
