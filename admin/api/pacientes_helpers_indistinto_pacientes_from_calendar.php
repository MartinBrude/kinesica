<?php
declare(strict_types=1);


/**
 * Resuelve y actualiza pacientes que tengan 'indistinto' comparando contra
 * los turnos registrados en Google Calendar y la tabla recordatorio_eventos.
 */
function resolve_indistinto_pacientes_from_calendar(PDO $pdo): int
{
    $updatedCount = 0;
    try {
        // 1. Mapeo verificado de turnos históricos y agendados en Google Calendar
        // de pacientes que figuraban como 'indistinto'.
        $calendarSeedResolutions = [
            'gaglio silvina' => 'norberto',       // Miércoles 14:00 - norberto1712@gmail.com
            'silvina gaglio' => 'norberto',
            'maldonado ana' => 'maria',           // Lunes 12:00 - manosmagicas7116@gmail.com
            'ana maldonado' => 'maria',
            'augusto oviedo' => 'norberto',       // Lunes 17:30 - norberto1712@gmail.com
            'oviedo augusto' => 'norberto',
            'alejandro rosenfeld' => 'maria',     // Lunes 10:00 - manosmagicas7116@gmail.com
            'rosenfeld alejandro' => 'maria',
            'lipsyc silvana' => 'maria',          // Lunes 11:00 - manosmagicas7116@gmail.com
            'silvana lipsyc' => 'maria',
            'esteban jorge' => 'norberto',        // Miércoles 11:15 - norberto1712@gmail.com
            'jorge esteban' => 'norberto',
            'claudia victos' => 'norberto',       // Martes 18:00 - norberto1712@gmail.com
            'victos claudia' => 'norberto',
            'claudia maria victos' => 'norberto',
            'claudia victos maria' => 'norberto',
            'ma claudia victos' => 'norberto',
        ];

        // Teléfonos conocidos de calendar
        $calendarPhoneResolutions = [
            '5491154562619' => 'norberto', // Augusto Oviedo 1154562619
            '5491149927754' => 'norberto', // Jorge Esteban 1149927754
        ];

        // Obtener todos los pacientes que estén en 'indistinto' o vacíos
        $stmtIndistintos = $pdo->query("
            SELECT id, telefono, nombre, apellido, nombre_completo, profesional_habitual 
            FROM pacientes 
            WHERE profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = ''
        ");
        if (!$stmtIndistintos) {
            return 0;
        }

        $indistintos = $stmtIndistintos->fetchAll(PDO::FETCH_ASSOC);
        if (empty($indistintos)) {
            return 0;
        }

        // Consultar eventos de recordatorios si la tabla existe
        $eventosMap = [];
        try {
            $stmtEv = $pdo->query("
                SELECT patient_name, wa_id, appointment_date, appointment_time, event_summary 
                FROM recordatorio_eventos 
                WHERE (appointment_date IS NOT NULL AND appointment_date != '') 
                   OR (event_summary IS NOT NULL AND event_summary != '')
                ORDER BY run_at DESC
            ");
            if ($stmtEv) {
                while ($ev = $stmtEv->fetch(PDO::FETCH_ASSOC)) {
                    $inferred = infer_practitioner_from_schedule(
                        (string) ($ev['appointment_date'] ?? ''),
                        (string) ($ev['appointment_time'] ?? ''),
                        (string) ($ev['event_summary'] ?? '')
                    );
                    if ($inferred !== 'indistinto') {
                        $wa = preg_replace('/\D+/', '', (string) ($ev['wa_id'] ?? ''));
                        if ($wa !== '') {
                            $eventosMap['phone_' . $wa] = $inferred;
                            if (strlen($wa) >= 8) {
                                $eventosMap['phone_' . substr($wa, -8)] = $inferred;
                            }
                        }
                        $nameKey = canonical_patient_name_key((string) ($ev['patient_name'] ?? ''));
                        if ($nameKey !== '') {
                            $eventosMap['name_' . $nameKey] = $inferred;
                        }
                    }
                }
            }
        } catch (Throwable) {}

        $updateStmt = $pdo->prepare("
            UPDATE pacientes 
            SET profesional_habitual = :prof 
            WHERE id = :id AND (profesional_habitual = 'indistinto' OR profesional_habitual IS NULL OR profesional_habitual = '')
        ");

        foreach ($indistintos as $p) {
            $id = (int) $p['id'];
            $targetProf = null;

            // 1. Por teléfono directo
            $cleanTel = preg_replace('/\D+/', '', (string) ($p['telefono'] ?? ''));
            if ($cleanTel !== '' && isset($calendarPhoneResolutions[$cleanTel])) {
                $targetProf = $calendarPhoneResolutions[$cleanTel];
            } elseif ($cleanTel !== '' && isset($eventosMap['phone_' . $cleanTel])) {
                $targetProf = $eventosMap['phone_' . $cleanTel];
            } elseif (strlen($cleanTel) >= 8 && isset($eventosMap['phone_' . substr($cleanTel, -8)])) {
                $targetProf = $eventosMap['phone_' . substr($cleanTel, -8)];
            }

            // 2. Por coincidencia de nombre si aún no se determinó
            if ($targetProf === null) {
                $fullName = trim(($p['nombre_completo'] ?? '') ?: (($p['nombre'] ?? '') . ' ' . ($p['apellido'] ?? '')));
                $nKey = canonical_patient_name_key($fullName);
                if ($nKey !== '' && isset($calendarSeedResolutions[$nKey])) {
                    $targetProf = $calendarSeedResolutions[$nKey];
                } elseif ($nKey !== '' && isset($eventosMap['name_' . $nKey])) {
                    $targetProf = $eventosMap['name_' . $nKey];
                } else {
                    // Tokens parciales (por ejemplo "claudia victos" dentro de "claudia maria victos")
                    foreach ($calendarSeedResolutions as $seedKey => $profVal) {
                        $seedTokens = explode(' ', $seedKey);
                        $matchAllTokens = true;
                        foreach ($seedTokens as $st) {
                            if (!str_contains($nKey, $st)) {
                                $matchAllTokens = false;
                                break;
                            }
                        }
                        if ($matchAllTokens) {
                            $targetProf = $profVal;
                            break;
                        }
                    }
                }
            }

            if ($targetProf === 'norberto' || $targetProf === 'maria') {
                $updateStmt->execute(['prof' => $targetProf, 'id' => $id]);
                $updatedCount++;
            }
        }
    } catch (Throwable $e) {
        error_log('resolve_indistinto_pacientes_from_calendar error: ' . $e->getMessage());
    }

    return $updatedCount;
}

