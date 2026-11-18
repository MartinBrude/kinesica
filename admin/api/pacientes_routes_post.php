<?php
declare(strict_types=1);

    if ($method === 'POST') {
        if ($data === null) $data = read_json();
        $action = $data['action'] ?? 'upsert';

        if (is_colaborador($auth) && $action !== 'get_email_by_phone') {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
        }

        $authType = (string) ($auth['type'] ?? '');
        $isSession = $authType === 'session';
        // Acciones admin/destructivas o de correo libre: solo sesión humana (no webhook/bot).
        $sessionOnlyActions = [
            'merge',
            'deduplicate',
            'resolve_indistintos',
            'send_email',
            'send_fallback_email',
            'send_encuesta_invite',
            'toggle_review',
            'toggle_campana',
            'update_phone',
            'get_email_by_phone',
        ];
        if (in_array($action, $sessionOnlyActions, true) && !$isSession) {
            json_out(403, ['status' => 'error', 'message' => 'Esta acción requiere sesión de usuario en el panel admin.']);
        }

        // Correo libre / encuesta: solo admin con sesión (no profesional ni token).
        if (
            ($action === 'send_encuesta_invite' || $action === 'send_email' || $action === 'send_fallback_email')
            && !is_admin($auth)
        ) {
            json_out(403, ['status' => 'error', 'message' => 'Solo un administrador con sesión puede realizar esta acción.']);
        }

        if ($action === 'get_email_by_phone') {
            require_once __DIR__ . '/pacientes_helpers_email_by_phone.php';
            $res = kinesica_pacientes_email_by_phone($pdo, (string) ($data['telefono'] ?? ''));
            json_out(200, $res);
        }

        if ($action === 'send_fallback_email' || $action === 'send_email') {
            $to = trim((string) ($data['to'] ?? 'norberto1712@gmail.com'));
            $subject = trim((string) ($data['subject'] ?? 'Aviso Kinésica'));
            $html = (string) ($data['html'] ?? $data['body'] ?? '');
            $text = trim((string) ($data['text'] ?? $data['body'] ?? ''));
            if ($text === '' && $html !== '') {
                $cleanedHtml = preg_replace('/<style\b[^>]*>(.*?)<\/style>/is', '', $html);
                $text = trim(strip_tags((string) $cleanedHtml));
            }
            $sent = send_html_mail($to, $subject, $html, $text);
            json_out(200, ['status' => $sent ? 'success' : 'error', 'message' => $sent ? 'Correo enviado' : 'Error al enviar correo']);
        }

        if ($action === 'deduplicate' || $action === 'resolve_indistintos') {
            // Solo dedupe/indistintos livianos. El mantenimiento completo (sync fichas)
            // queda para cron / force=true; dispararlo acá tumbaba el listado y el alta.
            $merged = deduplicate_pacientes_table($pdo);
            $resolved = resolve_indistinto_pacientes_from_calendar($pdo);
            $cntStmt = $pdo->query('SELECT COUNT(*) FROM pacientes');
            $total = (int) $cntStmt->fetchColumn();
            json_out(200, ['status' => 'success', 'merged' => $merged, 'resolved' => $resolved, 'total' => $total]);
        }

        if ($action === 'merge') {
            $sourceId = (int) ($data['source_id'] ?? 0);
            $targetId = (int) ($data['target_id'] ?? 0);
            if ($sourceId <= 0 || $targetId <= 0 || $sourceId === $targetId) {
                json_out(422, ['status' => 'error', 'message' => 'IDs de pacientes inválidos o idénticos para la unificación']);
            }
            require_once __DIR__ . '/pacientes_helpers_merge_explicit.php';
            $res = kinesica_pacientes_merge_explicit($pdo, $sourceId, $targetId);
            json_out($res['ok'] ? 200 : 400, $res);
        }

        if ($action === 'upsert' || $action === 'insert') {
            kinesica_pacientes_upsert($pdo, $data);
        }

        if ($action === 'update_name') {
            $id = (int) ($data['id'] ?? 0);
            $phone = clean_phone_number((string) ($data['telefono'] ?? ''));
            $nombre = sanitize_patient_name((string) ($data['nombre'] ?? ''));
            $apellido = sanitize_patient_name((string) ($data['apellido'] ?? ''));
            $nombreCompleto = sanitize_patient_name((string) ($data['nombre_completo'] ?? $data['nombre_apellido'] ?? ''));
            if ($nombreCompleto === '' && ($nombre !== '' || $apellido !== '')) $nombreCompleto = trim($nombre . ' ' . $apellido);
            elseif ($nombreCompleto !== '' && $nombre === '' && $apellido === '') {
                $parts = preg_split('/\s+/u', $nombreCompleto, 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $nombre = $parts[0] ?? $nombreCompleto;
                $apellido = $parts[1] ?? '';
            }
            if ($id <= 0 && $phone === '') json_out(422, ['status' => 'error', 'message' => 'ID o teléfono requerido']);
            if ($nombreCompleto === '') json_out(422, ['status' => 'error', 'message' => 'Nombre requerido']);
            if (is_tk3_or_blocked_name($nombreCompleto) || is_tk3_or_blocked_name($nombre)) {
                json_out(422, ['status' => 'error', 'message' => 'El nombre no corresponde a un paciente válido']);
            }
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            $alive = kinesica_pacientes_alive_sql($pdo);
            if ($id <= 0) {
                // Resolver a un único id activo por teléfono exacto (evita UPDATE masivo).
                $find = $pdo->prepare("SELECT id FROM pacientes WHERE telefono = :tel AND ({$alive}) LIMIT 2");
                $find->execute(['tel' => $phone]);
                $ids = $find->fetchAll(PDO::FETCH_COLUMN) ?: [];
                if (count($ids) === 0) {
                    json_out(404, ['status' => 'error', 'message' => 'No se encontró paciente activo con ese teléfono']);
                }
                if (count($ids) > 1) {
                    json_out(409, ['status' => 'error', 'message' => 'Hay más de un paciente con ese teléfono; indicá el id']);
                }
                $id = (int) $ids[0];
            }
            $stmt = $pdo->prepare(
                "UPDATE pacientes SET nombre = :nombre, apellido = :apellido, nombre_completo = :full, nombre_pila = :pila
                 WHERE id = :id AND ({$alive})"
            );
            $stmt->execute([
                'nombre' => $nombre,
                'apellido' => $apellido,
                'full' => $nombreCompleto,
                'pila' => extract_first_name($nombreCompleto),
                'id' => $id,
            ]);
            if ($stmt->rowCount() < 1 && !kinesica_pacientes_fetch_alive($pdo, $id)) {
                json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
            }
            json_out(200, ['status' => 'success', 'updated' => max(1, $stmt->rowCount()), 'id' => $id]);
        }

        if ($action === 'update_phone') {
            $id = (int) ($data['id'] ?? 0);
            $newPhone = clean_phone_number((string) ($data['nuevo_telefono'] ?? ''));
            if ($id <= 0 || strlen($newPhone) < 6 || strlen($newPhone) > 16 || preg_match('/^(\d)\1+$/', $newPhone)) {
                json_out(422, ['status' => 'error', 'message' => 'ID o teléfono inválido']);
            }
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            kinesica_pacientes_require_alive($pdo, $id);
            $alive = kinesica_pacientes_alive_sql($pdo);
            $check = $pdo->prepare('SELECT id FROM pacientes WHERE telefono = :tel AND id != :id LIMIT 1');
            $check->execute(['tel' => $newPhone, 'id' => $id]);
            $existing = $check->fetch();
            if ($existing) {
                json_out(409, [
                    'status' => 'error',
                    'message' => 'Ese teléfono ya está asignado a otro paciente',
                    'conflict_id' => (int) $existing['id'],
                ]);
            }
            $stmt = $pdo->prepare("UPDATE pacientes SET telefono = :tel WHERE id = :id AND ({$alive})");
            $stmt->execute(['tel' => $newPhone, 'id' => $id]);
            if ($stmt->rowCount() < 1 && !kinesica_pacientes_fetch_alive($pdo, $id)) {
                json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
            }
            json_out(200, ['status' => 'success', 'id' => $id, 'nuevo_telefono' => $newPhone]);
        }

        if ($action === 'toggle_review') {
            $id = (int) ($data['id'] ?? 0);
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            kinesica_pacientes_require_alive($pdo, $id);
            $alive = kinesica_pacientes_alive_sql($pdo);
            $val = !empty($data['dejo_review']) ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE pacientes SET dejo_review = :val WHERE id = :id AND ({$alive})");
            $stmt->execute(['val' => $val, 'id' => $id]);
            if ($stmt->rowCount() < 1 && !kinesica_pacientes_fetch_alive($pdo, $id)) {
                json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
            }
            json_out(200, ['status' => 'success', 'id' => $id, 'dejo_review' => $val]);
        }

        if ($action === 'toggle_campana') {
            $id = (int) ($data['id'] ?? 0);
            if (!array_key_exists('viene_de_campana', $data)) {
                json_out(422, ['status' => 'error', 'message' => 'viene_de_campana requerido (true/false)']);
            }
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            kinesica_pacientes_require_alive($pdo, $id);
            $alive = kinesica_pacientes_alive_sql($pdo);
            $val = !empty($data['viene_de_campana']) ? 1 : 0;
            $stmt = $pdo->prepare("UPDATE pacientes SET viene_de_campana = :val WHERE id = :id AND ({$alive})");
            $stmt->execute(['val' => $val, 'id' => $id]);
            if ($stmt->rowCount() < 1 && !kinesica_pacientes_fetch_alive($pdo, $id)) {
                json_out(404, ['status' => 'error', 'message' => 'Paciente no encontrado']);
            }
            json_out(200, ['status' => 'success', 'id' => $id, 'viene_de_campana' => $val]);
        }

        if ($action === 'send_encuesta_invite') {
            $id = (int) ($data['id'] ?? 0);
            require_once __DIR__ . '/pacientes_helpers_existing_patient_match.php';
            $paciente = kinesica_pacientes_require_alive($pdo, $id);
            if (!empty($paciente['encuesta_enviada'])) {
                json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
            }

            $phone = clean_phone_number((string) ($paciente['telefono'] ?? ''));
            if ($phone === '' || is_placeholder_phone($phone)) {
                json_out(422, ['status' => 'error', 'message' => 'El paciente no tiene un teléfono de WhatsApp válido']);
            }

            // Claim atómico antes del WhatsApp: evita doble envío por doble clic / tabs.
            $claim = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 1 WHERE id = :id AND encuesta_enviada = 0');
            $claim->execute(['id' => $id]);
            if ($claim->rowCount() < 1) {
                json_out(409, ['status' => 'error', 'message' => 'La encuesta ya fue enviada a este paciente', 'encuesta_enviada' => 1]);
            }

            $firstName = trim((string) ($paciente['nombre_pila'] ?? ''));
            if ($firstName === '') {
                $firstName = trim((string) ($paciente['nombre'] ?? ''));
            }
            if ($firstName === '' && !empty($paciente['nombre_completo'])) {
                $parts = preg_split('/\s+/u', trim((string) $paciente['nombre_completo']), 2, PREG_SPLIT_NO_EMPTY) ?: [];
                $firstName = $parts[0] ?? '';
            }
            $saludo = $firstName !== '' ? ('Hola ' . $firstName . '!') : 'Hola!';
            $body = $saludo . "\n"
                . "Te escribo de Kinésica. Nos ayudaría mucho que respondas esta breve encuesta anónima sobre tu experiencia (menos de un minuto):\n"
                . "https://www.kinesica.com.ar/encuesta.html\n"
                . "¡Muchas gracias!";

            $waResult = send_whatsapp_alert_payload([
                'to' => $phone,
                'body' => $body,
                'preview_url' => true,
            ]);
            if (empty($waResult['ok'])) {
                // Liberar el claim para poder reintentar.
                try {
                    $release = $pdo->prepare('UPDATE pacientes SET encuesta_enviada = 0 WHERE id = :id AND encuesta_enviada = 1');
                    $release->execute(['id' => $id]);
                } catch (Throwable $e) {
                    error_log('send_encuesta_invite release flag failed: ' . $e->getMessage());
                }
                $err = (string) ($waResult['error'] ?? 'No se pudo enviar el WhatsApp');
                error_log(
                    'send_encuesta_invite wa fail id=' . $id
                    . ' http=' . (string) ($waResult['http_code'] ?? '')
                    . ' err=' . $err
                );
                $waSafe = function_exists('kinesica_whatsapp_client_safe_result')
                    ? kinesica_whatsapp_client_safe_result($waResult)
                    : [
                        'ok' => false,
                        'error' => $err,
                        'http_code' => isset($waResult['http_code']) ? (int) $waResult['http_code'] : null,
                        'via' => $waResult['via'] ?? null,
                    ];
                json_out(502, [
                    'status' => 'error',
                    'message' => $err,
                    'wa' => $waSafe,
                ]);
            }

            json_out(200, [
                'status' => 'success',
                'id' => $id,
                'encuesta_enviada' => 1,
                'via' => $waResult['via'] ?? null,
            ]);
        }

        if (str_starts_with($action, 'waitlist_') || str_ends_with($action, '_waitlist')) {
            kinesica_pacientes_waitlist_ops($pdo, $action, $data);
        }

        json_out(400, ['status' => 'error', 'message' => 'Acción desconocida']);
    }

