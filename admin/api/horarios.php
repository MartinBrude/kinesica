<?php
declare(strict_types=1);

/**
 * Kinésica Admin - Gestión y Validación de Horarios de Profesionales
 */

require_once __DIR__ . '/horarios_validator.php';
require_once __DIR__ . '/horarios_summary.php';
require_once __DIR__ . '/kinesica_settings_storage.php';

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

function load_full_runtime_settings(string $file): array
{
    $defaultHours = default_practitioner_hours();
    $defaults = [
        'clara_active' => false,
        'booking_active' => true,
        'practitioner_hours' => $defaultHours,
        'header_schedule' => ['opens' => '08:00', 'closes' => '19:00'],
        'horarios_updated_at' => null,
        'horarios_updated_by' => null,
    ];

    if (!is_file($file)) return $defaults;
    $raw = @file_get_contents($file);
    if ($raw === false) return $defaults;
    $data = json_decode($raw, true);
    if (!is_array($data)) return $defaults;

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
        'menu_welcome' => "¡Hola! Te damos la bienvenida a *Kinésica* 🩺\n\nPor favor, respondé con la letra de la opción que necesitás:\n*A.* 📅 Turnos\n*B.* 📍 Ubicación\n*C.* 💳 Honorarios\n*D.* 👕 Vestimenta\n*E.* 💬 Contacto\n*F.* 🌐 English",
        'opt_a_text' => 'Para coordinar o consultar turnos, ingresá a nuestra turnera online: https://kinesica.com.ar/agendar 📅',
        'opt_b_text' => 'Kinésica queda en Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz). 📍',
        'opt_c_text' => "💳 *Honorarios y Cobertura*\n• *Honorarios:* {honorario_atm} para ATM (bruxismo / dolor mandibular) y {honorario_general} para el resto de las consultas (kinesiología general, osteopatía, RPG, etc.). Las sesiones son individuales y de 60 minutos.\n• *Medios de pago:* Se puede abonar en {medios_pago}.\n• *Cobertura:* Atendemos de forma particular. Al finalizar tu sesión te entregamos la factura oficial para que puedas presentarla en tu prepaga u obra social y solicitar el reintegro correspondiente según tu plan 📄.",
        'opt_d_text' => "Indumentaria para la sesión:\n• Ropa interior o pantalón corto para los varones.\n• Ropa interior con corpiño tradicional, malla de 2 piezas o calza corta para las mujeres.",
        'opt_e_text' => "💬 *Contacto con un Profesional*\n\n¿Con quién te gustaría comunicarte?\n*1.* Lic. Norberto Brude\n*2.* Lic. María Gulin\n*3.* Indistinto",
        'submenu_turnos_text' => "📅 *Gestión de Turnos - Kinésica*\n\n*1.* 📅 Agendar un nuevo turno\n*2.* 📋 Consultar o cancelar mis turnos",
        'opt_a2_text' => "Con este número de WhatsApp no encontramos turnos agendados.",
        'opt_e1_text' => "¡Perfecto! Ya le transmitimos tu consulta al Lic. Norberto Brude.",
        'opt_e2_text' => "¡Perfecto! Ya le transmitimos tu consulta a la Lic. María Gulin.",
        'opt_e3_text' => "¡Perfecto! Ya le transmitimos tu consulta a nuestro equipo de kinesiólogos.",
        'menu_welcome_en' => "Hello! Welcome to *Kinésica* 🩺",
        'opt_a_text_en' => "📅 *Appointments & Booking - Kinésica*",
        'opt_b_text_en' => "📍 *Kinésica Clinic*",
        'opt_c_text_en' => "💳 *Fees and Coverage*",
        'opt_d_text_en' => "👕 *Attire for your session*",
        'opt_e_text_en' => "💬 *Contact a Practitioner*",
        'submenu_turnos_text_en' => "📅 *Appointments - Kinésica*",
        'opt_a2_text_en' => "We couldn't find any scheduled appointments for this WhatsApp number.",
        'opt_e1_text_en' => "Great! We've forwarded your message to Lic. Norberto Brude.",
        'opt_e2_text_en' => "Great! We've forwarded your message to Lic. María Gulin.",
        'opt_e3_text_en' => "Great! We've forwarded your message to our physical therapy team.",
        'cancellation_policy' => 'Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.',
        'confirmation_notes' => 'Por favor asistir con puntualidad exacta al horario asignado.',
        'reminder_text' => "¡Hola {nombre}! 🌿 Te escribo desde Kinésica para recordarte tu sesión.",
        'reminder_notes' => "📍 Te esperamos en Charcas 3889, 5º, B (Palermo).",
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
                $customOptions[] = ['letter' => $letter, 'label' => $label, 'response' => $response];
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
    $auth = require_auth();

    $input = read_json();
    $current = load_full_runtime_settings($settingsFile);

    if (($input['action'] ?? 'save') === 'reset') {
        json_out(400, ['error' => 'La restauración de horarios por defecto ya no está disponible.']);
    }
    $targetHours = $input['practitioner_hours'] ?? $input;

    $validation = validate_practitioner_hours_php($targetHours);
    if (!$validation['isValid']) {
        json_out(422, [
            'status' => 'error',
            'message' => 'Superposición de camilla o rango horario inválido detectado.',
            'errors' => $validation['errors'],
            'conflicts' => $validation['conflicts'],
        ]);
    }

    $headerSchedule = null;
    if (isset($input['header_schedule']) && is_array($input['header_schedule'])) {
        $rawOpens = trim((string) ($input['header_schedule']['opens'] ?? ''));
        $rawCloses = trim((string) ($input['header_schedule']['closes'] ?? ''));
        if (preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawOpens) && preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawCloses)) {
            $headerSchedule = ['opens' => $rawOpens, 'closes' => $rawCloses];
        }
    }

    $now = gmdate('Y-m-d\TH:i:s\Z');
    $userName = (string) ($auth['name'] ?? $auth['username'] ?? 'admin');

    $saved = kinesica_update_settings(function (array $raw) use ($validation, $headerSchedule, $now, $userName): array {
        $raw['practitioner_hours'] = $validation['normalized'];
        if ($headerSchedule !== null) {
            $raw['header_schedule'] = $headerSchedule;
        }
        $raw['horarios_updated_at'] = $now;
        $raw['horarios_updated_by'] = $userName;
        return $raw;
    });

    $resp = load_full_runtime_settings($settingsFile);
    json_out(200, [
        'status' => 'success',
        'message' => 'Horarios actualizados correctamente.',
        'practitioner_hours' => $resp['practitioner_hours'],
        'practitioner_hours_py' => $resp['practitioner_hours_py'],
        'clara_schedule_summary' => $resp['clara_schedule_summary'],
        'header_schedule' => $resp['header_schedule'],
        'updated_at' => $resp['horarios_updated_at'],
        'updated_by' => $resp['horarios_updated_by'],
    ]);
}

json_out(405, ['error' => 'Método no permitido']);
