<?php
declare(strict_types=1);

/**
 * Kinésica — Test Suite de Publicación Automática en Instagram.
 * Ejecuta pruebas unitarias y de integración sobre SQLite en memoria:
 * - Seguridad y rechazo de path traversal
 * - Tipos de datos y nulabilidad
 * - Estados de cola, reordenamiento atómico y límites de reintentos
 * - Aislamiento de tokens
 */

$tmpDb = sys_get_temp_dir() . '/kinesica_ig_test_' . uniqid() . '.db';
$cfgFile = sys_get_temp_dir() . '/kinesica_ig_cfg_' . uniqid() . '.php';

file_put_contents($cfgFile, "<?php return [
    'db' => ['dsn' => 'sqlite:" . addslashes($tmpDb) . "'],
    'instagram_user_id' => '1234567890',
    'instagram_token' => 'mock_initial_seed_token',
    'instagram_days' => [1, 3, 5],
    'instagram_hour' => 10,
];");

putenv('KINESICA_ADMIN_CONFIG=' . $cfgFile);

require_once dirname(__DIR__) . '/admin/api/lib_instagram_store.php';

$asserts = 0;
function it(string $desc, callable $fn): void {
    global $asserts;
    try {
        $fn();
        $asserts++;
        echo "  ✓ {$desc}\n";
    } catch (Throwable $e) {
        fwrite(STDERR, "  ✗ Falló: {$desc} - " . $e->getMessage() . "\n");
        exit(1);
    }
}

echo "\n--- Probando Backend de Instagram Autopost ---\n";

it('inicializa las tablas en SQLite de forma idempotente', function() {
    ensure_instagram_tables();
    ensure_instagram_tables(); // idempotente
    $tables = db()->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('instagram_cola', $tables, true) || !in_array('instagram_token', $tables, true)) {
        throw new Exception('Tablas no creadas correctamente');
    }
});

it('seguridad: rechaza path traversal y extensiones peligrosas', function() {
    if (ig_valid_asset('../../etc/passwd', 'feed')) throw new Exception('Permitió path traversal hacia arriba');
    if (ig_valid_asset('campanas/feed/../secret.png', 'feed')) throw new Exception('Permitió dot navigation');
    if (ig_valid_asset('campanas/feed/malware.php', 'feed')) throw new Exception('Permitió extensión PHP');
    if (ig_valid_asset('campanas/story/foto.png', 'feed')) throw new Exception('Permitió kind cruzado');
    if (!ig_valid_asset('campanas/feed/catalogo_01.png', 'feed')) throw new Exception('Rechazó asset válido');
    if (!ig_valid_asset('campanas/story/catalogo_01.jpg', 'story')) throw new Exception('Rechazó JPG válido');
});

it('rechaza agregados inválidos (sin caption o id malformado)', function() {
    $r1 = ig_queue_add(['id' => 'malicioso/id', 'caption' => 'Hola', 'feed_path' => 'campanas/feed/a.png', 'story_path' => 'campanas/story/a.png'], 'tester');
    if ($r1 !== false) throw new Exception('Permitió id con barra');

    $r2 = ig_queue_add(['id' => 'valido', 'caption' => '   ', 'feed_path' => 'campanas/feed/a.png', 'story_path' => 'campanas/story/a.png'], 'tester');
    if ($r2 !== false) throw new Exception('Permitió caption vacío');
});

it('agrega elementos a la cola preservando orden FIFO incremental', function() {
    ig_queue_add(['id' => 'p1', 'title' => 'Pieza 1', 'caption' => 'Texto 1', 'feed_path' => 'campanas/feed/a.png', 'story_path' => 'campanas/story/a.png'], 'norberto');
    ig_queue_add(['id' => 'p2', 'title' => 'Pieza 2', 'caption' => 'Texto 2', 'feed_path' => 'campanas/feed/b.png', 'story_path' => 'campanas/story/b.png'], 'martin');

    $next = ig_queue_next();
    if ($next['creativo_id'] !== 'p1') throw new Exception("Se esperaba p1 primero, llegó {$next['creativo_id']}");
    if ((int)$next['sort_order'] !== 1) throw new Exception("Sort order incorrecto: {$next['sort_order']}");
});

it('reordena elementos de manera atómica (⬆️ / ⬇️)', function() {
    ig_queue_reorder(['p2', 'p1']);
    $next = ig_queue_next();
    if ($next['creativo_id'] !== 'p2') throw new Exception("Tras reordenar, se esperaba p2 primero, llegó {$next['creativo_id']}");

    $list = ig_queue_list();
    if ($list[0]['creativo_id'] !== 'p2' || $list[1]['creativo_id'] !== 'p1') {
        throw new Exception('El orden de la lista completa no coincide');
    }
});

it('registra publicación exitosa con nulabilidad correcta (Feed solo, Story solo o ambos)', function() {
    // Caso 1: Solo Story (feedId = null) - prueba de tipo ?string
    ig_mark_published('p1', '2026-11-08', null, 'story_media_123', null);
    $item1 = ig_queue_find('p1');
    if ($item1['status'] !== 'published') throw new Exception('No cambió a published');
    if ($item1['feed_media_id'] !== null) throw new Exception('feed_media_id debería ser null');
    if ($item1['story_media_id'] !== 'story_media_123') throw new Exception('story_media_id no guardado');

    // Caso 2: Ambos (Feed + Story)
    ig_mark_published('p2', '2026-11-08', 'feed_media_456', 'story_media_456', null);
    $item2 = ig_queue_find('p2');
    if ($item2['feed_media_id'] !== 'feed_media_456' || $item2['story_media_id'] !== 'story_media_456') {
        throw new Exception('Ambos media IDs deberían estar guardados');
    }
});

it('aislamiento de seguridad: ig_queue_list no expone tokens', function() {
    $items = ig_queue_list();
    foreach ($items as $it) {
        if (isset($it['token']) || isset($it['access_token'])) {
            throw new Exception('Fuga de token detectada en lista pública de cola');
        }
    }
});

it('maneja fallos y transiciona a failed tras 3 intentos (IG_MAX_ATTEMPTS)', function() {
    ig_queue_add(['id' => 'p_error', 'title' => 'Error Test', 'caption' => 'Texto', 'feed_path' => 'campanas/feed/e.png', 'story_path' => 'campanas/story/e.png'], 'test');
    
    ig_mark_attempt_failed('p_error', 'Error 1');
    $e1 = ig_queue_find('p_error');
    if ((int)$e1['attempts'] !== 1 || $e1['status'] !== 'queued') throw new Exception('Intento 1 falló al actualizar');

    ig_mark_attempt_failed('p_error', 'Error 2');
    $e2 = ig_queue_find('p_error');
    if ((int)$e2['attempts'] !== 2 || $e2['status'] !== 'queued') throw new Exception('Intento 2 falló al actualizar');

    ig_mark_attempt_failed('p_error', 'Error 3 fatal');
    $e3 = ig_queue_find('p_error');
    if ((int)$e3['attempts'] !== 3 || $e3['status'] !== 'failed') throw new Exception('No pasó a failed tras 3 intentos');
    if ($e3['last_error'] !== 'Error 3 fatal') throw new Exception('No preservó el último mensaje de error');
});

it('re-encolado de pieza publicada está bloqueado (anti-duplicado)', function() {
    $before = ig_queue_find('p1');
    if ($before['status'] !== 'published') throw new Exception('p1 debía estar publicada');
    $ok = ig_queue_add(['id' => 'p1', 'title' => 'Pieza 1 Recargada', 'caption' => 'Nuevo copy', 'feed_path' => 'campanas/feed/a.png', 'story_path' => 'campanas/story/a.png'], 'norberto');
    if ($ok) throw new Exception('Re-encolar publicada debía fallar');
    $after = ig_queue_find('p1');
    if ($after['status'] !== 'published') throw new Exception('Debía seguir published');
    if ($after['story_media_id'] !== 'story_media_123') throw new Exception('No debía borrar media_id');
});

it('ig_published_on_date detecta publicaciones del día e ignora fechas distintas', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    if (!ig_published_on_date('2026-11-08')) throw new Exception('Debía detectar publicación en 2026-11-08');
    if (ig_published_on_date('2026-11-09')) throw new Exception('No debía detectar publicación en 2026-11-09');
});

it('ig_queue_remove elimina elementos de la cola pero no elimina piezas ya publicadas', function() {
    ig_queue_remove('p2');
    $p2 = ig_queue_find('p2');
    if ($p2 === null) throw new Exception('Eliminó una pieza ya publicada (violación de histórico)');

    ig_queue_add(['id' => 'p_rm', 'title' => 'Removable', 'caption' => 'Texto', 'feed_path' => 'campanas/feed/r.png', 'story_path' => 'campanas/story/r.png'], 'test');
    ig_queue_remove('p_rm');
    if (ig_queue_find('p_rm') !== null) throw new Exception('No eliminó la pieza que estaba en cola');
});

it('seguridad: consultas preparadas contra inyección SQL', function() {
    // Intento de inyección en id
    $sqli = "test' OR '1'='1";
    $find = ig_queue_find($sqli);
    if ($find !== null) throw new Exception('Inyección en ig_queue_find');

    // Intento en ig_mark_attempt_failed con caracteres de escape
    ig_mark_attempt_failed('p2', "Error con comillas ' \" ; -- DROP TABLE");
    $p2 = ig_queue_find('p2');
    if (!str_contains($p2['last_error'], 'DROP TABLE')) throw new Exception('No sanitizó correctamente');
});

it('guarda y recupera tokens de forma segura', function() {
    $t1 = ig_token_get();
    if ($t1['token'] !== 'mock_initial_seed_token') throw new Exception('No tomó el token semilla');

    ig_token_save('nuevo_token_renovado', '2027-01-01 12:00:00');
    $t2 = ig_token_get();
    if ($t2['token'] !== 'nuevo_token_renovado' || $t2['expires_at'] !== '2027-01-01 12:00:00') {
        throw new Exception('Token renovado no se persistió correctamente');
    }
});

it('ig_caption_save persiste override y actualiza caption en cola', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_copy.php';
    ig_queue_add([
        'id' => 'p_copy', 'title' => 'Copy Test', 'caption' => 'Texto original',
        'feed_path' => 'campanas/feed/c.png', 'story_path' => 'campanas/story/c.png',
    ], 'martin');
    if (!ig_caption_save('p_copy', 'Texto editado por admin', 'norberto')) {
        throw new Exception('ig_caption_save falló');
    }
    $map = ig_copy_map();
    if (($map['p_copy'] ?? '') !== 'Texto editado por admin') {
        throw new Exception('Override de catálogo no persistió');
    }
    $row = ig_queue_find('p_copy');
    if (($row['caption'] ?? '') !== 'Texto editado por admin') {
        throw new Exception('Caption de cola no se sincronizó');
    }
    if (ig_caption_save('p_copy', '   ', 'martin')) {
        throw new Exception('Debía rechazar caption vacío');
    }
});

it('channels por pieza: default both y update_channels', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_copy.php';
    ig_queue_add([
        'id' => 'p_ch', 'title' => 'Canal', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/d.png', 'story_path' => 'campanas/story/d.png',
        'channel' => 'feed',
    ], 'martin');
    $row = ig_queue_find('p_ch');
    if (($row['channels'] ?? '') !== 'feed') throw new Exception('No guardó channel=feed al encolar');
    if (!ig_queue_set_channels('p_ch', 'story')) throw new Exception('set_channels falló');
    $row2 = ig_queue_find('p_ch');
    if (($row2['channels'] ?? '') !== 'story') throw new Exception('No actualizó a story');
    if (ig_normalize_channel('nope') !== 'both') throw new Exception('normalize debía caer a both');
});

it('servicio Instagram activo por defecto y se puede pausar', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_copy.php';
    if (!ig_service_enabled()) throw new Exception('Default debía ser activo');
    ig_service_set_enabled(false, 'martin');
    if (ig_service_enabled()) throw new Exception('Debía quedar pausado');
    ig_service_set_enabled(true, 'norberto');
    if (!ig_service_enabled()) throw new Exception('Debía reactivarse');
});

it('schedule days+hour se persiste y normaliza', function () {
    require_once __DIR__ . '/../admin/api/lib_instagram_copy.php';
    $def = ig_schedule_get();
    if (($def['days'] ?? []) !== [1, 3, 5]) throw new Exception('Default days debía ser 1,3,5');
    if ((int) ($def['hour'] ?? -1) !== 10) throw new Exception('Default hour debía ser 10');
    $saved = ig_schedule_set([5, 1, 1, 9, 2], 19, 'martin');
    if ($saved['days'] !== [1, 2, 5]) throw new Exception('Debía normalizar a 1,2,5');
    if ($saved['hour'] !== 19) throw new Exception('Hour 19 no persistió en retorno');
    $got = ig_schedule_get();
    if ($got['days'] !== [1, 2, 5] || $got['hour'] !== 19) throw new Exception('GET no leyó schedule guardado');
    ig_schedule_set([1, 3, 5], 10, 'martin');
});

it('hide/unhide creativo y saca de cola queued', function () {
    require_once __DIR__ . '/../admin/api/lib_instagram_hidden.php';
    require_once __DIR__ . '/../admin/api/lib_instagram_store.php';
    ig_queue_add([
        'id' => 'p_hide', 'title' => 'Hide me', 'caption' => 'Texto de prueba',
        'feed_path' => 'campanas/feed/h.png', 'story_path' => 'campanas/story/h.png',
    ], 'martin');
    if (!ig_queue_find('p_hide')) throw new Exception('Debía estar en cola');
    $hide = ig_creativo_hide('p_hide', 'martin');
    if (empty($hide['ok'])) throw new Exception('hide falló');
    if (ig_queue_find('p_hide')) throw new Exception('Debía salir de cola queued');
    if (!ig_creativo_is_hidden('p_hide')) throw new Exception('Debía quedar hidden');
    if (!in_array('p_hide', ig_hidden_ids(), true)) throw new Exception('hidden_ids incompleto');
    if (!ig_creativo_unhide('p_hide')) throw new Exception('unhide falló');
    if (ig_creativo_is_hidden('p_hide')) throw new Exception('Debía restaurarse');
});

it('ig_queue_claim evita doble reserva de la misma pieza', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    ig_queue_add([
        'id' => 'p_lock', 'title' => 'Lock', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/l.png', 'story_path' => 'campanas/story/l.png',
    ], 'martin');
    $a = ig_queue_claim('p_lock');
    $b = ig_queue_claim('p_lock');
    if ($a === null || ($a['status'] ?? '') !== 'publishing') throw new Exception('Primer claim falló');
    if ($b !== null) throw new Exception('Segundo claim debía fallar');
    ig_queue_release_claim('p_lock');
    $again = ig_queue_find('p_lock');
    if (($again['status'] ?? '') !== 'queued') throw new Exception('Release no volvió a queued');
});

it('guards permanentes: día y canal no se pueden adquirir dos veces', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    if (!ig_guard_acquire(ig_day_slot('2099-01-01'), 'p1')) throw new Exception('day acquire 1');
    if (ig_guard_acquire(ig_day_slot('2099-01-01'), 'p2')) throw new Exception('day acquire 2 debía fallar');
    if (!ig_guard_acquire(ig_channel_slot('p_g', 'story'), 'p_g')) throw new Exception('story acquire 1');
    if (ig_guard_acquire(ig_channel_slot('p_g', 'story'), 'p_g')) throw new Exception('story acquire 2 debía fallar');
    if (!ig_guard_held(ig_channel_slot('p_g', 'story'))) throw new Exception('guard_held');
});

it('release_claim no reencola si ya hay media_id (progreso)', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    ig_queue_add([
        'id' => 'p_part', 'title' => 'Partial', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/p.png', 'story_path' => 'campanas/story/p.png',
    ], 'martin');
    ig_queue_claim('p_part');
    ig_save_partial_media('p_part', null, 'STORY_MEDIA_99');
    ig_queue_release_claim('p_part');
    $row = ig_queue_find('p_part');
    if (($row['status'] ?? '') !== 'published') throw new Exception('Debía finalizar published, no reencolar');
    if (($row['story_media_id'] ?? '') !== 'STORY_MEDIA_99') throw new Exception('Debía conservar story_media_id');
});

it('no se puede re-encolar una pieza already published', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_store.php';
    $ok = ig_queue_add([
        'id' => 'p_part', 'title' => 'Partial', 'caption' => 'Otra',
        'feed_path' => 'campanas/feed/p.png', 'story_path' => 'campanas/story/p.png',
    ], 'martin');
    if ($ok) throw new Exception('Re-encolar publicada debía fallar');
});

it('release_claim con guard sin media marca failed y libera day guard', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    ig_queue_add([
        'id' => 'p_stuck', 'title' => 'Stuck', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/s.png', 'story_path' => 'campanas/story/s.png',
    ], 'martin');
    ig_queue_claim('p_stuck');
    $day = ig_today();
    if (!ig_guard_acquire(ig_day_slot($day), 'p_stuck')) {
        throw new Exception('No adquirió day guard');
    }
    if (!ig_guard_acquire(ig_channel_slot('p_stuck', 'feed'), 'p_stuck')) {
        throw new Exception('No adquirió guard feed');
    }
    ig_queue_release_claim('p_stuck');
    $row = ig_queue_find('p_stuck');
    if (($row['status'] ?? '') !== 'failed') throw new Exception('Debía quedar failed, no publishing');
    if (ig_guard_held(ig_day_slot($day))) {
        throw new Exception('Debía liberar day guard con canal reservado sin media');
    }
    if (!ig_guard_held(ig_channel_slot('p_stuck', 'feed'))) {
        throw new Exception('Channel guard debe permanecer (anti-duplicado)');
    }
});

it('ig_release_stale_publishing libera claims huérfanos (publishing_at NULL o viejo)', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    ig_queue_add([
        'id' => 'p_stale', 'title' => 'Stale', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/z.png', 'story_path' => 'campanas/story/z.png',
    ], 'martin');
    ig_queue_claim('p_stale');
    // Simula proceso muerto antes de persistir publishing_at (filas legacy).
    db()->prepare('UPDATE instagram_cola SET publishing_at = NULL WHERE creativo_id = :id')
        ->execute(['id' => 'p_stale']);
    $n = ig_release_stale_publishing(60);
    if ($n < 1) throw new Exception('Debía liberar al menos 1 stale');
    $row = ig_queue_find('p_stale');
    if (($row['status'] ?? '') === 'publishing') throw new Exception('Seguía publishing tras sweeper');
});

it('claim escribe publishing_at en UTC y release sin progreso suelta day guard', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_guard.php';
    ig_queue_add([
        'id' => 'p_dayrec', 'title' => 'DayRec', 'caption' => 'Texto',
        'feed_path' => 'campanas/feed/dr.png', 'story_path' => 'campanas/story/dr.png',
    ], 'martin');
    $claimed = ig_queue_claim('p_dayrec');
    $at = (string) ($claimed['publishing_at'] ?? '');
    if ($at === '' || !preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $at)) {
        throw new Exception('publishing_at UTC mal formado');
    }
    $skew = abs(strtotime($at . ' UTC') - time());
    if ($skew > 120) throw new Exception('publishing_at no parece UTC cercano a now');
    $day = ig_today();
    if (!ig_guard_acquire(ig_day_slot($day), 'p_dayrec')) throw new Exception('No adquirió day');
    ig_queue_release_claim('p_dayrec');
    $row = ig_queue_find('p_dayrec');
    if (($row['status'] ?? '') !== 'queued') throw new Exception('Debía reencolar sin progreso');
    if (ig_guard_held(ig_day_slot($day))) throw new Exception('Debía liberar day guard sin progreso Meta');
    if (ig_guard_release_day_for('p_dayrec', $day)) {
        throw new Exception('Segundo clear-day no debía borrar nada');
    }
});

it('ig_queue_set_channels solo actualiza piezas queued', function() {
    require_once __DIR__ . '/../admin/api/lib_instagram_copy.php';
    if (ig_queue_set_channels('p_part', 'feed')) {
        throw new Exception('No debía actualizar pieza published');
    }
});

it('ig_today y caption max son tipos coherentes', function() {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', ig_today())) throw new Exception('ig_today formato');
    if (IG_CAPTION_MAX !== 2200) throw new Exception('IG_CAPTION_MAX');
    if (ig_caption_save('p_copy', str_repeat('x', IG_CAPTION_MAX + 1), 't')) {
        throw new Exception('Debía rechazar caption > 2200');
    }
});

it('image_text: normalize, override, reject limits y publishing', function () {
    require_once __DIR__ . '/../admin/api/lib_instagram_image_text.php';
    ig_ensure_image_text_table();
    if (ig_image_text_normalize('', 't', 'b') !== null) throw new Exception('vacío');
    if (ig_image_text_normalize(str_repeat('c', IG_IMG_CAT_MAX + 1), 't', 'b') !== null) {
        throw new Exception('cat over limit');
    }
    $ok = ig_image_text_normalize('CAT', 'Titulo', 'Cuerpo de prueba');
    if (!$ok || $ok['cat'] !== 'CAT') throw new Exception('normalize ok');

    ig_queue_add([
        'id' => '01_acostumbraste_dolor', 'title' => 'Old', 'caption' => 'Cap',
        'feed_path' => 'campanas/feed/catalogo_feed_01_acostumbraste_dolor.png',
        'story_path' => 'campanas/story/catalogo_story_01_acostumbraste_dolor.png',
    ], 'martin');
    db()->prepare("UPDATE instagram_cola SET status='publishing' WHERE creativo_id='01_acostumbraste_dolor'")->execute();
    $blocked = ig_image_text_save('01_acostumbraste_dolor', 'CAT', 'Nuevo titulo', 'Nuevo cuerpo ok', 'martin');
    if (!empty($blocked['ok']) || (int) ($blocked['http'] ?? 0) !== 409) {
        throw new Exception('Debía 409 en publishing');
    }
    db()->prepare("UPDATE instagram_cola SET status='queued' WHERE creativo_id='01_acostumbraste_dolor'")->execute();
});

it('render regenera feed/story, bust cache y no toca original/', function () {
    require_once __DIR__ . '/../admin/api/lib_instagram_render.php';
    $root = dirname(__DIR__) . '/admin/campanas';
    // Usar pieza con placa limpia (sin banda/texto). Originales "terminados" ya no se re-pintan.
    $id = '134_deseamos_fiestas';
    $origF = "{$root}/original/feed/catalogo_feed_{$id}.png";
    $liveF = "{$root}/feed/catalogo_feed_{$id}.png";
    $liveS = "{$root}/story/catalogo_story_{$id}.png";
    if (!is_file($origF)) throw new Exception('Falta original feed 134');
    $hashBefore = hash_file('sha256', $origF);
    $bakF = $liveF . '.baktest';
    $bakS = $liveS . '.baktest';
    copy($liveF, $bakF);
    copy($liveS, $bakS);
    $cacheJpg = "{$root}/ig/feed/catalogo_feed_{$id}.jpg";
    @mkdir(dirname($cacheJpg), 0755, true);
    file_put_contents($cacheJpg, 'fake');
    try {
        $res = ig_render_piece($id, 'EVALUACION', 'Titulo test renderer', 'Cuerpo corto para test de regeneracion automatica.');
        if (($res['feed'] ?? '') === '' || ($res['story'] ?? '') === '') throw new Exception('paths vacíos');
        if (!is_file($liveF) || !is_file($liveS)) throw new Exception('PNG live no escritos');
        $fi = getimagesize($liveF);
        $si = getimagesize($liveS);
        if (!$fi || $fi[0] !== 1080 || $fi[1] !== 1350) throw new Exception('feed size');
        if (!$si || $si[0] !== 1080 || $si[1] !== 1920) throw new Exception('story size');
        if (is_file($cacheJpg)) throw new Exception('cache JPG debía borrarse');
        if (hash_file('sha256', $origF) !== $hashBefore) throw new Exception('original/ fue modificado');
    } finally {
        rename($bakF, $liveF);
        rename($bakS, $liveS);
    }
});

it('render rechaza original que ya es pieza terminada', function () {
    require_once __DIR__ . '/../admin/api/lib_instagram_render.php';
    $threw = false;
    try {
        ig_render_piece('02_sintoma_senal', 'CAT', 'Titulo', 'Cuerpo de prueba suficiente.');
    } catch (Throwable $e) {
        $threw = str_contains($e->getMessage(), 'pieza terminada');
    }
    if (!$threw) throw new Exception('Debía rechazar original terminado (02)');
});

it('inventario original/feed|story = 151', function () {
    $root = dirname(__DIR__) . '/admin/campanas';
    $nf = count(glob($root . '/original/feed/*.png') ?: []);
    $ns = count(glob($root . '/original/story/*.png') ?: []);
    $lf = count(glob($root . '/feed/*.png') ?: []);
    $ls = count(glob($root . '/story/*.png') ?: []);
    if ($nf !== 151 || $ns !== 151) throw new Exception("original feed={$nf} story={$ns}");
    if ($lf !== 151 || $ls !== 151) throw new Exception("live feed={$lf} story={$ls}");
});

// Limpieza
@unlink($tmpDb);
@unlink($cfgFile);

echo "Total tests backend PHP pasados: {$asserts}\n";
