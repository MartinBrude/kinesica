<?php
declare(strict_types=1);


/**
 * Sincroniza pacientes desde las historias clínicas (`fichas`) hacia la tabla `pacientes`.
 * Si se pasa $singleId o $singlePayload, sincroniza una ficha puntual; de lo contrario procesa todas.
 */
function sync_pacientes_from_fichas(PDO $pdo, ?string $singleId = null, ?array $singlePayload = null, ?string $singleProf = null, bool $force = false): void
{
    static $syncedAll = false;

    if ($singleId === null && $singlePayload === null) {
        if ($syncedAll && !$force) return;
        $syncedAll = true;
        try {
            $stmt = $pdo->query('SELECT id, payload, profesional FROM fichas ORDER BY updated_at ASC');
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable) {
            return;
        }
    } else {
        $rows = [[
            'id' => $singleId ?? '',
            'payload' => $singlePayload !== null ? json_encode($singlePayload) : '',
            'profesional' => $singleProf ?? '',
        ]];
    }

    foreach ($rows as $row) {
        $payload = is_array($row['payload'] ?? null) ? $row['payload'] : json_decode((string) ($row['payload'] ?? ''), true);
        if (!is_array($payload)) continue;

        $nombreRaw = sanitize_patient_name(trim((string) ($payload['nombre'] ?? '')));
        if ($nombreRaw === '' || is_tk3_or_blocked_name($nombreRaw)) continue;

        if (isset($payload['nombre']) && $nombreRaw !== $payload['nombre'] && !empty($row['id'])) {
            $payload['nombre'] = $nombreRaw;
            try {
                $upFicha = $pdo->prepare('UPDATE fichas SET payload = :p WHERE id = :id');
                $upFicha->execute(['p' => json_encode($payload, JSON_UNESCAPED_UNICODE), 'id' => (string) $row['id']]);
            } catch (Throwable) {}
        }

        $dniRaw = trim((string) ($payload['dni'] ?? ''));
        $dniClean = clean_patient_dni($dniRaw);

        $motivoRaw = trim((string) ($payload['motivo'] ?? ''));
        $profRaw = strtolower(trim((string) ($row['profesional'] ?? $payload['profesional'] ?? '')));
        $prof = in_array($profRaw, ['norberto', 'maria'], true) ? $profRaw : 'indistinto';

        // Intentar ubicar paciente existente por DNI, teléfono o clave canónica de nombre
        $existing = find_existing_patient_match($pdo, null, $nombreRaw, $dniClean !== '' ? $dniClean : null);

        if ($existing) {
            // Actualizar campos faltantes respetando reglas
            $updates = [];
            $params = ['id' => (int) $existing['id']];
            if (empty($existing['dni']) && $dniClean !== '') {
                $updates[] = 'dni = :dni';
                $params['dni'] = mb_substr($dniClean, 0, 20, 'UTF-8');
            }
            if (empty($existing['motivo_consulta']) && $motivoRaw !== '') {
                $updates[] = 'motivo_consulta = :motivo';
                $params['motivo'] = mb_substr($motivoRaw, 0, 255, 'UTF-8');
            }
            // Regla: si uno dice indistinto y otro dice con tal, queda tal
            $existingProf = $existing['profesional_habitual'] ?? 'indistinto';
            $mergedProf = merge_prof_values($existingProf, $prof);
            if ($mergedProf !== $existingProf) {
                $updates[] = 'profesional_habitual = :prof';
                $params['prof'] = $mergedProf;
            }
            if (count($updates) > 0) {
                try {
                    $sql = 'UPDATE pacientes SET ' . implode(', ', $updates) . ' WHERE id = :id';
                    $pdo->prepare($sql)->execute($params);
                } catch (Throwable) {}
            }
            continue;
        }

        // Si no existe, crear nuevo registro
        $parts = preg_split('/\s+/u', $nombreRaw, 2, PREG_SPLIT_NO_EMPTY) ?: [];
        $nombre = $parts[0] ?? $nombreRaw;
        $apellido = $parts[1] ?? '';
        $nombrePila = extract_first_name($nombreRaw) ?: $nombre;

        // Generar identificador para teléfono placeholder (VARCHAR(30) UNIQUE)
        if ($dniClean !== '') {
            $placeholderTel = 'sin-tel-dni-' . substr($dniClean, 0, 18);
        } else {
            $fichaId = (string) ($row['id'] ?? '');
            $cleanFichaId = preg_replace('/[^0-9a-fA-F]/', '', $fichaId) ?? '';
            if (strlen($cleanFichaId) >= 12) {
                $placeholderTel = 'sin-tel-f-' . substr($cleanFichaId, 0, 18);
            } else {
                $placeholderTel = 'sin-tel-' . substr(md5($nombreRaw), 0, 18);
            }
        }

        try {
            $driver = (string) $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
            if ($driver === 'sqlite') {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON CONFLICT(telefono) DO UPDATE SET
                        dni = COALESCE(dni, excluded.dni),
                        motivo_consulta = COALESCE(motivo_consulta, excluded.motivo_consulta),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN excluded.profesional_habitual ELSE profesional_habitual END
                ';
            } else {
                $sql = '
                    INSERT INTO pacientes (telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, motivo_consulta, origen)
                    VALUES (:tel, :nombre, :apellido, :full, :pila, :dni, :prof, :motivo, "admin")
                    ON DUPLICATE KEY UPDATE
                        dni = COALESCE(dni, VALUES(dni)),
                        motivo_consulta = COALESCE(motivo_consulta, VALUES(motivo_consulta)),
                        profesional_habitual = CASE WHEN profesional_habitual = "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END
                ';
            }
            $stmtIns = $pdo->prepare($sql);
            $stmtIns->execute([
                'tel' => mb_substr($placeholderTel, 0, 30, 'UTF-8'),
                'nombre' => mb_substr($nombre, 0, 60, 'UTF-8'),
                'apellido' => mb_substr($apellido, 0, 60, 'UTF-8'),
                'full' => mb_substr($nombreRaw, 0, 120, 'UTF-8'),
                'pila' => mb_substr($nombrePila, 0, 60, 'UTF-8'),
                'dni' => $dniClean !== '' ? mb_substr($dniClean, 0, 20, 'UTF-8') : null,
                'prof' => $prof,
                'motivo' => $motivoRaw !== '' ? mb_substr($motivoRaw, 0, 255, 'UTF-8') : null,
            ]);
        } catch (Throwable) {}
    }
    // Dedupe/indistintos: no acá. Van en kinesica_pacientes_run_maintenance_if_due
    // o en action=deduplicate. Correrlos tras cada ficha/alta tumba el request.
}
