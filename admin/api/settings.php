<?php
declare(strict_types=1);

define('KINESICA_HORARIOS_INCLUDED', true);
require_once __DIR__ . '/horarios.php';

header('Content-Type: application/json; charset=utf-8');

$settingsFile = kinesica_settings_source_file();

function get_runtime_settings(string $file): array
{
    return load_full_runtime_settings($file);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (!empty($_SERVER['HTTP_X_KINESICA']) || isset($_GET['_t'])) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
    } else {
        header('Cache-Control: public, max-age=15, stale-while-revalidate=45');
    }
    echo json_encode(get_runtime_settings($settingsFile), JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    require __DIR__ . '/lib.php';
    require_header();
    $user = require_auth();

    $input = read_json();
    $userName = (string) ($user['name'] ?: $user['username']);

    try {
        kinesica_update_settings(function (array $raw) use ($input, $userName): array {
            $current = load_full_runtime_settings(kinesica_settings_source_file());
            $now = gmdate('Y-m-d\TH:i:s\Z');

            if (isset($input['clara_active'])) {
                $raw['clara_active'] = (bool) $input['clara_active'];
            }
            if (isset($input['booking_active'])) {
                $raw['booking_active'] = (bool) $input['booking_active'];
            }
            if (isset($input['fees']) && is_array($input['fees'])) {
                $fees = $current['fees'];
                $atmVal = isset($input['fees']['atm']) ? (int) $input['fees']['atm'] : ($fees['atm'] ?? 65000);
                $genVal = isset($input['fees']['general']) ? (int) $input['fees']['general'] : ($fees['general'] ?? 75000);
                $payVal = isset($input['fees']['payment_methods']) ? trim((string) $input['fees']['payment_methods']) : ($fees['payment_methods'] ?? 'Efectivo o transferencia bancaria');
                $raw['fees'] = [
                    'atm' => max(0, $atmVal),
                    'general' => max(0, $genVal),
                    'payment_methods' => $payVal ?: 'Efectivo o transferencia bancaria',
                    'updated_at' => $now,
                    'updated_by' => $userName,
                ];
            }

            if (isset($input['practitioner_hours']) && is_array($input['practitioner_hours'])) {
                $val = validate_practitioner_hours_php($input['practitioner_hours']);
                if (!$val['isValid']) {
                    json_out(422, [
                        'error' => implode(' ', $val['errors']),
                        'errors' => $val['errors'],
                        'conflicts' => $val['conflicts'],
                    ]);
                }
                $raw['practitioner_hours'] = $val['normalized'];
                $raw['horarios_updated_at'] = $now;
                $raw['horarios_updated_by'] = $userName;
            }

            if (isset($input['header_schedule']) && is_array($input['header_schedule'])) {
                $rawOpens = trim((string) ($input['header_schedule']['opens'] ?? ''));
                $rawCloses = trim((string) ($input['header_schedule']['closes'] ?? ''));
                if (preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawOpens) && preg_match('/^([01]\d|2[0-3]):(00|30)$/', $rawCloses)) {
                    $raw['header_schedule'] = ['opens' => $rawOpens, 'closes' => $rawCloses];
                }
            }

            $touchesTexts = (isset($input['clara_texts']) && is_array($input['clara_texts'])) || isset($input['custom_menu_options']);
            if ($touchesTexts) {
                // Control optimista: si otro guardado cambió los textos desde que se cargó la página, no pisarlo.
                $revision = (int) ($raw['clara_texts_revision'] ?? 0);
                if (array_key_exists('base_revision', $input) && (int) $input['base_revision'] !== $revision) {
                    throw new KinesicaSettingsConflict('Los textos se modificaron desde otra sesión. Recargá la página para ver la versión actual antes de guardar.');
                }
                $raw['clara_texts_revision'] = $revision + 1;
            }

            if (isset($input['clara_texts']) && is_array($input['clara_texts'])) {
                $allowed = [
                    'menu_welcome', 'opt_a_text', 'opt_b_text', 'opt_c_text', 'opt_d_text', 'opt_e_text',
                    'submenu_turnos_text', 'opt_a2_text',
                    'opt_e1_text', 'opt_e2_text', 'opt_e3_text',
                    'menu_welcome_en', 'opt_a_text_en', 'opt_b_text_en', 'opt_c_text_en', 'opt_d_text_en', 'opt_e_text_en',
                    'submenu_turnos_text_en', 'opt_a2_text_en',
                    'opt_e1_text_en', 'opt_e2_text_en', 'opt_e3_text_en',
                    'cancellation_policy', 'confirmation_notes', 'reminder_text', 'reminder_notes'
                ];
                $cleanTexts = isset($raw['clara_texts']) && is_array($raw['clara_texts']) ? $raw['clara_texts'] : [];
                foreach ($allowed as $field) {
                    if (isset($input['clara_texts'][$field])) {
                        $cleanTexts[$field] = trim((string) $input['clara_texts'][$field]);
                    }
                }
                $cleanTexts['updated_at'] = $now;
                $cleanTexts['updated_by'] = $userName;
                $raw['clara_texts'] = $cleanTexts;
            }

            if (isset($input['custom_menu_options']) || isset($input['clara_texts']['custom_menu_options'])) {
                $rawOpts = $input['custom_menu_options'] ?? ($input['clara_texts']['custom_menu_options'] ?? []);
                $cleanOpts = [];
                if (is_array($rawOpts)) {
                    $reserved = ['A', 'B', 'C', 'D', 'E', 'F'];
                    foreach ($rawOpts as $row) {
                        if (!is_array($row)) continue;
                        $letter = strtoupper(trim((string) ($row['letter'] ?? '')));
                        $label = trim((string) ($row['label'] ?? ($row['title'] ?? '')));
                        $response = trim((string) ($row['response'] ?? ($row['text'] ?? '')));
                        if ($letter === '' || in_array($letter, $reserved, true)) continue;
                        if ($label === '' && $response === '') continue;
                        $cleanOpts[] = ['letter' => $letter, 'label' => $label, 'response' => $response];
                    }
                }
                $raw['custom_menu_options'] = $cleanOpts;
                if (isset($raw['clara_texts']) && is_array($raw['clara_texts'])) {
                    $raw['clara_texts']['custom_menu_options'] = $cleanOpts;
                }
            }

            return $raw;
        });
    } catch (KinesicaSettingsConflict $e) {
        json_out(409, ['error' => $e->getMessage(), 'conflict' => true, 'current' => get_runtime_settings(kinesica_settings_source_file())]);
    } catch (Throwable $e) {
        json_out(500, ['error' => 'No se pudo guardar la configuración.']);
    }

    json_out(200, get_runtime_settings(kinesica_settings_source_file()));
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
