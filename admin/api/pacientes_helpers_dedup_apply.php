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
