<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/pacientes_helpers.php';
require_once __DIR__ . '/../admin/api/lib_recordatorios_view.php';
require_once __DIR__ . '/../admin/api/calendar_event_parse.php';

$n = 0;
function eq($a, $b, string $msg): void
{
    global $n;
    $n++;
    if ($a !== $b) {
        fwrite(STDERR, "FAIL #$n $msg\n  expected: " . var_export($b, true) . "\n  got: " . var_export($a, true) . "\n");
        exit(1);
    }
}

$c1 = kinesica_extract_calendar_contacts(
    '🩺 [NORBERTO] Ana Pérez',
    "teléfono: 11 5555-6666\ndocumento: 30.111.222"
);
eq($c1['phone'], '5491155556666', 'teléfono con tilde desde descripción');
eq($c1['dni'], '30111222', 'documento desde descripción');

$c2 = kinesica_extract_calendar_contacts(
    'Luis',
    'WhatsApp: 1122334455 | DNI: 28111222 | Origen: web'
);
eq($c2['phone'], '5491122334455', 'whatsapp legacy pipe');
eq($c2['dni'], '28111222', 'dni clave en pipe');

$c3 = kinesica_extract_calendar_contacts('telefono: 1155667788 Ana', '');
eq($c3['phone'], '5491155667788', 'clave:valor en título se conserva como fallback');

$c4 = kinesica_extract_calendar_contacts('Ana', '📱 WhatsApp: 11 9999-8888');
eq($c4['phone'], '5491199998888', 'legacy emoji WhatsApp');

// DNI solo no debe inventar un WhatsApp (antes: 5491128111222).
$c5 = kinesica_extract_calendar_contacts('Paciente', 'DNI: 28111222');
eq($c5['phone'], '', 'DNI solo no es teléfono');
eq($c5['dni'], '28111222', 'DNI solo se parsea como dni');

$c6 = kinesica_extract_calendar_contacts('Paciente', 'CI: 30111222');
eq($c6['phone'], '', 'CI solo no es teléfono');
eq($c6['dni'], '30111222', 'CI se parsea como dni');

$c7 = kinesica_extract_calendar_contacts(
    'Ana',
    "documento: 30.111.222\ntelefono: 30111222"
);
eq($c7['dni'], '30111222', 'documento + telefono falso: dni ok');
eq($c7['phone'], '', 'telefono igual al DNI se descarta');

$c8 = kinesica_extract_calendar_contacts('Paciente', 'DU 28.111.222');
eq($c8['phone'], '', 'DU suelto no es teléfono');
eq($c8['dni'], '28111222', 'DU suelto es dni');

echo "calendar event parse: ok ($n pruebas)\n";
