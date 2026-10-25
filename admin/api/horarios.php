<?php
declare(strict_types=1);

/**
 * Kinésica Admin - Gestión y Validación de Horarios de Profesionales
 * ==================================================================
 * Fuente única de verdad para:
 * 1. Módulo Horarios en /admin (Martín, Norberto y María).
 * 2. Turnera Web (Agendar) y Google Apps Script.
 * 3. Chatbot Clara (WhatsApp / n8n) en formato JS (1..5), Python (0..4) y texto para prompt.
 */

function default_practitioner_hours(): array
{
    return [
        'norberto' => [
            '1' => [['start' => '17:30', 'end' => '19:30']],
            '2' => [['start' => '16:30', 'end' => '19:30']],
            '3' => [['start' => '09:00', 'end' => '16:30']],
            '4' => [['start' => '15:00', 'end' => '19:00']],
            '5' => [['start' => '13:30', 'end' => '19:30']],
        ],
        'maria' => [
            '1' => [['start' => '09:00', 'end' => '17:00']],
            '2' => [['start' => '09:00', 'end' => '16:00']],
            '5' => [['start' => '09:00', 'end' => '13:00']],
        ],
    ];
}

function hm_to_minutes(string $hm): int
{
    $parts = explode(':', trim($hm));
    return ((int) ($parts[0] ?? 0)) * 60 + ((int) ($parts[1] ?? 0));
}

function minutes_to_hm(int $totalMin): string
{
    $h = str_pad((string) intdiv($totalMin, 60), 2, '0', STR_PAD_LEFT);
    $m = str_pad((string) ($totalMin % 60), 2, '0', STR_PAD_LEFT);
    return "{$h}:{$m}";
}

function is_valid_hm(string $hm): bool
{
    return (bool) preg_match('/^([01]\d|2[0-3]):(00|30)$/', trim($hm));
}

/**
 * Valida las reglas de negocio de horarios (1 sola camilla, máx 2 franjas/día, mín 60 min).
 */
function validate_practitioner_hours_php(mixed $input): array
{
    $errors = [];
    $conflicts = [];
    $normalized = [
        'norberto' => [],
        'maria' => [],
    ];

    if (!is_array($input)) {
        return [
            'isValid' => false,
            'errors' => ['El formato de horarios enviado no es válido.'],
            'conflicts' => [],
            'normalized' => default_practitioner_hours(),
        ];
    }

    $dayNames = [
        1 => 'Lunes',
        2 => 'Martes',
        3 => 'Miércoles',
        4 => 'Jueves',
        5 => 'Viernes',
    ];

    $parsedByDay = [1 => [], 2 => [], 3 => [], 4 => [], 5 => []];

    foreach (['maria' => 'María', 'norberto' => 'Norberto'] as $pid => $pLabel) {
        $pSource = $input[$pid] ?? [];
        if (!is_array($pSource)) {
            continue;
        }

        foreach ($pSource as $rawDow => $rawList) {
            if (!is_array($rawList) || count($rawList) === 0) {
                continue;
            }
            $dow = (int) $rawDow;
            if ($dow < 1 || $dow > 5) {
                $errors[] = "Solo se permiten días de lunes a viernes ({$pLabel}).";
                continue;
            }
            $dayName = $dayNames[$dow];
            if (count($rawList) > 2) {
                $errors[] = "{$pLabel} ({$dayName}): se permiten hasta 2 franjas horarias por día.";
                continue;
            }

            $dayRanges = [];
            foreach (array_values($rawList) as $idx => $item) {
                $fNum = $idx + 1;
                $start = is_array($item) && isset($item['start']) ? trim((string) $item['start']) : '';
                $end = is_array($item) && isset($item['end']) ? trim((string) $item['end']) : '';

                if (!is_valid_hm($start) || !is_valid_hm($end)) {
                    $errors[] = "{$pLabel} ({$dayName}, franja {$fNum}): formato de hora inválido (usar HH:00 o HH:30).";
                    continue;
                }
                $startMin = hm_to_minutes($start);
                $endMin = hm_to_minutes($end);

                if ($startMin < 8 * 60 || $endMin > 20 * 60) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): el horario debe estar entre las 08:00 y las 20:00 hs.";
                    continue;
                }
                if ($endMin <= $startMin) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): la hora de fin debe ser posterior a la de inicio.";
                    continue;
                }
                if ($endMin - $startMin < 60) {
                    $errors[] = "{$pLabel} ({$dayName}: {$start} a {$end}): cada franja debe durar al menos 60 minutos.";
                    continue;
                }

                $dayRanges[] = [
                    'start' => $start,
                    'end' => $end,
                    'startMin' => $startMin,
                    'endMin' => $endMin,
                ];
            }

            usort($dayRanges, static fn(array $a, array $b): int => $a['startMin'] <=> $b['startMin']);

            if (count($dayRanges) === 2 && $dayRanges[0]['endMin'] > $dayRanges[1]['startMin']) {
                $errors[] = "{$pLabel} ({$dayName}): las dos franjas del mismo día se superponen ({$dayRanges[0]['start']}–{$dayRanges[0]['end']} y {$dayRanges[1]['start']}–{$dayRanges[1]['end']}).";
            }

            if (count($dayRanges) > 0) {
                $parsedByDay[$dow][$pid] = $dayRanges;
                $normalized[$pid][(string) $dow] = array_map(
                    static fn(array $r): array => ['start' => $r['start'], 'end' => $r['end']],
                    $dayRanges
                );
            }
        }
    }

    // Validar que Norberto y María no se superpongan en la única camilla del consultorio
    foreach ([1, 2, 3, 4, 5] as $dow) {
        $mList = $parsedByDay[$dow]['maria'] ?? [];
        $nList = $parsedByDay[$dow]['norberto'] ?? [];
        $dayName = $dayNames[$dow];

        foreach ($mList as $mRange) {
            foreach ($nList as $nRange) {
                $overlapStart = max($mRange['startMin'], $nRange['startMin']);
                $overlapEnd = min($mRange['endMin'], $nRange['endMin']);
                if ($overlapStart < $overlapEnd) {
                    $oStartStr = minutes_to_hm($overlapStart);
                    $oEndStr = minutes_to_hm($overlapEnd);
                    $msg = "Superposición de camilla el {$dayName}: María ({$mRange['start']} a {$mRange['end']}) se pisa con Norberto ({$nRange['start']} a {$nRange['end']}) entre las {$oStartStr} y las {$oEndStr} hs.";
                    $errors[] = $msg;
                    $conflicts[] = [
                        'day' => $dow,
                        'dayName' => $dayName,
                        'overlapStart' => $oStartStr,
                        'overlapEnd' => $oEndStr,
                        'maria' => ['start' => $mRange['start'], 'end' => $mRange['end']],
                        'norberto' => ['start' => $nRange['start'], 'end' => $nRange['end']],
                        'message' => $msg,
                    ];
                }
            }
        }
    }

    return [
        'isValid' => count($errors) === 0,
        'errors' => $errors,
        'conflicts' => $conflicts,
        'normalized' => $normalized,
    ];
}

/**
 * Convierte el mapa JS (1=Lunes..5=Viernes) al formato Python weekday (0=Lunes..4=Viernes)
 * utilizado por free_slot_engine.py en kinesica-bot (Clara).
 */
function convert_hours_to_python_weekdays(array $hours): array
{
    $out = ['norberto' => [], 'maria' => []];
    foreach (['norberto', 'maria'] as $pid) {
        $pDays = $hours[$pid] ?? [];
        if (!is_array($pDays)) {
            continue;
        }
        foreach ($pDays as $jsDow => $ranges) {
            $pyDow = ((int) $jsDow) - 1;
            if ($pyDow >= 0 && $pyDow <= 4 && is_array($ranges) && count($ranges) > 0) {
                $out[$pid][(string) $pyDow] = array_map(
                    static fn(array $r): array => [$r['start'], $r['end']],
                    $ranges
                );
            }
        }
    }
    return $out;
}

function join_day_names_es(array $names): string
{
    $count = count($names);
    if ($count === 0) {
        return '';
    }
    if ($count === 1) {
        return $names[0];
    }
    if ($count === 2) {
        return "{$names[0]} y {$names[1]}";
    }
    $last = array_pop($names);
    return implode(', ', $names) . " y {$last}";
}

/**
 * Construye el resumen textual exacto para el prompt del chatbot Clara (WhatsApp / n8n).
 */
function build_clara_schedule_summary(array $hours): string
{
    $dayNames = [
        1 => 'Lunes',
        2 => 'Martes',
        3 => 'Miércoles',
        4 => 'Jueves',
        5 => 'Viernes',
    ];
    $lines = ['Horarios oficiales:'];

    $profs = [
        ['id' => 'maria', 'title' => 'Lic. María Gulin', 'short' => 'María'],
        ['id' => 'norberto', 'title' => 'Lic. Norberto Brude', 'short' => 'Norberto'],
    ];

    foreach ($profs as $prof) {
        $lines[] = "- {$prof['title']}:";
        $pHours = $hours[$prof['id']] ?? [];
        $offDays = [];

        foreach ([1, 2, 3, 4, 5] as $dow) {
            $dayName = $dayNames[$dow];
            $ranges = $pHours[(string) $dow] ?? $pHours[$dow] ?? [];
            if (!is_array($ranges) || count($ranges) === 0) {
                $offDays[] = $dayName;
                continue;
            }
            if (count($ranges) === 1) {
                $r = $ranges[0];
                $lastTurn = minutes_to_hm(hm_to_minutes($r['end']) - 60);
                $lines[] = "  * {$dayName}: {$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive; el último turno finaliza a las {$r['end']} hs).";
            } else {
                $parts = [];
                $total = count($ranges);
                foreach (array_values($ranges) as $idx => $r) {
                    $lastTurn = minutes_to_hm(hm_to_minutes($r['end']) - 60);
                    if ($idx === $total - 1) {
                        $parts[] = "{$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive; el último turno finaliza a las {$r['end']} hs)";
                    } else {
                        $parts[] = "{$r['start']} a {$r['end']} hs (turnos de {$r['start']} a {$lastTurn} hs inclusive)";
                    }
                }
                $lines[] = "  * {$dayName}: " . implode(' y ', $parts) . '.';
            }
        }

        if (count($offDays) === 5) {
            $lines[] = "  * Lunes a Viernes: {$prof['short']} sin horarios de consultorio asignados.";
        } elseif (count($offDays) > 0) {
            $joined = join_day_names_es($offDays);
            $lines[] = "  * {$joined}: {$prof['short']} no atiende en consultorio.";
        }
    }

    return implode("\n", $lines);
}

function load_full_runtime_settings(string $file): array
{
    $defaultHours = default_practitioner_hours();
    $defaults = [
        'clara_active' => false,
        'booking_active' => false,
        'practitioner_hours' => $defaultHours,
        'header_schedule' => ['opens' => '08:00', 'closes' => '19:00'],
        'horarios_updated_at' => null,
        'horarios_updated_by' => null,
    ];

    if (!is_file($file)) {
        return $defaults;
    }
    $raw = @file_get_contents($file);
    if ($raw === false) {
        return $defaults;
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return $defaults;
    }

    $hours = $defaultHours;
    if (isset($data['practitioner_hours']) && is_array($data['practitioner_hours'])) {
        $val = validate_practitioner_hours_php($data['practitioner_hours']);
        if ($val['isValid']) {
            $hours = $val['normalized'];
        }
    }

    $defaultFees = [
        'atm' => 65000,
        'general' => 75000,
        'payment_methods' => 'Efectivo o transferencia bancaria',
        'updated_at' => null,
        'updated_by' => null,
    ];
    $fees = $defaultFees;
    if (isset($data['fees']) && is_array($data['fees'])) {
        $fees['atm'] = isset($data['fees']['atm']) ? (int) $data['fees']['atm'] : $defaultFees['atm'];
        $fees['general'] = isset($data['fees']['general']) ? (int) $data['fees']['general'] : $defaultFees['general'];
        $fees['payment_methods'] = !empty($data['fees']['payment_methods']) ? (string) $data['fees']['payment_methods'] : $defaultFees['payment_methods'];
        $fees['updated_at'] = $data['fees']['updated_at'] ?? null;
        $fees['updated_by'] = $data['fees']['updated_by'] ?? null;
    }

    $defaultClaraTexts = [
        'menu_welcome' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺

Por favor, respondé con la letra de la opción que necesitás:

*A.* 📅 Turnos (agendar, consultar o cancelar)
*B.* 📍 Ubicación y horarios del consultorio
*C.* 💳 Honorarios y cobertura (obras sociales / reintegros)
*D.* 👕 ¿Cómo venir vestido/a a la sesión?
*E.* 💬 Comunicarte con un profesional (Lic. Norberto Brude / Lic. María Gulin)

_(Escribí la letra de la opción deseada, por ejemplo *A* o *C*)_",
        'opt_a_text' => 'Para coordinar o consultar turnos, ingresá a nuestra turnera online: https://kinesica.com.ar/agendar 📅',
        'opt_b_text' => 'Kinésica queda en Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz). 📍',
        'opt_c_text' => "💳 *Honorarios y Cobertura*\n• *Honorarios:* {honorario_atm} para ATM (bruxismo / dolor mandibular) y {honorario_general} para el resto de las consultas (kinesiología general, osteopatía, RPG, etc.). Las sesiones son individuales y de 60 minutos.\n• *Medios de pago:* Se puede abonar en {medios_pago}.\n• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu prepaga u obra social y solicitar el reintegro correspondiente según tu plan 📄.",
        'opt_d_text' => "Indumentaria para la sesión:\n• Ropa interior o pantalón corto para los varones.\n• Ropa interior con corpiño tradicional (no deportivo), malla de 2 piezas o calza corta para las mujeres.\nSi sos menor, vení acompañado/a por un mayor 🙌.",
        'opt_e_text' => "💬 *Contacto con un Profesional*\n\n¿Con quién te gustaría comunicarte?\n*1.* Lic. Norberto Brude\n*2.* Lic. María Gulin\n*3.* Indistinto / Primera consulta general\n\n_(Respondé *1*, *2* o *3*, o escribí tu consulta directamente y se la transmitimos)_\n_Escribí *MENU* para volver_",
        'cancellation_policy' => 'Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.',
        'confirmation_notes' => 'Por favor asistir con puntualidad exacta al horario asignado. No contamos con secretaria, si estamos atendiendo a otro paciente no podemos recibirte anticipadamente.',
        'reminder_text' => "¡Hola {nombre}! 🌿 Te escribo desde Kinésica para recordarte tu sesión en el consultorio programada para mañana a las {horario}.\n\n{indicaciones}\n\nPor favor confirmá tu asistencia seleccionando una de las opciones a continuación 🙌:",
        'reminder_notes' => "📍 Te esperamos en Charcas 3889, 5º, B (Palermo).\n⚠️ Te recordamos que el espacio no cuenta con sala de espera, por lo que te pedimos puntualidad estricta para evitar esperas en la entrada y no concurrir con acompañantes (salvo menores de edad o personas que requieran asistencia directa).\nSi tienen estudios médicos previos, no olviden traerlos.",
        'updated_at' => null,
        'updated_by' => null,
    ];
    $claraTexts = $defaultClaraTexts;
    if (isset($data['clara_texts']) && is_array($data['clara_texts'])) {
        foreach ($defaultClaraTexts as $k => $defVal) {
            if (isset($data['clara_texts'][$k]) && is_string($data['clara_texts'][$k])) {
                $claraTexts[$k] = trim($data['clara_texts'][$k]);
            }
        }
        $claraTexts['updated_at'] = $data['clara_texts']['updated_at'] ?? null;
        $claraTexts['updated_by'] = $data['clara_texts']['updated_by'] ?? null;
    }

    $customOptions = [];
    $rawCustom = $data['custom_menu_options'] ?? ($data['clara_texts']['custom_menu_options'] ?? []);
    if (is_array($rawCustom)) {
        foreach ($rawCustom as $row) {
            if (!is_array($row)) continue;
            $letter = strtoupper(trim((string) ($row['letter'] ?? '')));
            $label = trim((string) ($row['label'] ?? ($row['title'] ?? '')));
            $response = trim((string) ($row['response'] ?? ($row['text'] ?? '')));
            if ($letter !== '' && ($label !== '' || $response !== '')) {
                $customOptions[] = [
                    'letter' => $letter,
                    'label' => $label,
                    'response' => $response,
                ];
            }
        }
    }
    $claraTexts['custom_menu_options'] = $customOptions;

    $defaultHeaderSchedule = ['opens' => '08:00', 'closes' => '19:00'];
    $headerSchedule = $defaultHeaderSchedule;
    if (isset($data['header_schedule']) && is_array($data['header_schedule'])) {
        $rawOpens = trim((string) ($data['header_schedule']['opens'] ?? '08:00'));
        $rawCloses = trim((string) ($data['header_schedule']['closes'] ?? '19:00'));
        if (preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawOpens) && preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawCloses)) {
            $headerSchedule = ['opens' => $rawOpens, 'closes' => $rawCloses];
        }
    }

    return [
        'clara_active' => isset($data['clara_active']) ? (bool) $data['clara_active'] : true,
        'booking_active' => isset($data['booking_active']) ? (bool) $data['booking_active'] : true,
        'fees' => $fees,
        'clara_texts' => $claraTexts,
        'custom_menu_options' => $customOptions,
        'practitioner_hours' => $hours,
        'practitioner_hours_py' => convert_hours_to_python_weekdays($hours),
        'clara_schedule_summary' => build_clara_schedule_summary($hours),
        'header_schedule' => $headerSchedule,
        'horarios_updated_at' => $data['horarios_updated_at'] ?? null,
        'horarios_updated_by' => $data['horarios_updated_by'] ?? null,
        'clara_texts_revision' => (int) ($data['clara_texts_revision'] ?? 0),
    ];
}

/*
 * Almacenamiento de la configuración del admin.
 * admin/api/settings.json está versionado en git: cada `git push` (deploy de Hostinger) lo reemplaza en el
 * servidor por la copia del repo. Por eso los datos vivos se guardan en admin/api/data/settings.json
 * (no versionado; el deploy no lo toca) y settings.json queda sólo como semilla hasta el primer guardado.
 */
function kinesica_settings_runtime_file(): string
{
    return __DIR__ . '/data/settings.json';
}

function kinesica_settings_seed_file(): string
{
    return __DIR__ . '/settings.json';
}

/** Archivo a leer: el de datos vivos si existe; si no, la semilla versionada. */
function kinesica_settings_source_file(): string
{
    $runtime = kinesica_settings_runtime_file();
    return is_file($runtime) ? $runtime : kinesica_settings_seed_file();
}

function kinesica_settings_raw(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

final class KinesicaSettingsConflict extends RuntimeException
{
}

/**
 * Lee-modifica-escribe bajo lock exclusivo con escritura atómica (tmp + rename).
 * $mutate recibe el JSON crudo guardado y devuelve el nuevo: las claves que no toca se conservan
 * (guardar horarios no borra textos ni honorarios, y viceversa).
 */
function kinesica_update_settings(callable $mutate): array
{
    $runtime = kinesica_settings_runtime_file();
    $dir = dirname($runtime);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear el directorio de datos.');
    }
    $lock = @fopen($dir . '/.settings.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('No se pudo bloquear la configuración.');
    }
    try {
        $current = kinesica_settings_raw(kinesica_settings_source_file());
        $next = $mutate($current);
        $tmp = $runtime . '.tmp' . getmypid();
        $json = json_encode($next, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false || !@rename($tmp, $runtime)) {
            @unlink($tmp);
            throw new RuntimeException('No se pudo guardar la configuración.');
        }
        return $next;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

// Si este archivo se incluye como librería desde settings.php, no ejecutar el controlador HTTP
if (defined('KINESICA_HORARIOS_INCLUDED')) {
    return;
}

header('Content-Type: application/json; charset=utf-8');
$settingsFile = kinesica_settings_source_file();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    header('Cache-Control: no-cache, must-revalidate');
    $current = load_full_runtime_settings($settingsFile);
    echo json_encode([
        'status' => 'success',
        'practitioner_hours' => $current['practitioner_hours'],
        'practitioner_hours_py' => $current['practitioner_hours_py'],
        'clara_schedule_summary' => $current['clara_schedule_summary'],
        'header_schedule' => $current['header_schedule'] ?? ['opens' => '08:00', 'closes' => '19:00'],
        'updated_at' => $current['horarios_updated_at'],
        'updated_by' => $current['horarios_updated_by'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    require __DIR__ . '/lib.php';
    require_header();
    $user = require_auth();

    $input = read_json();
    $current = load_full_runtime_settings($settingsFile);

    // La acción 'reset' (restaurar horarios por defecto) se quitó del admin: ya no se acepta.
    if (($input['action'] ?? 'save') === 'reset') {
        json_out(400, ['error' => 'La restauración de horarios por defecto ya no está disponible.']);
    }
    $targetHours = $input['practitioner_hours'] ?? $input;

    $validation = validate_practitioner_hours_php($targetHours);
    if (!$validation['isValid']) {
        json_out(422, [
            'error' => implode(' ', $validation['errors']),
            'errors' => $validation['errors'],
            'conflicts' => $validation['conflicts'],
        ]);
    }

    $headerSchedule = null;
    if (isset($input['header_schedule']) && is_array($input['header_schedule'])) {
        $rawOpens = trim((string) ($input['header_schedule']['opens'] ?? ''));
        $rawCloses = trim((string) ($input['header_schedule']['closes'] ?? ''));
        if (!preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawOpens) || !preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawCloses)) {
            json_out(422, [
                'error' => 'El horario del encabezado debe tener formato HH:MM (08:00 a 20:00 hs en intervalos de 30 minutos).',
                'errors' => ['Formato de horario de encabezado inválido.'],
            ]);
        }
        $headerSchedule = ['opens' => $rawOpens, 'closes' => $rawCloses];
    }

    $normalizedHours = $validation['normalized'];
    $updatedAt = gmdate('Y-m-d\TH:i:s\Z');
    $updatedBy = (string) ($user['name'] ?: $user['username']);

    try {
        // Sólo cambia horarios: textos, honorarios y estados se conservan tal cual.
        kinesica_update_settings(function (array $raw) use ($normalizedHours, $headerSchedule, $updatedAt, $updatedBy): array {
            $raw['practitioner_hours'] = $normalizedHours;
            if ($headerSchedule !== null) {
                $raw['header_schedule'] = $headerSchedule;
            }
            $raw['horarios_updated_at'] = $updatedAt;
            $raw['horarios_updated_by'] = $updatedBy;
            return $raw;
        });
    } catch (Throwable $e) {
        json_out(500, ['error' => 'No se pudieron guardar los horarios en el servidor.']);
    }

    $savedHeaderSchedule = $headerSchedule ?? ($current['header_schedule'] ?? ['opens' => '08:00', 'closes' => '19:00']);

    json_out(200, [
        'status' => 'success',
        'practitioner_hours' => $normalizedHours,
        'practitioner_hours_py' => convert_hours_to_python_weekdays($normalizedHours),
        'clara_schedule_summary' => build_clara_schedule_summary($normalizedHours),
        'header_schedule' => $savedHeaderSchedule,
        'updated_at' => $updatedAt,
        'updated_by' => $updatedBy,
    ]);
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
