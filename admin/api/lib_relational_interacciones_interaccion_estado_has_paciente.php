<?php
declare(strict_types=1);


function kinesica_rel_interaccion_estado_has_paciente(PDO $pdo): bool
{
    return kinesica_migrations_table_exists($pdo, 'interaccion_estado')
        && kinesica_migrations_column_exists($pdo, 'interaccion_estado', 'paciente_id');
}

/**
 * conversation_key = {wa_digits}_{Y-m-d} en TZ consultorio.
 */

/**
 * conversation_key = {wa_digits}_{Y-m-d} en TZ consultorio.
 */
function kinesica_rel_interaccion_conversation_key(string $waId, int $tsUtc): string
{
    $wa = preg_replace('/\D+/', '', $waId) ?? '';
    if ($wa === '') {
        return '';
    }
    try {
        require_once __DIR__ . '/lib_interacciones_store.php';
        $tz = function_exists('interacciones_tz')
            ? interacciones_tz()
            : new DateTimeZone('America/Argentina/Buenos_Aires');
    } catch (Throwable) {
        $tz = new DateTimeZone('America/Argentina/Buenos_Aires');
    }
    $day = (new DateTimeImmutable('@' . $tsUtc))->setTimezone($tz)->format('Y-m-d');
    return $wa . '_' . $day;
}

/**
 * Upsert paciente_id en la conversación del día.
 * Por defecto no pisa un ID existente con NULL ni con otro ID (usar $force=true para vínculo manual).
 *
 * @param array{force?:bool,updated_by?:string} $opts
 */

/**
 * Upsert paciente_id en la conversación del día.
 * Por defecto no pisa un ID existente con NULL ni con otro ID (usar $force=true para vínculo manual).
 *
 * @param array{force?:bool,updated_by?:string} $opts
 */
function kinesica_rel_touch_interaccion_estado_paciente(
    PDO $pdo,
    string $waId,
    int $tsUtc,
    ?int $pacienteId,
    string $patientName = '',
    array $opts = []
): void {
    $key = kinesica_rel_interaccion_conversation_key($waId, $tsUtc);
    if ($key === '') {
        return;
    }
    kinesica_rel_set_interaccion_estado_paciente(
        $pdo,
        $key,
        $pacienteId,
        [
            'wa_id' => $waId,
            'patient_name' => $patientName,
            'force' => !empty($opts['force']),
            'updated_by' => (string) ($opts['updated_by'] ?? 'rel'),
        ]
    );
}

/**
 * Asocia (o reasocia) una conversación existente a un paciente.
 * Criterio etapa 7: “asociación posterior” sin crear nueva historia.
 *
 * @return array{ok:bool,conversation_key:string,paciente_id:?int,reason?:string}
 */

/**
 * Asocia (o reasocia) una conversación existente a un paciente.
 * Criterio etapa 7: “asociación posterior” sin crear nueva historia.
 *
 * @return array{ok:bool,conversation_key:string,paciente_id:?int,reason?:string}
 */
function kinesica_rel_link_interaccion_conversacion(
    PDO $pdo,
    string $conversationKey,
    int $pacienteId,
    string $by = 'admin'
): array {
    $key = trim($conversationKey);
    $out = ['ok' => false, 'conversation_key' => $key, 'paciente_id' => null];
    if ($key === '' || $pacienteId <= 0) {
        $out['reason'] = 'invalid_args';
        return $out;
    }
    if (!kinesica_rel_interaccion_estado_has_paciente($pdo)) {
        $out['reason'] = 'column_missing';
        return $out;
    }
    $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
    $chk->execute(['id' => $pacienteId]);
    if (!$chk->fetchColumn()) {
        $out['reason'] = 'paciente_not_found';
        return $out;
    }

    $wa = '';
    $name = '';
    if (preg_match('/^(\d{6,32})_(\d{4}-\d{2}-\d{2})$/', $key, $m)) {
        $wa = $m[1];
    }
    try {
        $p = $pdo->prepare(
            'SELECT nombre_completo, nombre, apellido, telefono FROM pacientes WHERE id = :id LIMIT 1'
        );
        $p->execute(['id' => $pacienteId]);
        $prow = $p->fetch(PDO::FETCH_ASSOC);
        if (is_array($prow)) {
            $name = trim((string) ($prow['nombre_completo'] !== ''
                ? $prow['nombre_completo']
                : trim(($prow['nombre'] ?? '') . ' ' . ($prow['apellido'] ?? ''))));
        }
    } catch (Throwable) {
    }

    kinesica_rel_set_interaccion_estado_paciente($pdo, $key, $pacienteId, [
        'wa_id' => $wa,
        'patient_name' => $name,
        'force' => true,
        'updated_by' => mb_substr($by, 0, 60, 'UTF-8'),
    ]);

    // Rellenar mensajes del hilo sin ID (no reescribe IDs ya seteados).
    if (
        $wa !== ''
        && kinesica_migrations_column_exists($pdo, 'interaccion_eventos', 'paciente_id')
    ) {
        try {
            $pdo->prepare(
                'UPDATE interaccion_eventos SET paciente_id = :pid
                 WHERE (wa_id = :wa OR wa_id LIKE :wa_like)
                   AND (paciente_id IS NULL OR paciente_id = \'\')'
            )->execute([
                'pid' => $pacienteId,
                'wa' => $wa,
                'wa_like' => '%' . substr($wa, -10),
            ]);
        } catch (Throwable) {
        }
    }

    $out['ok'] = true;
    $out['paciente_id'] = $pacienteId;
    return $out;
}

/**
 * @param array{wa_id?:string,patient_name?:string,force?:bool,updated_by?:string} $opts
 */
