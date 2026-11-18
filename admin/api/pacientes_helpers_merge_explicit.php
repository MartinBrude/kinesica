<?php
declare(strict_types=1);

require_once __DIR__ . '/pacientes_helpers_reassign_children.php';

/**
 * Fusiona explícitamente un paciente origen ($sourceId) dentro de un paciente destino ($targetId).
 * Reasigna fichas, turnos, interacciones y notas al target, y elimina el registro origen.
 *
 * @return array{ok:bool,status:string,message:string,target_id?:int,source_id?:int}
 */
function kinesica_pacientes_merge_explicit(PDO $pdo, int $sourceId, int $targetId): array
{
    if ($sourceId <= 0 || $targetId <= 0 || $sourceId === $targetId) {
        return ['ok' => false, 'status' => 'error', 'message' => 'IDs de pacientes inválidos o idénticos para la unificación'];
    }

    $stmt = $pdo->prepare('SELECT * FROM pacientes WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $sourceId]);
    $source = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$source) {
        return ['ok' => false, 'status' => 'error', 'message' => 'El paciente origen no existe o ya fue eliminado'];
    }

    $stmt->execute(['id' => $targetId]);
    $target = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$target) {
        return ['ok' => false, 'status' => 'error', 'message' => 'El paciente destino no existe o ya fue eliminado'];
    }

    $cluster = [$target, $source];
    $namePick = kinesica_pick_richest_name($cluster);
    $mergedNombre = $namePick['nombre'];
    $mergedApellido = $namePick['apellido'];
    $mergedFull = $namePick['nombre_completo'];
    $mergedPila = $namePick['nombre_pila'];

    $targetTel = (string) ($target['telefono'] ?? '');
    $sourceTel = (string) ($source['telefono'] ?? '');
    $targetIsPlaceholder = is_placeholder_phone($targetTel);
    $sourceIsPlaceholder = is_placeholder_phone($sourceTel);

    $mergedTel = $targetTel;
    $mergedNotas = trim((string) ($target['notas'] ?? ''));
    $sourceNotas = trim((string) ($source['notas'] ?? ''));

    if ($targetIsPlaceholder && !$sourceIsPlaceholder && $sourceTel !== '') {
        $mergedTel = $sourceTel;
    } elseif (!$targetIsPlaceholder && !$sourceIsPlaceholder && $sourceTel !== '' && $sourceTel !== $targetTel) {
        $mergedNotas = kinesica_merge_text_keep_max($mergedNotas, 'Teléfono previo: ' . $sourceTel, "\n");
    }

    if ($sourceNotas !== '') {
        $mergedNotas = kinesica_merge_text_keep_max($mergedNotas, $sourceNotas, "\n");
    }

    $targetDni = clean_patient_dni($target['dni'] ?? null);
    $sourceDni = clean_patient_dni($source['dni'] ?? null);
    $mergedDni = $targetDni !== '' ? $targetDni : $sourceDni;

    $targetEmail = trim((string) ($target['email'] ?? ''));
    $sourceEmail = trim((string) ($source['email'] ?? ''));
    $mergedEmail = $targetEmail !== '' ? $targetEmail : $sourceEmail;
    if ($targetEmail !== '' && $sourceEmail !== '' && strcasecmp($targetEmail, $sourceEmail) !== 0) {
        $mergedNotas = kinesica_merge_text_keep_max($mergedNotas, 'Email previo: ' . $sourceEmail, "\n");
    }

    $mergedProf = merge_prof_values(
        (string) ($target['profesional_habitual'] ?? 'indistinto'),
        (string) ($source['profesional_habitual'] ?? 'indistinto')
    );

    $mergedMotivo = kinesica_merge_text_keep_max(
        trim((string) ($target['motivo_consulta'] ?? '')),
        trim((string) ($source['motivo_consulta'] ?? '')),
        ' / '
    );

    $mergedContactoNom = trim((string) ($target['contacto_nombre'] ?? '')) ?: trim((string) ($source['contacto_nombre'] ?? ''));
    $mergedContactoTel = trim((string) ($target['contacto_telefono'] ?? '')) ?: trim((string) ($source['contacto_telefono'] ?? ''));
    $mergedContactoEmail = trim((string) ($target['contacto_email'] ?? '')) ?: trim((string) ($source['contacto_email'] ?? ''));
    $mergedContactoNotas = kinesica_merge_text_keep_max(
        trim((string) ($target['contacto_notas'] ?? '')),
        trim((string) ($source['contacto_notas'] ?? '')),
        ' · '
    );

    $mergedReview = (!empty($target['dejo_review']) || !empty($source['dejo_review'])) ? 1 : 0;
    $mergedEncuesta = (!empty($target['encuesta_enviada']) || !empty($source['encuesta_enviada'])) ? 1 : 0;
    $mergedCampana = (!empty($target['viene_de_campana']) || !empty($source['viene_de_campana'])) ? 1 : 0;
    $mergedOrigen = kinesica_prefer_origen((string) ($target['origen'] ?? 'whatsapp'), (string) ($source['origen'] ?? 'whatsapp'));

    require_once __DIR__ . '/lib_relational_contactos.php';

    $startedTx = false;
    try {
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $startedTx = true;
        }

        kinesica_pacientes_reassign_children($pdo, $sourceId, $targetId);

        $pdo->prepare('DELETE FROM pacientes WHERE id = :source')->execute(['source' => $sourceId]);

        $upd = $pdo->prepare('
            UPDATE pacientes SET
                telefono = :tel,
                nombre = :nom,
                apellido = :ape,
                nombre_completo = :full,
                nombre_pila = :pila,
                dni = :dni,
                email = :email,
                profesional_habitual = :prof,
                motivo_consulta = :motivo,
                notas = :notas,
                origen = :origen,
                contacto_nombre = :cnom,
                contacto_telefono = :ctel,
                contacto_email = :cemail,
                contacto_notas = :cnot,
                dejo_review = :rev,
                encuesta_enviada = :encuesta,
                viene_de_campana = :campana
            WHERE id = :id
        ');
        $upd->execute([
            'tel' => mb_substr($mergedTel, 0, 30, 'UTF-8'),
            'nom' => mb_substr($mergedNombre, 0, 60, 'UTF-8'),
            'ape' => mb_substr($mergedApellido, 0, 60, 'UTF-8'),
            'full' => mb_substr($mergedFull, 0, 120, 'UTF-8'),
            'pila' => mb_substr($mergedPila ?: extract_first_name($mergedFull), 0, 60, 'UTF-8'),
            'dni' => $mergedDni !== '' ? mb_substr($mergedDni, 0, 20, 'UTF-8') : null,
            'email' => $mergedEmail !== '' ? mb_substr($mergedEmail, 0, 120, 'UTF-8') : null,
            'prof' => $mergedProf,
            'motivo' => $mergedMotivo !== '' ? mb_substr($mergedMotivo, 0, 255, 'UTF-8') : null,
            'notas' => $mergedNotas !== '' ? mb_substr($mergedNotas, 0, 2000, 'UTF-8') : null,
            'origen' => in_array($mergedOrigen, ['whatsapp', 'web', 'admin'], true) ? $mergedOrigen : 'whatsapp',
            'cnom' => $mergedContactoNom !== '' ? mb_substr($mergedContactoNom, 0, 120, 'UTF-8') : null,
            'ctel' => $mergedContactoTel !== '' ? mb_substr($mergedContactoTel, 0, 30, 'UTF-8') : null,
            'cemail' => $mergedContactoEmail !== '' ? mb_substr($mergedContactoEmail, 0, 120, 'UTF-8') : null,
            'cnot' => $mergedContactoNotas !== '' ? mb_substr($mergedContactoNotas, 0, 100, 'UTF-8') : null,
            'rev' => $mergedReview,
            'encuesta' => $mergedEncuesta,
            'campana' => $mergedCampana,
            'id' => $targetId,
        ]);

        if (function_exists('kinesica_rel_sync_paciente_contactos_safe')) {
            kinesica_rel_sync_paciente_contactos_safe($pdo, $targetId, [
                'telefono' => $mergedTel,
                'email' => $mergedEmail,
            ]);
        }

        if ($startedTx) {
            $pdo->commit();
        }
        return [
            'ok' => true,
            'status' => 'success',
            'target_id' => $targetId,
            'source_id' => $sourceId,
            'message' => 'Fichas unificadas exitosamente',
        ];
    } catch (Throwable $e) {
        if ($startedTx && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log('kinesica_pacientes_merge_explicit error: ' . $e->getMessage());
        return ['ok' => false, 'status' => 'error', 'message' => 'Error al unificar pacientes: ' . $e->getMessage()];
    }
}
