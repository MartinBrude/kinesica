<?php
declare(strict_types=1);

/**
 * Vista derivada de interacciones: conversaciones = eventos agrupados por teléfono + día (zona del consultorio)
 * más el estado mutable (respondida / archivada) guardado aparte. Nada de esto borra eventos.
 */

require_once __DIR__ . '/lib_interacciones_store.php';

/** Ventana por defecto del panel (días locales del consultorio). */
const INTERACCIONES_DEFAULT_DAYS = 30;
/** Máximo pedible por query ?days= (evita tirar de todo el historial). */
const INTERACCIONES_MAX_DAYS = 90;
/** Tope de eventos crudos por request (los más recientes dentro de la ventana). */
const INTERACCIONES_MAX_EVENTS = 5000;

function interacciones_phone_format(string $digits): string
{
    $d = interacciones_clean_wa_id($digits);
    if ($d === '') {
        return 'Desconocido';
    }
    if (strncmp($d, '54911', 5) === 0 && strlen($d) === 13) {
        return '+54 9 11 ' . substr($d, 5, 4) . '-' . substr($d, 9);
    }
    if (strncmp($d, '549', 3) === 0 && strlen($d) >= 12) {
        return '+' . $d;
    }
    if (strncmp($d, '34', 2) === 0 && strlen($d) === 11) {
        return '+34 ' . substr($d, 2, 3) . ' ' . substr($d, 5, 2) . ' ' . substr($d, 7, 2) . ' ' . substr($d, 9);
    }
    return '+' . $d;
}

/** Números conocidos (dígitos exactos => nombre). Ampliable con cfg()['interacciones_known_numbers']. */
function interacciones_known_names(): array
{
    $known = ['34658444935' => 'Martín Brude'];
    if (function_exists('cfg')) {
        $extra = cfg()['interacciones_known_numbers'] ?? [];
        if (is_array($extra)) {
            foreach ($extra as $num => $name) {
                $digits = interacciones_clean_wa_id((string) $num);
                if ($digits !== '' && is_string($name) && $name !== '') {
                    $known[$digits] = $name;
                }
            }
        }
    }
    return $known;
}

function interacciones_known_name(string $waId): string
{
    $d = ltrim(interacciones_clean_wa_id($waId), '0');
    return interacciones_known_names()[$d] ?? '';
}

/** @return array{0:string,1:string} [category, label] */
function interacciones_classify(string $firstPatientBody, string $waId): array
{
    $lower = mb_strtolower($firstPatientBody, 'UTF-8');
    if (strpos($lower, 'osde') !== false || strpos($lower, 'obra social') !== false) {
        return ['cobertura', '💳 Cobertura OSDE / Prepaga'];
    }
    if (strpos($lower, 'precio') !== false || strpos($lower, 'honorario') !== false || $lower === 'c') {
        return ['honorarios', '💰 Honorarios y Aranceles'];
    }
    if (interacciones_known_name($waId) !== '') {
        return ['prueba_admin', '🧪 Prueba Técnica'];
    }
    return ['consulta_general', 'Consulta WhatsApp'];
}

function interacciones_iso(?string $utc): ?string
{
    return ($utc === null || $utc === '') ? null : str_replace(' ', 'T', $utc) . 'Z';
}

/**
 * Oculta (solo en la vista) eventos "gemelos": el mismo mensaje registrado por una fuente sin id de WhatsApp
 * y por otra con id. Empareja 1 a 1; nada se borra.
 *
 * @param list<array> $events
 * @return array<int,true> ids de eventos ocultos
 */
function interacciones_hidden_twins(array $events): array
{
    $hidden = [];
    foreach ($events as $a) {
        if (strncmp($a['event_key'], 'wa:', 3) !== 0) {
            continue;
        }
        $bestId = null;
        $bestDiff = 181;
        foreach ($events as $b) {
            if (isset($hidden[$b['id']]) || strncmp($b['event_key'], 'wa:', 3) === 0) {
                continue;
            }
            if ($b['direction'] !== $a['direction'] || $b['body'] !== $a['body']) {
                continue;
            }
            $diff = abs($b['ts'] - $a['ts']);
            if ($diff < $bestDiff) {
                $bestDiff = $diff;
                $bestId = $b['id'];
            }
        }
        if ($bestId !== null) {
            $hidden[$bestId] = true;
        }
    }
    return $hidden;
}

/**
 * Vista de conversaciones. $days = null deja el historial completo (tests / dump);
 * con entero aplica ventana acotada al inicio del día local (consultorio).
 *
 * @return array{items:list<array>,answered_count:int,unanswered_count:int,archived_count:int,grouped:array,days:?int,since_utc:?string,events_capped:bool}
 */
function interacciones_load_view(?PDO $pdo = null, ?int $days = null): array
{
    $pdo = interacciones_pdo($pdo);
    interacciones_ensure_schema($pdo);
    $tz = interacciones_tz();
    $sinceUtc = null;
    $daysOut = null;
    if ($days !== null) {
        $daysOut = max(1, min(INTERACCIONES_MAX_DAYS, $days));
        // Inicio del día local hace (N-1) días → N días calendario completos, sin partir conversaciones.
        $sinceLocal = (new DateTimeImmutable('today', $tz))->modify('-' . ($daysOut - 1) . ' days');
        $sinceUtc = $sinceLocal->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    // Más recientes primero + tope; luego se reordenan ASC para armar el hilo.
    $sql = 'SELECT id, event_key, wa_id, direction, body, ts_utc, patient_name FROM interaccion_eventos';
    $params = [];
    if ($sinceUtc !== null) {
        $sql .= ' WHERE ts_utc >= :since';
        $params['since'] = $sinceUtc;
    }
    $sql .= ' ORDER BY ts_utc DESC, id DESC LIMIT ' . (int) INTERACCIONES_MAX_EVENTS;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $eventsCapped = count($rows) >= INTERACCIONES_MAX_EVENTS;
    $rows = array_reverse($rows);

    $convs = [];
    foreach ($rows as $row) {
        $ts = (new DateTimeImmutable((string) $row['ts_utc'], new DateTimeZone('UTC')))->getTimestamp();
        $local = (new DateTimeImmutable('@' . $ts))->setTimezone($tz);
        $key = $row['wa_id'] . '_' . $local->format('Y-m-d');
        $convs[$key]['wa_id'] = $row['wa_id'];
        $convs[$key]['date'] = $local->format('Y-m-d');
        $convs[$key]['events'][] = [
            'id' => (int) $row['id'], 'event_key' => (string) $row['event_key'], 'direction' => (string) $row['direction'],
            'body' => (string) $row['body'], 'ts' => $ts, 'name' => (string) $row['patient_name'],
        ];
    }

    $estado = [];
    foreach ($pdo->query('SELECT * FROM interaccion_estado') as $st) {
        $estado[(string) $st['conversation_key']] = $st;
    }

    $items = [];
    $counts = ['answered' => 0, 'unanswered' => 0, 'archived' => 0];
    foreach ($convs as $key => $c) {
        $hidden = interacciones_hidden_twins($c['events']);
        $messages = [];
        $firstPatient = '';
        $lastName = '';
        $lastTs = 0;
        foreach ($c['events'] as $ev) {
            if (isset($hidden[$ev['id']])) {
                continue;
            }
            $messages[] = [
                'from' => $ev['direction'],
                'time' => (new DateTimeImmutable('@' . $ev['ts']))->setTimezone($tz)->format('H:i'),
                'text' => $ev['body'],
                'ts' => gmdate('Y-m-d\TH:i:s\Z', $ev['ts']),
            ];
            if ($firstPatient === '' && $ev['direction'] === 'patient') {
                $firstPatient = $ev['body'];
            }
            if ($ev['name'] !== '') {
                $lastName = $ev['name'];
            }
            $lastTs = max($lastTs, $ev['ts']);
        }
        $st = $estado[$key] ?? [];
        [$cat, $catLabel] = interacciones_classify($firstPatient, (string) $c['wa_id']);
        $name = interacciones_known_name((string) $c['wa_id']);
        if ($name === '') {
            $name = (string) (($st['patient_name'] ?? '') !== '' ? $st['patient_name'] : $lastName);
        }
        $archived = !empty($st['archived']);
        $answered = !empty($st['answered']);
        $counts[$archived ? 'archived' : ($answered ? 'answered' : 'unanswered')]++;
        $items[] = [
            'id' => $key,
            'wa_id' => $c['wa_id'],
            'phone_formatted' => interacciones_phone_format((string) $c['wa_id']),
            'patient_name' => $name,
            'date' => $c['date'],
            'time' => (new DateTimeImmutable('@' . $lastTs))->setTimezone($tz)->format('H:i'),
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z', $lastTs),
            'answered' => $answered,
            'answered_at' => interacciones_iso($st['answered_at'] ?? null),
            'archived' => $archived,
            'archived_at' => interacciones_iso($st['archived_at'] ?? null),
            'category' => (string) (($st['category'] ?? '') !== '' ? $st['category'] : $cat),
            'category_label' => (string) (($st['category_label'] ?? '') !== '' ? $st['category_label'] : $catLabel),
            'summary' => (string) (($st['summary'] ?? '') !== '' ? $st['summary'] : mb_substr($firstPatient, 0, 120, 'UTF-8')),
            'messages' => $messages,
        ];
    }
    usort($items, static fn(array $a, array $b): int => strcmp($b['timestamp'], $a['timestamp']));
    $grouped = [];
    foreach ($items as $it) {
        $grouped[$it['date']][] = $it;
    }
    return [
        'items' => $items,
        'answered_count' => $counts['answered'],
        'unanswered_count' => $counts['unanswered'],
        'archived_count' => $counts['archived'],
        'grouped' => $grouped,
        'days' => $daysOut,
        'since_utc' => $sinceUtc,
        'events_capped' => $eventsCapped,
    ];
}

/**
 * Cambia el estado de una conversación (archive|unarchive|toggle_answered). Solo toca flags: nunca eventos.
 * Acepta la clave nueva o un id legado (exec_NNN) de una pestaña abierta antes de la migración.
 */
/** Estado de salud para mostrar en la vista (no expone contenido). */
