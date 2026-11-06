<?php
declare(strict_types=1);

/**
 * Endpoint de sincronización segura para credenciales de WhatsApp en producción.
 * Requiere token de migración: 'migrate-' . $cfg['webhook_secret']
 */
require __DIR__ . '/lib.php';

$token = (string) ($_GET['token'] ?? $_POST['token'] ?? '');
$cfg = cfg();
$expected = 'migrate-' . (string) ($cfg['webhook_secret'] ?? '');

if ($token === '' || !hash_equals($expected, $token)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "forbidden\n";
    exit;
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true) ?: [];
$waToken = trim((string) ($input['whatsapp_token'] ?? $_POST['whatsapp_token'] ?? ''));
$waPhoneId = trim((string) ($input['whatsapp_phone_number_id'] ?? $_POST['whatsapp_phone_number_id'] ?? '1340013275870491'));

if ($waToken === '') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Falta whatsapp_token en el cuerpo']);
    exit;
}

$domainRoot = dirname(__DIR__, 3);
$privateDir = $domainRoot . '/private';
$privateFile = $privateDir . '/whatsapp.php';
$localFile = __DIR__ . '/whatsapp.php';

if (!is_dir($privateDir) && !@mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
    // Si no se puede crear private, se usará localFile
}

$content = "<?php\n"
    . "declare(strict_types=1);\n\n"
    . "return [\n"
    . "    'whatsapp_token' => " . var_export($waToken, true) . ",\n"
    . "    'whatsapp_phone_number_id' => " . var_export($waPhoneId !== '' ? $waPhoneId : '1340013275870491', true) . ",\n"
    . "];\n";

$saved = [];

if (is_dir($privateDir) && @file_put_contents($privateFile, $content) !== false) {
    @chmod($privateFile, 0600);
    $saved[] = $privateFile;
}

if (@file_put_contents($localFile, $content) !== false) {
    @chmod($localFile, 0600);
    $saved[] = $localFile;
}

// Persistir también en DB table configuraciones
$dbSaved = false;
try {
    $pdo = db();
    $json = json_encode([
        'whatsapp_token' => $waToken,
        'whatsapp_phone_number_id' => $waPhoneId !== '' ? $waPhoneId : '1340013275870491',
    ], JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare(
        'INSERT INTO configuraciones (config_key, value_json, version, updated_at, updated_by)
         VALUES ("whatsapp_credentials", :v, 1, NOW(), "sync_endpoint")
         ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), version = version + 1, updated_at = NOW(), updated_by = "sync_endpoint"'
    );
    $stmt->execute([':v' => $json]);
    $dbSaved = true;
} catch (Throwable $e) {
    error_log('Error saving whatsapp_credentials in DB: ' . $e->getMessage());
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'saved_files' => $saved,
    'db_saved' => $dbSaved,
    'token_length' => strlen($waToken),
    'phone_id' => $waPhoneId,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
echo "\n";
