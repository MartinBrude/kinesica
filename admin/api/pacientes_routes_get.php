<?php
declare(strict_types=1);

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        if (!empty($_GET['counts_only']) || $action === 'counts' || $action === 'missing_phone_count' || $action === 'badge') {
            require_once __DIR__ . '/lib_relational_integrity.php';
            $alive = kinesica_rel_pacientes_not_deleted_sql($pdo);
            $stmt = $pdo->query("SELECT id, telefono FROM pacientes WHERE {$alive} AND LOWER(nombre_completo) NOT LIKE '%tk3%' AND LOWER(nombre_completo) NOT LIKE '%tk 3%' AND LOWER(nombre_completo) NOT LIKE '%no dar%'");
            $missing = 0;
            $total = 0;
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $total++;
                $rawTel = (string) ($row['telefono'] ?? '');
                $t = clean_phone_number($rawTel);
                $isPlaceholder = is_placeholder_phone($rawTel);
                if ($isPlaceholder || strlen($t) < 5) {
                    $missing++;
                }
            }
            json_out(200, [
                'status' => 'success',
                'ok' => true,
                'total' => $total,
                'missing_phone_count' => $missing,
            ]);
        }

        if ($action === 'directory' || $action === 'get_directory') {
            // REL: excluir soft-deleted (etapa 9).
            require_once __DIR__ . '/lib_relational_integrity.php';
            $alive = kinesica_rel_pacientes_not_deleted_sql($pdo);
            $stmt = $pdo->query("SELECT nombre, apellido, nombre_completo, telefono, email FROM pacientes WHERE {$alive} AND LOWER(nombre_completo) NOT LIKE '%tk3%' AND LOWER(nombre_completo) NOT LIKE '%tk 3%' AND LOWER(nombre_completo) NOT LIKE '%no dar%'");
            $directory = [];
            $emails = [];
            while ($row = $stmt->fetch()) {
                $rawTel = trim((string) ($row['telefono'] ?? ''));
                $tel = clean_phone_number($rawTel);
                $email = trim((string) ($row['email'] ?? ''));
                $keys = [];
                $norm = normalize_search_key($row['nombre_completo'] ?? '');
                if ($norm !== '') $keys[] = $norm;
                if (!empty($row['nombre_completo'])) $keys[] = (string) $row['nombre_completo'];
                $firstLast = trim(($row['nombre'] ?? '') . ' ' . ($row['apellido'] ?? ''));
                if ($firstLast !== '') $keys[] = $firstLast;
                $lastFirst = trim(($row['apellido'] ?? '') . ' ' . ($row['nombre'] ?? ''));
                if ($lastFirst !== '') $keys[] = $lastFirst;
                foreach (array_unique($keys) as $k) {
                    if ($tel !== '') $directory[$k] = $tel;
                    if ($email !== '' && is_valid_email_strict($email)) $emails[$k] = strtolower($email);
                }
            }
            json_out(200, ['status' => 'success', 'directory' => $directory, 'emails' => $emails]);
        }

        if ($action === 'get_email_by_phone') {
            $phone = clean_phone_number((string) ($_GET['telefono'] ?? ''));
            if ($phone !== '') {
                $stmt = $pdo->prepare('SELECT email FROM pacientes WHERE telefono = :tel OR telefono LIKE :tel_end LIMIT 1');
                $stmt->execute(['tel' => $phone, 'tel_end' => '%' . substr($phone, -8)]);
                $row = $stmt->fetch();
                if ($row && !empty($row['email'])) json_out(200, ['status' => 'success', 'email' => $row['email']]);
            }
            json_out(200, ['status' => 'not_found', 'email' => '']);
        }

        if ($action === 'waitlist') {
            $stmt = $pdo->query('SELECT * FROM lista_espera WHERE estado = "activa" ORDER BY created_at DESC');
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            try {
                // REL: enrich waitlist si REL_READ_IDS (lib_relational_read.php).
                require_once __DIR__ . '/lib_relational_read.php';
                $items = kinesica_rel_map_lista_rows($pdo, $items);
            } catch (Throwable) {
            }
            json_out(200, ['status' => 'success', 'items' => $items]);
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            // Un named param por cláusula: PDO nativo no reutiliza :q.
            $like = '%' . $q . '%';
            // REL: excluir soft-deleted en búsqueda (etapa 9).
            require_once __DIR__ . '/lib_relational_integrity.php';
            $alive = kinesica_rel_pacientes_not_deleted_sql($pdo);
            $stmt = $pdo->prepare("
                SELECT * FROM pacientes 
                WHERE {$alive}
                  AND (nombre_completo LIKE :q1 OR nombre LIKE :q2 OR apellido LIKE :q3 OR telefono LIKE :q4 OR dni LIKE :q5 OR email LIKE :q6 OR contacto_nombre LIKE :q7 OR contacto_telefono LIKE :q8)
                  AND LOWER(nombre_completo) NOT LIKE \"%tk3%\" AND LOWER(nombre_completo) NOT LIKE \"%tk 3%\"
                  AND LOWER(nombre_completo) NOT LIKE \"%no dar%\"
                ORDER BY CASE WHEN apellido != \"\" THEN apellido ELSE nombre_completo END ASC, nombre ASC LIMIT 100
            ");
            $stmt->execute([
                'q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like,
                'q5' => $like, 'q6' => $like, 'q7' => $like, 'q8' => $like,
            ]);
            json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
        }

        // REL: listado completo sin soft-deleted (etapa 9).
        require_once __DIR__ . '/lib_relational_integrity.php';
        $alive = kinesica_rel_pacientes_not_deleted_sql($pdo);
        $stmt = $pdo->query("SELECT * FROM pacientes WHERE {$alive} AND LOWER(nombre_completo) NOT LIKE \"%tk3%\" AND LOWER(nombre_completo) NOT LIKE \"%tk 3%\" AND LOWER(nombre_completo) NOT LIKE \"%no dar%\" ORDER BY CASE WHEN apellido != \"\" THEN apellido ELSE nombre_completo END ASC, nombre ASC");
        json_out(200, ['status' => 'success', 'items' => $stmt->fetchAll()]);
    }

