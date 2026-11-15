<?php
declare(strict_types=1);

/**
 * Fusiona clusters de duplicados en pacientes.
 */
function kinesica_pacientes_dedup_apply_clusters(PDO $pdo, array $clusters): int
{
        $mergedTotal = 0;
        foreach ($clusters as $cluster) {
            if (count($cluster) <= 1) continue;

            usort($cluster, function ($a, $b) {
                $aReal = !is_placeholder_phone((string) ($a['telefono'] ?? ''));
                $bReal = !is_placeholder_phone((string) ($b['telefono'] ?? ''));
                if ($aReal !== $bReal) return $aReal ? -1 : 1;

                $aReview = !empty($a['dejo_review']);
                $bReview = !empty($b['dejo_review']);
                if ($aReview !== $bReview) return $aReview ? -1 : 1;

                $aProf = in_array($a['profesional_habitual'] ?? '', ['norberto', 'maria'], true);
                $bProf = in_array($b['profesional_habitual'] ?? '', ['norberto', 'maria'], true);
                if ($aProf !== $bProf) return $aProf ? -1 : 1;

                return ((int) $a['id']) - ((int) $b['id']);
            });

            $survivor = $cluster[0];
            $survivorId = (int) $survivor['id'];
            $deleteIds = [];

            // Conservar la mayor información posible entre todos los duplicados del cluster.
            $namePick = kinesica_pick_richest_name($cluster);
            $mergedNombre = $namePick['nombre'];
            $mergedApellido = $namePick['apellido'];
            $mergedFull = $namePick['nombre_completo'];
            $mergedPila = $namePick['nombre_pila'];
            $mergedTel = kinesica_pick_best_phone($cluster);
            if ($mergedTel === '') {
                $mergedTel = (string) ($survivor['telefono'] ?? '');
            }

            $mergedReview = 0;
            $mergedEncuesta = 0;
            $mergedCampana = 0;
            $mergedProf = 'indistinto';
            $mergedDni = '';
            $mergedEmail = '';
            $mergedMotivo = '';
            $mergedNotas = '';
            $mergedContactoNom = '';
            $mergedContactoTel = '';
            $mergedContactoEmail = '';
            $mergedContactoNotas = '';
            $mergedOrigen = 'whatsapp';

            foreach ($cluster as $c) {
                if ((int) $c['id'] !== $survivorId) {
                    $deleteIds[] = (int) $c['id'];
                }
                if (!empty($c['dejo_review'])) {
                    $mergedReview = 1;
                }
                if (!empty($c['encuesta_enviada'])) {
                    $mergedEncuesta = 1;
                }
                if (!empty($c['viene_de_campana'])) {
                    $mergedCampana = 1;
                }
                $mergedProf = merge_prof_values($mergedProf, (string) ($c['profesional_habitual'] ?? 'indistinto'));

                $cDni = clean_patient_dni($c['dni'] ?? null);
                if ($cDni === '' && str_starts_with((string) ($c['telefono'] ?? ''), 'sin-tel-dni-')) {
                    $cDni = substr((string) $c['telefono'], 12);
                }
                if ($mergedDni === '' && $cDni !== '') {
                    $mergedDni = $cDni;
                }

                $cEmail = trim((string) ($c['email'] ?? ''));
                if ($mergedEmail === '' && $cEmail !== '') {
                    $mergedEmail = $cEmail;
                } elseif ($mergedEmail !== '' && $cEmail !== '' && strcasecmp($mergedEmail, $cEmail) !== 0) {
                    // Dos mails distintos: conservar ambos en notas de contacto / notas.
                    $mergedNotas = kinesica_merge_text_keep_max(
                        $mergedNotas,
                        'Email alternativo: ' . $cEmail,
                        "\n"
                    );
                }

                $mergedMotivo = kinesica_merge_text_keep_max(
                    $mergedMotivo,
                    trim((string) ($c['motivo_consulta'] ?? '')),
                    ' / '
                );
                $mergedNotas = kinesica_merge_text_keep_max(
                    $mergedNotas,
                    trim((string) ($c['notas'] ?? '')),
                    "\n"
                );

                $cContactoNom = trim((string) ($c['contacto_nombre'] ?? ''));
                if ($mergedContactoNom === '' && $cContactoNom !== '') {
                    $mergedContactoNom = $cContactoNom;
                } elseif ($mergedContactoNom !== '' && $cContactoNom !== ''
                    && mb_strtolower($mergedContactoNom, 'UTF-8') !== mb_strtolower($cContactoNom, 'UTF-8')) {
                    $mergedContactoNotas = kinesica_merge_text_keep_max(
                        $mergedContactoNotas,
                        'Otro contacto: ' . $cContactoNom,
                        ' · '
                    );
                }

                $cContactoTel = trim((string) ($c['contacto_telefono'] ?? ''));
                if ($mergedContactoTel === '' && $cContactoTel !== '') {
                    $mergedContactoTel = $cContactoTel;
                }
                $cContactoEmail = trim((string) ($c['contacto_email'] ?? ''));
                if ($mergedContactoEmail === '' && $cContactoEmail !== '') {
                    $mergedContactoEmail = $cContactoEmail;
                }
                $mergedContactoNotas = kinesica_merge_text_keep_max(
                    $mergedContactoNotas,
                    trim((string) ($c['contacto_notas'] ?? '')),
                    ' · '
                );

                $mergedOrigen = kinesica_prefer_origen(
                    $mergedOrigen,
                    (string) ($c['origen'] ?? 'whatsapp')
                );
            }

            if ($mergedFull === '') {
                $mergedFull = trim($mergedNombre . ' ' . $mergedApellido);
            }
            if ($mergedPila === '') {
                $mergedPila = extract_first_name($mergedFull);
            }

            if (count($deleteIds) > 0) {
                $startedTx = false;
                try {
                    if (!$pdo->inTransaction()) {
                        $pdo->beginTransaction();
                        $startedTx = true;
                    }
                    $inClause = implode(',', array_map('intval', $deleteIds));
                    $pdo->exec("DELETE FROM pacientes WHERE id IN ($inClause)");

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
                        'id' => $survivorId,
                    ]);
                    // Confirmar que el survivor sigue existiendo tras el DELETE.
                    $chk = $pdo->prepare('SELECT id FROM pacientes WHERE id = :id LIMIT 1');
                    $chk->execute(['id' => $survivorId]);
                    if (!$chk->fetch()) {
                        throw new RuntimeException('Survivor desapareció tras DELETE id=' . $survivorId);
                    }
                    if ($startedTx) {
                        $pdo->commit();
                    }
                    $mergedTotal += count($deleteIds);
                } catch (Throwable $clusterErr) {
                    if ($startedTx && $pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    error_log('deduplicate_pacientes_table cluster rollback: ' . $clusterErr->getMessage());
                    // Seguir con el próximo cluster; no abortar todo el barrido.
                }
            }
        }
        return $mergedTotal;
}

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

    require_once __DIR__ . '/lib_migrations.php';
    require_once __DIR__ . '/lib_relational_contactos.php';

    $startedTx = false;
    try {
        if (!$pdo->inTransaction()) {
            $pdo->beginTransaction();
            $startedTx = true;
        }

        // Si existe paciente_contactos, desmarcar principal en origen para prevenir colisiones UNIQUE (SQLite)
        try {
            if (kinesica_migrations_table_exists($pdo, 'paciente_contactos')) {
                $pdo->prepare('UPDATE paciente_contactos SET es_principal = 0 WHERE paciente_id = :source')->execute([
                    'source' => $sourceId,
                ]);
            }
        } catch (Throwable) {
            // Continuar si la columna o tabla difiere
        }

        // Reasignar tablas hijas de integridad referencial
        $childTables = [
            'fichas' => 'paciente_id',
            'turnos' => 'paciente_id',
            'lista_espera' => 'paciente_id',
            'paciente_contactos' => 'paciente_id',
            'interaccion_eventos' => 'paciente_id',
            'interaccion_estado' => 'paciente_id',
            'recordatorio_eventos' => 'paciente_id',
            'encuestas' => 'paciente_id',
        ];
        foreach ($childTables as $t => $col) {
            try {
                if (function_exists('kinesica_migrations_table_exists') && function_exists('kinesica_migrations_column_exists')) {
                    if (!kinesica_migrations_table_exists($pdo, $t) || !kinesica_migrations_column_exists($pdo, $t, $col)) {
                        continue;
                    }
                }
                $pdo->prepare("UPDATE {$t} SET {$col} = :target WHERE {$col} = :source")->execute([
                    'target' => $targetId,
                    'source' => $sourceId,
                ]);
            } catch (Throwable) {
                // Si la tabla no existe en el esquema activo, continuar
            }
        }

        // Eliminar registro origen liberando teléfono UNIQUE
        $pdo->prepare('DELETE FROM pacientes WHERE id = :source')->execute(['source' => $sourceId]);

        // Actualizar registro destino enriquecido
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
