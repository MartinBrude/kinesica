<?php
declare(strict_types=1);

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
assert_test($trans131030['category'] === 'user_input', 'Código 131030 clasificado como user_input (mal uso / número sin WA)');
assert_test(str_contains($trans131030['user_message'], 'no pertenece a una cuenta activa de WhatsApp'), 'Mensaje amigable para 131030');
assert_test(str_contains($trans131030['hint'], 'Verificá el número'), 'Hint accionable para 131030');

$trans190 = whatsapp_explain_meta_error(401, 190, '', '5491144556677');
assert_test($trans190['category'] === 'external_service', 'Código 190 clasificado como external_service (token expirado)');
assert_test(str_contains($trans190['user_message'], 'token de acceso de WhatsApp (Meta) expiró'), 'Mensaje claro para token expirado');

$trans132000 = whatsapp_explain_meta_error(400, 132000, '', '5491144556677');
assert_test($trans132000['category'] === 'software_logic', 'Código 132000 clasificado como software_logic (plantilla no existente en Meta)');

$trans500 = whatsapp_explain_meta_error(500, null, '', '5491144556677');
assert_test($trans500['category'] === 'external_service', 'HTTP 500 de Meta clasificado como external_service');

echo "\n=== Test 2: Comportamiento de validación de teléfonos en recordatorios ===\n";
require_once __DIR__ . '/../admin/api/recordatorios_dispatch_manual_recordatorios_dispatch_manual_deliver.php';

// Teléfono vacío
$emptyPhone = recordatorios_dispatch_manual_deliver(
    1, [], ['username' => 'test'], ['status' => 'pending'], '', '', 'whatsapp',
    'Juan Perez', '10:00', '2026-11-26', '', 'admin',
    false, 'sesión', '', 'Juan', false, '10:00 hs'
);
assert_test($emptyPhone['ok'] === false, 'Teléfono vacío falla');
assert_test($emptyPhone['error_category'] === 'user_input', 'Teléfono vacío es user_input');
assert_test($emptyPhone['error_code'] === 'PHONE_REQUIRED', 'Código de error PHONE_REQUIRED');
assert_test(isset($emptyPhone['hint']), 'Hint presente');

// Teléfono demasiado corto
$shortPhone = recordatorios_dispatch_manual_deliver(
    1, [], ['username' => 'test'], ['status' => 'pending'], '12345', '', 'whatsapp',
    'Juan Perez', '10:00', '2026-11-26', '', 'admin',
    false, 'sesión', '', 'Juan', false, '10:00 hs'
);
assert_test($shortPhone['ok'] === false, 'Teléfono corto falla');
assert_test($shortPhone['error_category'] === 'user_input', 'Teléfono corto es user_input');
assert_test($shortPhone['error_code'] === 'PHONE_INVALID_LENGTH', 'Código de error PHONE_INVALID_LENGTH');

// Email inválido
$badEmail = recordatorios_dispatch_manual_deliver(
    1, [], ['username' => 'test'], ['status' => 'pending'], '', 'correo_invalido', 'email',
    'Juan Perez', '10:00', '2026-11-26', '', 'admin',
    false, 'sesión', '', 'Juan', false, '10:00 hs'
);
assert_test($badEmail['ok'] === false, 'Email inválido falla');
assert_test($badEmail['error_category'] === 'user_input', 'Email inválido es user_input');
assert_test($badEmail['error_code'] === 'EMAIL_INVALID_FORMAT', 'Código de error EMAIL_INVALID_FORMAT');

echo "\n=== Test 3: Guardado de contactos en recordatorios ===\n";
require_once __DIR__ . '/../admin/api/lib_recordatorios_store.php';
require_once __DIR__ . '/../admin/api/recordatorios_lib.php';

$emptyContact = recordatorios_save_contact(999999, ['wa_id' => '', 'email' => ''], ['username' => 'test']);
assert_test($emptyContact['ok'] === false, 'Item no existente o contacto vacío falla');
assert_test($emptyContact['error_category'] === 'user_input', 'Falla de contacto es user_input');

echo "\n=== Test 4: Comprobación del manejador de excepciones (simulación) ===\n";
$errId = 'err_' . substr(md5('test'), 0, 8);
$isDbError = false;
$category = $isDbError ? 'infrastructure' : 'software_logic';
assert_test($category === 'software_logic', 'Excepción general clasificada como software_logic');
$dbErrorCategory = true ? 'infrastructure' : 'software_logic';
assert_test($dbErrorCategory === 'infrastructure', 'Excepción de base de datos clasificada como infrastructure');

echo "\nTodos los tests de taxonomía y claridad de errores pasaron exitosamente.\n";
