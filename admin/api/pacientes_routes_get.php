<?php
declare(strict_types=1);

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        // Token de integración: solo waitlist. get_email_by_phone es PHI → solo sesión.
        // Listado completo, directorio y búsqueda también exponen PHI → solo sesión.
        $tokenAllowedGet = ['waitlist'];
        if (($auth['type'] ?? '') !== 'session' && !in_array((string) $action, $tokenAllowedGet, true)) {
            json_out(403, [
                'status' => 'error',
                'message' => 'Esta lectura requiere sesión de usuario en el panel admin.',
            ]);
        }

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
                $fullName = trim((string) ($row['nombre_completo'] ?? ''));
                $nom = trim((string) ($row['nombre'] ?? ''));
                $ape = trim((string) ($row['apellido'] ?? ''));

                if (($nom === '' || $ape === '') && $fullName !== '') {
                    $cleanFull = preg_replace('/^(?:dr[a]?\.|lic\.|prof\.)\s*/i', '', $fullName) ?? $fullName;
                    if (str_contains($cleanFull, ',')) {
                        $partsComa = explode(',', $cleanFull, 2);
                        if ($ape === '') $ape = trim($partsComa[0]);
                        if ($nom === '') $nom = trim($partsComa[1]);
                    } else {
                        $words = preg_split('/\s+/', $cleanFull) ?: [];
                        if (count($words) >= 4) {
                            if ($nom === '') $nom = $words[0] . ' ' . $words[1];
                            if ($ape === '') $ape = implode(' ', array_slice($words, 2));
                        } elseif (count($words) === 3) {
                            $firstLower = mb_strtolower($words[0]);
                            if (in_array($firstLower, ['juan', 'maria', 'maría', 'jose', 'josé', 'ana', 'luis', 'carlos'], true)) {
                                if ($nom === '') $nom = $words[0] . ' ' . $words[1];
                                if ($ape === '') $ape = $words[2];
                            } else {
                                if ($nom === '') $nom = $words[0];
                                if ($ape === '') $ape = $words[1] . ' ' . $words[2];
                            }
                        } elseif (count($words) === 2) {
                            if ($nom === '') $nom = $words[0];
                            if ($ape === '') $ape = $words[1];
                        }
                    }
                }

                if ($fullName !== '') {
                    $keys[] = $fullName;
                }
                $firstLast = trim($nom . ' ' . $ape);
                if ($firstLast !== '') $keys[] = $firstLast;
                $lastFirst = trim($ape . ' ' . $nom);
                if ($lastFirst !== '') $keys[] = $lastFirst;

                // Indexar variantes de primer apellido y primer nombre para nombres/apellidos compuestos
                $partsApe = preg_split('/\s+/', $ape) ?: [];
                if (count($partsApe) > 1) {
                    $keys[] = trim($nom . ' ' . $partsApe[0]);
                    $keys[] = trim($partsApe[0] . ' ' . $nom);
                    $keys[] = trim($nom . ' ' . end($partsApe));
                }
                $partsNom = preg_split('/\s+/', $nom) ?: [];
                if (count($partsNom) > 1) {
                    $keys[] = trim($partsNom[0] . ' ' . $ape);
                    if (count($partsApe) > 1) {
                        $keys[] = trim($partsNom[0] . ' ' . $partsApe[0]);
                    }
                }

                $expandedKeys = [];
                foreach ($keys as $k) {
                    $cleanK = trim($k);
                    if ($cleanK === '') continue;
                    $expandedKeys[] = $cleanK;
                    $normK = normalize_search_key($cleanK);
                    if ($normK !== '') $expandedKeys[] = $normK;
                }
                if (function_exists('canonical_patient_name_key')) {
                    $canonK = canonical_patient_name_key($fullName !== '' ? $fullName : $firstLast);
                    if ($canonK !== '') {
                        $expandedKeys[] = $canonK;
                    }
                }

                foreach (array_unique($expandedKeys) as $k) {
                    if ($tel !== '') $directory[$k] = $tel;
                    if ($email !== '' && is_valid_email_strict($email)) $emails[$k] = strtolower($email);
                }
            }
            json_out(200, ['status' => 'success', 'directory' => $directory, 'emails' => $emails]);
        }

        if ($action === 'get_email_by_phone') {
            require_once __DIR__ . '/pacientes_helpers_email_by_phone.php';
            $res = kinesica_pacientes_email_by_phone($pdo, (string) ($_GET['telefono'] ?? ''));
            json_out(200, $res);
        }

        if ($action === 'waitlist') {
            require_once __DIR__ . '/lib_migrations.php';
            if (!kinesica_migrations_table_exists($pdo, 'lista_espera')) {
                json_out(200, ['status' => 'success', 'items' => []]);
            }
            $stmt = $pdo->query('SELECT * FROM lista_espera WHERE estado = "activa" ORDER BY created_at DESC');
            $items = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
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
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            // Solo normaliza la respuesta; persistir con action=heal_phones (admin).
            json_out(200, [
                'status' => 'success',
                'items' => kinesica_pacientes_normalize_phone_rows($pdo, $items),
            ]);
        }

        // REL: listado completo sin soft-deleted (etapa 9).
        require_once __DIR__ . '/lib_relational_integrity.php';
        $alive = kinesica_rel_pacientes_not_deleted_sql($pdo);
        $stmt = $pdo->query("SELECT * FROM pacientes WHERE {$alive} AND LOWER(nombre_completo) NOT LIKE \"%tk3%\" AND LOWER(nombre_completo) NOT LIKE \"%tk 3%\" AND LOWER(nombre_completo) NOT LIKE \"%no dar%\" ORDER BY CASE WHEN apellido != \"\" THEN apellido ELSE nombre_completo END ASC, nombre ASC");
        $items = $stmt ? ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
        json_out(200, [
            'status' => 'success',
            'items' => kinesica_pacientes_normalize_phone_rows($pdo, $items),
        ]);
    }

