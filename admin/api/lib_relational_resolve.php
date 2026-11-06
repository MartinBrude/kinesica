<?php
declare(strict_types=1);

/**
 * Resolución de paciente_id / profesional_id para escrituras con REL_WRITE_IDS.
 * No fusiona. Ante ambigüedad devuelve null y deja traza en métricas.
 */

require_once __DIR__ . '/pacientes_helpers.php';
require_once __DIR__ . '/lib_relational_flags.php';
require_once __DIR__ . '/lib_migrations.php';

/**
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 * @param array{ignore_flag?:bool} $opts ignore_flag=true para backfill CLI aunque REL_WRITE_IDS esté off
 * @return array{paciente_id:?int,status:string,reason:string,candidates:int}
 */
function kinesica_rel_resolve_paciente(PDO $pdo, array $hints, array $opts = []): array
{
    $ignoreFlag = !empty($opts['ignore_flag']);
    if (!$ignoreFlag && !kinesica_rel_write_ids()) {
        return ['paciente_id' => null, 'status' => 'disabled', 'reason' => 'REL_WRITE_IDS off', 'candidates' => 0];
    }
    if (!kinesica_migrations_table_exists($pdo, 'pacientes')) {
        return ['paciente_id' => null, 'status' => 'unmatched', 'reason' => 'sin_tabla_pacientes', 'candidates' => 0];
    }

    $phoneRaw = (string) ($hints['phone'] ?? $hints['wa_id'] ?? '');
    $phone = clean_phone_number($phoneRaw);
    if ($phone === '' && $phoneRaw !== '') {
        $digits = preg_replace('/\D+/', '', $phoneRaw) ?? '';
        if ($digits !== '') {
            $phone = clean_phone_number($digits) ?: $digits;
        }
    }
    $dni = clean_patient_dni(isset($hints['dni']) ? (string) $hints['dni'] : null);
    $nombre = trim((string) ($hints['nombre'] ?? ''));
    $nameKey = $nombre !== '' ? canonical_patient_name_key($nombre) : '';

    // 1) Teléfono normalizado exacto (pacientes.telefono + paciente_contactos)
    if ($phone !== '' && !is_placeholder_phone($phone)) {
        $matches = kinesica_rel_find_pacientes_by_phone($pdo, $phone);
        try {
            require_once __DIR__ . '/lib_relational_contactos.php';
            $fromContactos = kinesica_rel_find_pacientes_by_contacto_phone($pdo, $phone);
            if ($fromContactos !== []) {
                $byId = [];
                foreach (array_merge($matches, $fromContactos) as $m) {
                    $byId[(int) $m['id']] = $m;
                }
                $matches = array_values($byId);
            }
        } catch (Throwable) {
        }
        if (count($matches) === 1) {
            return [
                'paciente_id' => (int) $matches[0]['id'],
                'status' => 'matched',
                'reason' => 'telefono',
                'candidates' => 1,
            ];
        }
        if (count($matches) > 1) {
            $keys = [];
            foreach ($matches as $m) {
                $keys[canonical_patient_name_key((string) ($m['nombre_completo'] ?? ''))] = true;
            }
            if (count($keys) === 1) {
                // Mismo nombre canónico: tomar el de menor id (estable); fusión real es etapa 4.
                usort($matches, static fn ($a, $b) => (int) $a['id'] <=> (int) $b['id']);
                return [
                    'paciente_id' => (int) $matches[0]['id'],
                    'status' => 'matched',
                    'reason' => 'telefono_mismo_nombre',
                    'candidates' => count($matches),
                ];
            }
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'telefono_compartido',
                'candidates' => count($matches),
            ];
        }
    }

    // 2) DNI único
    if ($dni !== '') {
        $matches = kinesica_rel_find_pacientes_by_dni($pdo, $dni);
        if (count($matches) === 1) {
            return [
                'paciente_id' => (int) $matches[0]['id'],
                'status' => 'matched',
                'reason' => 'dni',
                'candidates' => 1,
            ];
        }
        if (count($matches) > 1) {
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'dni_duplicado',
                'candidates' => count($matches),
            ];
        }
    }

    // 3) Nombre único solo si no hubo teléfono (evita vincular mal cuando el wa/tel no matcheó).
    //    Requiere DNI en hints como dato complementario.
    if ($nameKey !== '' && $phone === '' && $dni !== '') {
        $matches = kinesica_rel_find_pacientes_by_name_key($pdo, $nameKey);
        if (count($matches) === 1) {
            return [
                'paciente_id' => (int) $matches[0]['id'],
                'status' => 'matched',
                'reason' => 'nombre_unico_con_dni_hint',
                'candidates' => 1,
            ];
        }
        if (count($matches) > 1) {
            return [
                'paciente_id' => null,
                'status' => 'ambiguous',
                'reason' => 'nombre_ambiguo',
                'candidates' => count($matches),
            ];
        }
    }

    return [
        'paciente_id' => null,
        'status' => 'unmatched',
        'reason' => 'sin_coincidencia',
        'candidates' => 0,
    ];
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_phone(PDO $pdo, string $normPhone): array
{
    $rows = $pdo->query('SELECT id, telefono, nombre_completo, dni FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $out = [];
    foreach ($rows as $row) {
        $raw = (string) ($row['telefono'] ?? '');
        if (is_placeholder_phone($raw)) {
            continue;
        }
        $n = clean_phone_number($raw);
        if ($n === $normPhone) {
            $out[] = $row;
            continue;
        }
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits !== '' && ($digits === $normPhone || clean_phone_number($digits) === $normPhone)) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_dni(PDO $pdo, string $dni): array
{
    $rows = $pdo->query('SELECT id, telefono, nombre_completo, dni FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $out = [];
    foreach ($rows as $row) {
        if (clean_patient_dni($row['dni'] ?? null) === $dni) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */
function kinesica_rel_find_pacientes_by_name_key(PDO $pdo, string $nameKey): array
{
    $rows = $pdo->query('SELECT id, telefono, nombre_completo, dni FROM pacientes')->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $out = [];
    foreach ($rows as $row) {
        if (canonical_patient_name_key((string) ($row['nombre_completo'] ?? '')) === $nameKey) {
            $out[] = $row;
        }
    }
    return $out;
}

/**
 * profesional_id aún no tiene tabla `profesionales` canónica.
 * Hasta etapa 8 devolvemos null (se sigue usando el texto legacy).
 */
function kinesica_rel_resolve_profesional_id(PDO $pdo, string $usernameOrSlug): ?int
{
    if (!kinesica_rel_write_ids()) {
        return null;
    }
    if (!kinesica_migrations_table_exists($pdo, 'profesionales')) {
        return null;
    }
    $slug = strtolower(trim($usernameOrSlug));
    if ($slug === '' || $slug === 'indistinto') {
        return null;
    }
    try {
        $stmt = $pdo->prepare(
            'SELECT id FROM profesionales WHERE username = :u OR slug = :s LIMIT 2'
        );
        $stmt->execute(['u' => $slug, 's' => $slug]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (count($rows) === 1) {
            return (int) $rows[0]['id'];
        }
    } catch (Throwable) {
    }
    return null;
}

function kinesica_rel_unlinked_log_path(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir . '/rel_unlinked.jsonl';
}

/**
 * Registra un write sin paciente_id (métrica diaria / etapa 3).
 * No guarda PII completa: solo contexto, reason y hashes cortos.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */
function kinesica_rel_note_unlinked(string $source, string $status, string $reason, array $hints = []): void
{
    $phone = (string) ($hints['phone'] ?? $hints['wa_id'] ?? '');
    $dni = (string) ($hints['dni'] ?? '');
    $entry = [
        'ts' => gmdate('c'),
        'source' => $source,
        'status' => $status,
        'reason' => $reason,
        'phone_suffix' => $phone !== '' ? substr(preg_replace('/\D+/', '', $phone) ?? '', -4) : '',
        'dni_suffix' => $dni !== '' ? substr(preg_replace('/\D+/', '', $dni) ?? '', -3) : '',
        'name_key' => canonical_patient_name_key((string) ($hints['nombre'] ?? '')),
    ];
    $line = json_encode($entry, JSON_UNESCAPED_UNICODE);
    if ($line === false) {
        return;
    }
    @file_put_contents(kinesica_rel_unlinked_log_path(), $line . "\n", FILE_APPEND | LOCK_EX);
}

/**
 * Resuelve y, si no hay ID, anota métrica. Atajo para writers.
 *
 * @param array{phone?:string,wa_id?:string,dni?:string,nombre?:string} $hints
 */
function kinesica_rel_resolve_paciente_id_or_note(PDO $pdo, string $source, array $hints): ?int
{
    $res = kinesica_rel_resolve_paciente($pdo, $hints);
    if ($res['paciente_id'] !== null) {
        return $res['paciente_id'];
    }
    if ($res['status'] !== 'disabled') {
        kinesica_rel_note_unlinked($source, $res['status'], $res['reason'], $hints);
    }
    return null;
}
