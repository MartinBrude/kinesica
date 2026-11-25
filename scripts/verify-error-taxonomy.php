<?php
declare(strict_types=1);

/**
 * Taxonomía de errores admin (Meta WA, validaciones, clasificación de excepciones).
 * Ejecución: php scripts/verify-error-taxonomy.php
 *
 * Sin KT_DB_HOST: omite persistencia de contactos (mismo patrón que test-recordatorios-contact.php).
 */

define('KINESICA_SKIP_ADMIN_EXCEPTION_HANDLER', true);

require_once __DIR__ . '/../admin/api/lib.php';
require_once __DIR__ . '/../admin/api/lib_whatsapp_template.php';

function assert_test(bool $cond, string $msg): void
{
    if (!$cond) {
        fwrite(STDERR, "FALLÓ: {$msg}\n");
        exit(1);
    }
    echo "• {$msg}\n";
}

echo "=== Test 1: Traductor de errores de WhatsApp / Meta ===\n";
$trans131030 = whatsapp_explain_meta_error(400, 131030, '', '5491144556677');
assert_test($trans131030['category'] === 'user_input', '131030 → user_input');
assert_test(str_contains($trans131030['user_message'], 'no pertenece a una cuenta activa de WhatsApp'), '131030 mensaje claro');
assert_test(str_contains($trans131030['hint'], 'Verificá el número'), '131030 hint');

$trans190 = whatsapp_explain_meta_error(401, 190, '', '5491144556677');
assert_test($trans190['category'] === 'external_service', '190 → external_service');
assert_test(str_contains($trans190['user_message'], 'token de acceso de WhatsApp (Meta) expiró'), '190 mensaje');

assert_test(
    whatsapp_explain_meta_error(400, 132000, '', '5491144556677')['category'] === 'software_logic',
    '132000 → software_logic'
);
assert_test(
    whatsapp_explain_meta_error(500, null, '', '5491144556677')['category'] === 'external_service',
    'HTTP 500 Meta → external_service'
);

echo "\n=== Test 2: Validación en dispatch deliver ===\n";
require_once __DIR__ . '/../admin/api/recordatorios_dispatch_manual_recordatorios_dispatch_manual_deliver.php';

$deliver = static function (string $phone, string $email, string $channel) {
    return recordatorios_dispatch_manual_deliver(
        1, [], ['username' => 'test'], ['status' => 'pending'], $phone, $email, $channel,
        'Juan Perez', '10:00', '2026-11-26', '', 'admin',
        false, 'sesión', '', 'Juan', false, '10:00 hs'
    );
};

$emptyPhone = $deliver('', '', 'whatsapp');
assert_test($emptyPhone['ok'] === false && ($emptyPhone['error_code'] ?? '') === 'PHONE_REQUIRED', 'PHONE_REQUIRED');
assert_test(($emptyPhone['error_category'] ?? '') === 'user_input' && isset($emptyPhone['hint']), 'PHONE_REQUIRED category+hint');

assert_test(($deliver('12345', '', 'whatsapp')['error_code'] ?? '') === 'PHONE_INVALID_LENGTH', 'PHONE_INVALID_LENGTH');
assert_test(($deliver('', 'correo_invalido', 'email')['error_code'] ?? '') === 'EMAIL_INVALID_FORMAT', 'EMAIL_INVALID_FORMAT');

echo "\n=== Test 3: Guardado de contactos ===\n";
require_once __DIR__ . '/../admin/api/lib_recordatorios_store.php';
require_once __DIR__ . '/../admin/api/recordatorios_lib.php';

$host = getenv('KT_DB_HOST');
if ($host === false || $host === '') {
    echo "• Persistencia contacto omitida (sin KT_DB_HOST)\n";
} else {
    $emptyContact = recordatorios_save_contact(999999, ['wa_id' => '', 'email' => ''], ['username' => 'test']);
    assert_test($emptyContact['ok'] === false, 'contacto inválido falla');
    assert_test(($emptyContact['error_category'] ?? '') === 'user_input', 'contacto → user_input');
    assert_test(
        in_array((string) ($emptyContact['error_code'] ?? ''), ['RECORDATORIO_NOT_FOUND', 'CONTACT_REQUIRED'], true),
        'código contacto esperado'
    );
}

echo "\n=== Test 4: kinesica_classify_exception ===\n";
assert_test(function_exists('kinesica_classify_exception'), 'función disponible');
assert_test(function_exists('json_error_from'), 'json_error_from disponible');

$logic = kinesica_classify_exception(new RuntimeException('boom'), 'err_test01');
assert_test($logic['error_category'] === 'software_logic' && $logic['error_code'] === 'SOFTWARE_LOGIC_EXCEPTION', 'Runtime → SOFTWARE_LOGIC_EXCEPTION');
assert_test($logic['error_id'] === 'err_test01' && str_contains($logic['error'], 'err_test01'), 'preserva error_id');

$dispatch = kinesica_classify_exception(new RuntimeException('boom'), 'err_test02', 'el envío', 'DISPATCH');
assert_test($dispatch['error_code'] === 'DISPATCH_LOGIC_EXCEPTION', 'prefijo DISPATCH + lógica');
assert_test(str_contains($dispatch['error'], 'el envío'), 'contexto en mensaje');

$db = kinesica_classify_exception(new PDOException('Connection refused'), 'err_db01', 'el envío', 'DISPATCH');
assert_test($db['error_category'] === 'infrastructure' && $db['error_code'] === 'DISPATCH_DB_EXCEPTION', 'PDO + DISPATCH → DISPATCH_DB_EXCEPTION');

echo "\nTodos los tests de taxonomía y claridad de errores pasaron exitosamente.\n";
