<?php
declare(strict_types=1);

    if ($method === 'PUT') {
        if (is_colaborador($auth)) {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador tienen permisos de solo lectura.']);
        }
        if ($data === null) $data = read_json();
        kinesica_pacientes_update($pdo, $data);
    }

    if ($method === 'DELETE') {
        if (is_colaborador($auth)) {
            json_out(403, ['status' => 'error', 'message' => 'Los usuarios con rol Colaborador no tienen permiso para eliminar pacientes']);
        }
        $user = $auth['username'] ?? '';
        $allowedUsers = ['martin', 'norberto', 'maria'];
        if (!is_admin($auth) && !in_array($user, $allowedUsers, true)) {
            json_out(403, ['status' => 'error', 'message' => 'No tienes permiso para eliminar pacientes']);
        }
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) json_out(422, ['status' => 'error', 'message' => 'ID inválido']);
        // REL: soft-delete (deleted_at). Hard-delete choca con FK RESTRICT (etapa 9).
        require_once __DIR__ . '/lib_relational_integrity.php';
        $res = kinesica_rel_paciente_soft_delete($pdo, $id);
        if (!$res['ok']) {
            $http = $res['code'] === 'not_found' ? 404 : 422;
            json_out($http, [
                'status' => 'error',
                'code' => $res['code'],
                'message' => $res['message'],
            ]);
        }
        json_out(200, [
            'status' => 'success',
            'message' => $res['message'],
            'soft_delete' => true,
        ]);
    }

