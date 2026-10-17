<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

// Normalizador de texto para claves de búsqueda (sin acentos, minúsculas)
function normalize_search_key(string $str): string
{
    $str = mb_strtolower(trim($str), 'UTF-8');
    $transliterator = 'NFD; [:Nonspacing Mark:] Remove; NFC;';
    $converted = transliterator_transliterate($transliterator, $str);
    if ($converted !== false) {
        $str = $converted;
    }
    return preg_replace('/[^a-z0-9\s]/', '', $str) ?? '';
}

// Normalizador de teléfonos estricto para WhatsApp (Argentina y España)
function clean_phone_number(string $raw): string
{
    $digits = preg_replace('/[^0-9]/', '', $raw) ?? '';
    if ($digits === '') {
        return '';
    }

    if (str_starts_with($digits, '549') && strlen($digits) >= 12) {
        return substr($digits, 0, 13);
    }
    if (str_starts_with($digits, '54') && !str_starts_with($digits, '549') && strlen($digits) >= 12) {
        return '549' . substr($digits, 2, 10);
    }
    if (str_starts_with($digits, '34') && strlen($digits) === 11) {
        return $digits;
    }
    if (str_starts_with($digits, '0')) {
        $digits = substr($digits, 1);
    }
    if (str_starts_with($digits, '15') && strlen($digits) === 10) {
        return '54911' . substr($digits, 2);
    }
    if (str_starts_with($digits, '1115') && strlen($digits) === 12) {
        return '54911' . substr($digits, 4);
    }
    if (str_starts_with($digits, '11') && strlen($digits) === 10) {
        return '549' . $digits;
    }
    return $digits;
}

// Extractor de primer nombre / nombre de pila (respetando compuestos)
function extract_first_name(string $fullName): string
{
    $clean = trim(preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/iu', '', $fullName) ?? '');
    $clean = trim(preg_replace('/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\'-]/u', '', $clean) ?? '');
    if ($clean === '' || mb_strtolower($clean, 'UTF-8') === 'paciente') {
        return 'Paciente';
    }

    $parts = preg_split('/\s+/u', $clean, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($parts) <= 1) {
        return $parts[0] ?? 'Paciente';
    }

    $compoundFirst = ['juan', 'maria', 'maría', 'jose', 'josé', 'ana', 'luis', 'carlos'];
    $firstLower = mb_strtolower($parts[0], 'UTF-8');
    if (in_array($firstLower, $compoundFirst, true) && count($parts) >= 2) {
        $secondLower = mb_strtolower($parts[1], 'UTF-8');
        $commonSecond = [
            'pablo', 'ignacio', 'carlos', 'manuel', 'martin', 'martín', 'cruz', 'francisco', 'pedro',
            'florencia', 'eugenia', 'sol', 'victoria', 'belen', 'belén', 'clara', 'paula', 'laura', 'josefina',
            'luis', 'maria', 'maría', 'elena', 'ines', 'inés', 'lia', 'lía', 'sofia', 'sofía'
        ];
        if (in_array($secondLower, $commonSecond, true) || count($parts) >= 3) {
            return $parts[0] . ' ' . $parts[1];
        }
    }
    return $parts[0];
}

// Inicialización automática y auto-reparación del esquema de base de datos
function ensure_pacientes_tables(PDO $pdo): void
{
    static $checked = false;
    if ($checked) {
        return;
    }

    // 1. Crear tablas si no existen
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS pacientes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            telefono VARCHAR(20) NOT NULL UNIQUE,
            nombre VARCHAR(60) NOT NULL DEFAULT '',
            apellido VARCHAR(60) NOT NULL DEFAULT '',
            nombre_completo VARCHAR(120) NOT NULL,
            nombre_pila VARCHAR(60) NOT NULL,
            dni VARCHAR(20) DEFAULT NULL,
            profesional_habitual ENUM('norberto', 'maria', 'indistinto') NOT NULL DEFAULT 'indistinto',
            motivo_consulta VARCHAR(255) DEFAULT NULL,
            notas TEXT DEFAULT NULL,
            origen ENUM('whatsapp', 'web', 'admin') NOT NULL DEFAULT 'whatsapp',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_pacientes_tel (telefono),
            INDEX idx_pacientes_nombre (nombre_completo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS lista_espera (
            id INT AUTO_INCREMENT PRIMARY KEY,
            paciente_telefono VARCHAR(20) NOT NULL,
            paciente_nombre VARCHAR(120) NOT NULL,
            rango_horario_preferido VARCHAR(100) DEFAULT NULL,
            dias_preferidos VARCHAR(100) DEFAULT NULL,
            profesional ENUM('norberto', 'maria', 'indistinto') NOT NULL DEFAULT 'indistinto',
            estado ENUM('activa', 'notificado', 'asignado', 'expirada') NOT NULL DEFAULT 'activa',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_waitlist_tel (paciente_telefono)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // 2. Si la tabla ya existía, asegurar existencia de columnas 'nombre' y 'apellido'
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM pacientes")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('nombre', $cols, true)) {
            $pdo->exec("ALTER TABLE pacientes ADD nombre VARCHAR(60) NOT NULL DEFAULT '' AFTER telefono");
        }
        if (!in_array('apellido', $cols, true)) {
            $pdo->exec("ALTER TABLE pacientes ADD apellido VARCHAR(60) NOT NULL DEFAULT '' AFTER nombre");
        }
        // Poblar nombre y apellido si están vacíos dividiendo nombre_completo
        $pdo->exec("
            UPDATE pacientes 
            SET nombre = SUBSTRING_INDEX(nombre_completo, ' ', 1),
                apellido = TRIM(SUBSTRING(nombre_completo, LENGTH(SUBSTRING_INDEX(nombre_completo, ' ', 1)) + 1))
            WHERE (nombre = '' OR nombre IS NULL) AND nombre_completo != ''
        ");
    } catch (Throwable $e) {
        // En caso de que SHOW COLUMNS falle o ya esté aplicado, no interrumpir
    }

    // 3. Sembrar datos iniciales si la tabla está completamente vacía
    try {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM pacientes")->fetchColumn();
        if ($count === 0) {
            $seedFile = __DIR__ . '/seed_pacientes.sql';
            if (is_file($seedFile)) {
                $sql = file_get_contents($seedFile);
                if ($sql) {
                    $pdo->exec($sql);
                }
            }
        }
    } catch (Throwable $e) {
        // Ignorar si el seed falla
    }

    $checked = true;
}

// Autenticación dual: Sesión web de usuario (admin) o Token de API (bot / n8n)
function authenticate_request(?array &$bodyData = null): array
{
    $config = cfg();
    $expectedSecret = (string) ($config['webhook_secret'] ?? $config['install_token'] ?? '');

    // 1. Chequeo por Header de API o Webhook
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($authHeader, 'Bearer ')) {
        $token = trim(substr($authHeader, 7));
        if ($expectedSecret !== '' && hash_equals($expectedSecret, $token)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    $webhookHeader = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '';
    if ($webhookHeader !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $webhookHeader)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    // 2. Chequeo por parámetro GET (ej. n8n workflow de recordatorios: ?action=directory&secret=...)
    $querySecret = (string) ($_GET['secret'] ?? $_GET['token'] ?? '');
    if ($querySecret !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $querySecret)) {
        return ['type' => 'api_token', 'user' => 'bot'];
    }

    // 3. Chequeo por payload JSON (ej. n8n workflow live POST con campo 'secret')
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'POST' || $method === 'PUT') {
        if ($bodyData === null) {
            $bodyData = read_json();
        }
        $payloadSecret = (string) ($bodyData['secret'] ?? $bodyData['token'] ?? '');
        if ($payloadSecret !== '' && $expectedSecret !== '' && hash_equals($expectedSecret, $payloadSecret)) {
            return ['type' => 'api_token', 'user' => 'bot'];
        }
    }

    // 4. Si no es API, requerir sesión web activa de Kinésica
    require_header();
    $user = require_auth();
    return ['type' => 'session', 'user' => $user['username'], 'name' => $user['name']];
}

try {
    $data = null;
    $auth = authenticate_request($data);
    $pdo = db();
    ensure_pacientes_tables($pdo);
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // ---------------------------------------------------------
    // GET: Listado, búsqueda y directorio de pacientes
    // ---------------------------------------------------------
    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        // Acción especializada para el workflow de recordatorios de n8n
        // Devuelve diccionario plano { [nombre_normalizado]: telefono }
        if ($action === 'directory' || $action === 'get_directory') {
            $stmt = $pdo->query('SELECT nombre_completo, telefono FROM pacientes WHERE telefono IS NOT NULL AND telefono != ""');
            $directory = [];
            while ($row = $stmt->fetch()) {
                $norm = normalize_search_key($row['nombre_completo']);
                if ($norm !== '') {
                    $directory[$norm] = $row['telefono'];
                }
            }
            json_out(200, ['status' => 'success', 'directory' => $directory]);
        }

        // Listado de lista de espera
        if ($action === 'waitlist') {
            $stmt = $pdo->query('SELECT * FROM lista_espera WHERE estado = "activa" ORDER BY created_at DESC');
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        // Búsqueda por término o listado completo para el panel admin
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            $stmt = $pdo->prepare('
                SELECT * FROM pacientes 
                WHERE nombre_completo LIKE :q OR nombre LIKE :q OR apellido LIKE :q OR telefono LIKE :q OR dni LIKE :q 
                ORDER BY nombre_completo ASC LIMIT 100
            ');
            $stmt->execute(['q' => "%$q%"]);
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        $stmt = $pdo->query('SELECT * FROM pacientes ORDER BY nombre_completo ASC');
        json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
    }

    // ---------------------------------------------------------
    // POST: Altas, upserts y actualizaciones desde bot o admin
    // ---------------------------------------------------------
    if ($method === 'POST') {
        if ($data === null) {
            $data = read_json();
        }
        $action = $data['action'] ?? 'upsert';

        // 1. Alta o actualización de paciente (upsert por teléfono)
        if ($action === 'upsert' || $action === 'insert') {
            $rawPhone = (string) ($data['telefono'] ?? '');
            $phone = clean_phone_number($rawPhone);
            if (strlen($phone) < 8) {
                json_out(422, ['status' => 'error', 'message' => 'Número de teléfono inválido o incompleto']);
            }

            $nombre = trim((string) ($data['nombre'] ?? ''));
            $apellido = trim((string) ($data['apellido'] ?? ''));
            $nombreCompleto = trim((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? ''));

            if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) {
                $nombreCompleto = trim($nombre . ' ' . $apellido);
            } elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
                $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $nombre = $parts[0] ?? $nombreCompleto;
                $apellido = $parts[1] ?? '';
            }

            if ($nombreCompleto === '') {
                json_out(422, ['status' => 'error', 'message' => 'El nombre y apellido son obligatorios']);
            }

            $nombrePila = trim((string) ($data['nombre_pila'] ?? ''));
            if ($nombrePila === '') {
                $nombrePila = extract_first_name($nombreCompleto);
            }

            $dni = isset($data['dni']) && trim((string) $data['dni']) !== '' && trim((string) $data['dni']) !== 'No provisto' 
                ? trim((string) $data['dni']) 
                : null;

            $profesional = in_array($data['profesional_habitual'] ?? '', ['norberto', 'maria', 'indistinto'], true)
                ? $data['profesional_habitual']
                : 'indistinto';

            $motivo = isset($data['motivo_consulta']) ? trim((string) $data['motivo_consulta']) : null;
            $notas = isset($data['notas']) ? trim((string) $data['notas']) : null;
            $origen = in_array($data['origen'] ?? '', ['whatsapp', 'web', 'admin'], true) ? $data['origen'] : 'whatsapp';

            $stmt = $pdo->prepare('
                INSERT INTO pacientes (
                    telefono, nombre, apellido, nombre_completo, nombre_pila, dni, profesional_habitual, 
                    motivo_consulta, notas, origen
                ) VALUES (
                    :telefono, :nombre, :apellido, :nombre_completo, :nombre_pila, :dni, :profesional_habitual, 
                    :motivo_consulta, :notas, :origen
                )
                ON DUPLICATE KEY UPDATE
                    nombre = CASE WHEN VALUES(nombre) != "" THEN VALUES(nombre) ELSE nombre END,
                    apellido = CASE WHEN VALUES(apellido) != "" THEN VALUES(apellido) ELSE apellido END,
                    nombre_completo = VALUES(nombre_completo),
                    nombre_pila = VALUES(nombre_pila),
                    dni = COALESCE(VALUES(dni), dni),
                    profesional_habitual = CASE WHEN VALUES(profesional_habitual) != "indistinto" THEN VALUES(profesional_habitual) ELSE profesional_habitual END,
                    motivo_consulta = COALESCE(VALUES(motivo_consulta), motivo_consulta),
                    notas = COALESCE(VALUES(notas), notas)
            ');

            $stmt->execute([
                'telefono' => $phone,
                'nombre' => $nombre,
                'apellido' => $apellido,
                'nombre_completo' => $nombreCompleto,
                'nombre_pila' => $nombrePila,
                'dni' => $dni,
                'profesional_habitual' => $profesional,
                'motivo_consulta' => $motivo,
                'notas' => $notas,
                'origen' => $origen,
            ]);

            json_out(200, [
                'status' => 'success',
                'action' => 'upsert',
                'phone' => $phone,
                'nombre' => $nombre,
                'apellido' => $apellido,
                'nombre_pila' => $nombrePila
            ]);
        }

        // 2. Actualizar únicamente el nombre dado un teléfono (ej. Clara detecta corrección)
        if ($action === 'update_name') {
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
            $nombre = trim((string) ($data['nombre'] ?? ''));
            $apellido = trim((string) ($data['apellido'] ?? ''));
            $nombreCompleto = trim((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? ''));

            if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) {
                $nombreCompleto = trim($nombre . ' ' . $apellido);
            } elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
                $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $nombre = $parts[0] ?? $nombreCompleto;
                $apellido = $parts[1] ?? '';
            }

            if ($phone === '' || $nombreCompleto === '') {
                json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre son requeridos']);
            }
            $nombrePila = extract_first_name($nombreCompleto);

            $stmt = $pdo->prepare('UPDATE pacientes SET nombre = :nombre, apellido = :apellido, nombre_completo = :full, nombre_pila = :pila WHERE telefono = :tel');
            $stmt->execute(['nombre' => $nombre, 'apellido' => $apellido, 'full' => $nombreCompleto, 'pila' => $nombrePila, 'tel' => $phone]);

            json_out(200, ['status' => 'success', 'updated' => $stmt->rowCount()]);
        }

        // 3. Modificar teléfono de un paciente existente (desde el panel de administración)
        if ($action === 'update_phone') {
            $id = (int) ($data['id'] ?? 0);
            $newPhone = clean_phone_number((string) ($data['nuevo_telefono'] ?? ''));
            if ($id <= 0 || strlen($newPhone) < 8) {
                json_out(422, ['status' => 'error', 'message' => 'ID o teléfono inválido']);
            }

            // Verificar si el nuevo teléfono ya está usado por otro paciente
            $check = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel AND id != :id');
            $check->execute(['tel' => $newPhone, 'id' => $id]);
            $existing = $check->fetch();
            if ($existing) {
                json_out(409, [
                    'status' => 'error', 
                    'message' => 'Ese teléfono ya está asignado al paciente ' . $existing['nombre_completo']
                ]);
            }

            $stmt = $pdo->prepare('UPDATE pacientes SET telefono = :tel WHERE id = :id');
            $stmt->execute(['tel' => $newPhone, 'id' => $id]);

            json_out(200, ['status' => 'success', 'id' => $id, 'nuevo_telefono' => $newPhone]);
        }

        // 4. Lista de Espera: Insertar
        if ($action === 'waitlist_insert' || $action === 'insert_waitlist') {
            $phone = clean_phone_number((string) ($data['telefono'] ?? $data['paciente_telefono'] ?? ''));
            $nombre = trim((string) ($data['nombre'] ?? $data['paciente_nombre'] ?? ''));
            $horario = trim((string) ($data['rango_horario_preferido'] ?? ''));
            $dias = trim((string) ($data['dias_preferidos'] ?? ''));
            $profesional = in_array($data['profesional'] ?? '', ['norberto', 'maria', 'indistinto'], true) ? $data['profesional'] : 'indistinto';

            if ($phone === '' || $nombre === '') {
                json_out(422, ['status' => 'error', 'message' => 'Teléfono y nombre requeridos']);
            }

            $stmt = $pdo->prepare('
                INSERT INTO lista_espera (paciente_telefono, paciente_nombre, rango_horario_preferido, dias_preferidos, profesional, estado)
                VALUES (:tel, :nom, :hor, :dias, :prof, "activa")
            ');
            $stmt->execute([
                'tel' => $phone,
                'nom' => $nombre,
                'hor' => $horario,
                'dias' => $dias,
                'prof' => $profesional
            ]);

            json_out(200, ['status' => 'success', 'id' => (int) $pdo->lastInsertId()]);
        }

        // 5. Lista de Espera: Remover o completar
        if ($action === 'waitlist_remove' || $action === 'remove_waitlist') {
            $id = (int) ($data['id'] ?? 0);
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));

            if ($id > 0) {
                $stmt = $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE id = :id');
                $stmt->execute(['id' => $id]);
            } elseif ($phone !== '') {
                $stmt = $pdo->prepare('UPDATE lista_espera SET estado = "asignado" WHERE paciente_telefono = :tel');
                $stmt->execute(['tel' => $phone]);
            }
            json_out(200, ['status' => 'success']);
        }

        json_out(400, ['status' => 'error', 'message' => 'Acción desconocida']);
    }

    // ---------------------------------------------------------
    // PUT: Edición completa de un paciente desde el panel admin
    // ---------------------------------------------------------
    if ($method === 'PUT') {
        if ($data === null) {
            $data = read_json();
        }
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) {
            json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
        }

        $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
        $nombre = trim((string) ($data['nombre'] ?? ''));
        $apellido = trim((string) ($data['apellido'] ?? ''));
        $nombreCompleto = trim((string) ($data['nombre_completo'] ?? ''));

        if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) {
            $nombreCompleto = trim($nombre . ' ' . $apellido);
        } elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
            $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
            $nombre = $parts[0] ?? $nombreCompleto;
            $apellido = $parts[1] ?? '';
        }

        if (strlen($phone) < 8 || $nombreCompleto === '') {
            json_out(422, ['status' => 'error', 'message' => 'Nombre, apellido y teléfono son obligatorios']);
        }

        // Verificar si el teléfono ya lo tiene otro registro
        $check = $pdo->prepare('SELECT id, nombre_completo FROM pacientes WHERE telefono = :tel AND id != :id');
        $check->execute(['tel' => $phone, 'id' => $id]);
        $existing = $check->fetch();
        if ($existing) {
            json_out(409, [
                'status' => 'error', 
                'message' => 'Ese teléfono ya está asignado al paciente ' . $existing['nombre_completo']
            ]);
        }

        $nombrePila = extract_first_name($nombreCompleto);
        $dni = !empty($data['dni']) ? trim((string) $data['dni']) : null;
        $profesional = in_array($data['profesional_habitual'] ?? '', ['norberto', 'maria', 'indistinto'], true) 
            ? $data['profesional_habitual'] 
            : 'indistinto';
        $motivo = !empty($data['motivo_consulta']) ? trim((string) $data['motivo_consulta']) : null;
        $notas = !empty($data['notas']) ? trim((string) $data['notas']) : null;

        $stmt = $pdo->prepare('
            UPDATE pacientes SET
                telefono = :tel,
                nombre = :nombre,
                apellido = :apellido,
                nombre_completo = :nom,
                nombre_pila = :pila,
                dni = :dni,
                profesional_habitual = :prof,
                motivo_consulta = :motivo,
                notas = :notas
            WHERE id = :id
        ');
        $stmt->execute([
            'tel' => $phone,
            'nombre' => $nombre,
            'apellido' => $apellido,
            'nom' => $nombreCompleto,
            'pila' => $nombrePila,
            'dni' => $dni,
            'prof' => $profesional,
            'motivo' => $motivo,
            'notas' => $notas,
            'id' => $id
        ]);

        json_out(200, ['status' => 'success', 'message' => 'Paciente actualizado con éxito']);
    }

    // ---------------------------------------------------------
    // DELETE: Eliminar paciente por ID (solo admin)
    // ---------------------------------------------------------
    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
        }

        $stmt = $pdo->prepare('DELETE FROM pacientes WHERE id = :id');
        $stmt->execute(['id' => $id]);

        json_out(200, ['status' => 'success', 'message' => 'Paciente eliminado']);
    }

    json_out(405, ['status' => 'error', 'message' => 'Método HTTP no permitido']);

} catch (Throwable $e) {
    error_log('kinesica admin pacientes.php error: ' . $e->getMessage());
    json_out(500, [
        'status' => 'error',
        'message' => 'Error al procesar pacientes: ' . $e->getMessage()
    ]);
}
