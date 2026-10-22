<?php
/**
 * Tests del guardado de configuración del admin (admin/api/settings.php + horarios.php).
 * Ejecución: php scripts/verify-admin-settings.php   (npm run settings:test)
 * Corre los endpoints reales en una copia temporal con autenticación simulada.
 */
$n = 0;
function check(bool $cond, string $msg): void { global $n; if (!$cond) { fwrite(STDERR, "FAIL: $msg\n"); exit(1); } $n++; }

$root = sys_get_temp_dir() . '/kin-settings-' . bin2hex(random_bytes(4));
mkdir("$root/admin/api", 0777, true);
mkdir("$root/api", 0777, true);
foreach (['settings.php', 'horarios.php'] as $f) copy(__DIR__ . "/../admin/api/$f", "$root/admin/api/$f");
foreach (['confirmation-mail-lib.php'] as $f) copy(__DIR__ . "/../api/$f", "$root/api/$f");
file_put_contents("$root/admin/api/lib.php", '<?php
function require_header(): void {}
function require_auth(): array { return ["name" => "Test", "username" => "test"]; }
function read_json(): array { return $GLOBALS["__input"] ?? []; }
function json_out(int $code, array $data): void { echo json_encode(["__code" => $code] + $data, JSON_UNESCAPED_UNICODE); exit; }
');
$seed = ['clara_active' => false, 'booking_active' => false,
    'clara_texts' => ['menu_welcome' => 'VIEJO bienvenida', 'opt_b_text' => 'VIEJO B', 'confirmation_notes' => 'VIEJO notas']];
file_put_contents("$root/admin/api/settings.json", json_encode($seed, JSON_UNESCAPED_UNICODE));

function call(string $script, string $method, ?array $input = null): array
{
    global $root;
    $runner = "$root/run.php";
    file_put_contents($runner, '<?php $_SERVER["REQUEST_METHOD"]=' . var_export($method, true) . '; $_SERVER["HTTP_X_KINESICA"]="1"; $GLOBALS["__input"]=' . var_export($input ?? [], true) . '; include ' . var_export("$root/admin/api/$script", true) . ';');
    $out = shell_exec('php ' . escapeshellarg($runner) . ' 2>&1');
    $data = json_decode((string) $out, true);
    if (!is_array($data)) { fwrite(STDERR, "salida no JSON: $out\n"); exit(1); }
    return $data;
}
$runtime = "$root/admin/api/data/settings.json";
$texts = fn () => call('settings.php', 'GET')['clara_texts'];

// 1. Sin datos vivos se lee la semilla versionada.
check($texts()['menu_welcome'] === 'VIEJO bienvenida', 'lee semilla');
check(!is_file($runtime), 'GET no crea archivo');

// 2. Guardar escribe en data/, no en la semilla, y conserva los campos no enviados.
$r = call('settings.php', 'POST', ['base_revision' => 0, 'clara_texts' => ['menu_welcome' => '*B.* 📍 Ubicación NUEVO']]);
check(($r['__code'] ?? 200) === 200 && $r['clara_texts']['menu_welcome'] === '*B.* 📍 Ubicación NUEVO', 'guardado ok');
check(is_file($runtime), 'crea data/settings.json');
check(json_decode(file_get_contents("$root/admin/api/settings.json"), true) === $seed, 'semilla intacta');
check($r['clara_texts']['opt_b_text'] === 'VIEJO B', 'campo no enviado se conserva');
check($r['clara_texts_revision'] === 1, 'revisión 1');

// 3. Un deploy por git que reponga settings.json viejo ya no pisa los datos vivos.
file_put_contents("$root/admin/api/settings.json", json_encode($seed + ['x' => 1], JSON_UNESCAPED_UNICODE));
check($texts()['menu_welcome'] === '*B.* 📍 Ubicación NUEVO', 'deploy no revierte textos');

// 4. Guardar sólo las notas (4 viñetas) no toca la bienvenida.
$notes = "• *Puntualidad:* a\n• *Ropa:* b\n• *Estudios:* c\n• *Acompañantes:* d";
$r = call('settings.php', 'POST', ['base_revision' => 1, 'clara_texts' => ['confirmation_notes' => $notes]]);
check($r['clara_texts']['confirmation_notes'] === $notes && $r['clara_texts']['menu_welcome'] === '*B.* 📍 Ubicación NUEVO', 'guardado parcial');

// 5. Formulario viejo (revisión anterior) → 409 y no se pisa nada.
$before = file_get_contents($runtime);
$r = call('settings.php', 'POST', ['base_revision' => 1, 'clara_texts' => ['menu_welcome' => 'VIEJO bienvenida']]);
check(($r['__code'] ?? 0) === 409 && !empty($r['conflict']), '409 por revisión vieja');
check(file_get_contents($runtime) === $before, '409 no escribe');

// 6. Toggles y honorarios no cambian la revisión de textos ni los textos.
$r = call('settings.php', 'POST', ['clara_active' => true]);
$r = call('settings.php', 'POST', ['fees' => ['atm' => 70000]]);
check($r['clara_active'] === true && $r['fees']['atm'] === 70000 && $r['clara_texts_revision'] === 2, 'toggle/honorarios');
check($r['clara_texts']['confirmation_notes'] === $notes, 'toggle conserva textos');

// 7. Guardar horarios (horarios.php) conserva textos, honorarios y estados.
$hours = call('settings.php', 'GET')['practitioner_hours'];
$hours['norberto']['1'] = [['start' => '17:00', 'end' => '19:30']];
$r = call('horarios.php', 'POST', ['practitioner_hours' => $hours]);
check(($r['status'] ?? '') === 'success', 'horarios guardados: ' . json_encode($r));
$g = call('settings.php', 'GET');
check($g['practitioner_hours']['norberto']['1'][0]['start'] === '17:00', 'horarios persistidos');
check($g['clara_texts']['confirmation_notes'] === $notes && $g['fees']['atm'] === 70000 && $g['clara_active'] === true, 'horarios no borran textos/honorarios');

// 8. El mail de confirmación lee los datos vivos.
require "$root/api/confirmation-mail-lib.php";
$t = kinesica_mail_texts(kinesica_read_settings(kinesica_admin_settings_file("$root/api")));
check($t['confirmation_notes'] === $notes, 'mail usa data/settings.json');

// 9. Cliente: no guarda antes de cargar, envía sólo cambios y la revisión.
$js = file_get_contents(__DIR__ . '/../admin/modules/configuracion.js');
check(str_contains($js, 'if (!textsLoaded || !loadedFormValues)'), 'bloquea guardado hasta cargar');
check(str_contains($js, 'base_revision: textsRevision') && str_contains($js, 'changedTexts'), 'envía sólo cambios + revisión');
check(str_contains($js, 'err?.status === 409'), 'maneja 409');
check(is_file(__DIR__ . '/../admin/api/data/.htaccess'), 'data/ protegido');
check(str_contains(file_get_contents(__DIR__ . '/../.gitignore'), 'admin/api/data/*'), 'data/ fuera de git');

echo "configuración del admin: ok ($n comprobaciones)\n";
