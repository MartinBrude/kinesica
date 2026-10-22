<?php
/**
 * Kinésica - Helpers del mail de confirmación/anulación de la turnera (api/send-confirmation.php).
 *
 * Textos: se leen del admin (admin/api/settings.json, el mismo archivo que sirve admin/api/settings.php):
 *   clara_texts.cancellation_policy  → "Política de cancelación"
 *   clara_texts.confirmation_notes   → "Notas de confirmación"
 * Si el campo está vacío o el archivo no se puede leer, se usan los textos actuales (fallback).
 */

const KINESICA_DEFAULT_CANCELLATION_POLICY = 'Te recordamos que los turnos pueden cancelarse o reprogramarse con un mínimo de 24 horas de anticipación 🙌.';

/** Reply-To por profesional (fallback). Orden: settings.json → practitioner_emails, admin/api/mail.php → reply_to_<id> / user_emails, esta constante. */
const KINESICA_PRACTITIONER_EMAILS = [
    'norberto' => 'norberto1712@gmail.com',
    'maria' => 'manosmagicas7116@gmail.com',
];

function kinesica_read_settings(string $file): array
{
    if (!is_file($file)) {
        return [];
    }
    $raw = @file_get_contents($file);
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Devuelve ['cancellation_policy' => string|'', 'confirmation_notes' => string|''].
 * confirmation_notes vacío ⇒ el mail usa la lista de indicaciones actual (fallback).
 */
function kinesica_mail_texts(array $settings): array
{
    $texts = isset($settings['clara_texts']) && is_array($settings['clara_texts']) ? $settings['clara_texts'] : [];
    $policy = trim((string) ($texts['cancellation_policy'] ?? ''));
    $notes = trim((string) ($texts['confirmation_notes'] ?? ''));
    return [
        'cancellation_policy' => $policy !== '' ? $policy : KINESICA_DEFAULT_CANCELLATION_POLICY,
        'confirmation_notes' => $notes,
    ];
}

/** Texto del admin → HTML seguro: escapa todo y respeta saltos de línea. */
function kinesica_text_to_html(string $text): string
{
    $text = str_replace(["\r\n", "\r"], "\n", trim($text));
    return nl2br(htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'), false);
}

/** 'norberto' | 'maria' | null a partir de un id o un nombre ("Lic. María Gulin"). Palabra completa. */
function kinesica_practitioner_id(?string $idOrName): ?string
{
    $v = (string) $idOrName;
    if (function_exists('iconv')) {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT', $v);
        if ($t !== false) {
            $v = $t;
        }
    }
    $v = strtolower($v);
    $v = preg_replace("/[^a-z0-9]+/", ' ', $v) ?? '';
    if (preg_match('/(^| )maria( |$)/', $v)) {
        return 'maria';
    }
    if (preg_match('/(^| )norberto( |$)/', $v)) {
        return 'norberto';
    }
    return null;
}

/** Email de Reply-To del profesional del turno (Norberto si no se puede determinar). */
function kinesica_reply_to_email(?string $practitionerId, ?string $profesionalName, array $settings = [], array $cfg = []): string
{
    $id = kinesica_practitioner_id($practitionerId) ?? kinesica_practitioner_id($profesionalName) ?? 'norberto';
    $map = KINESICA_PRACTITIONER_EMAILS;
    if (isset($settings['practitioner_emails']) && is_array($settings['practitioner_emails'])) {
        foreach ($settings['practitioner_emails'] as $k => $email) {
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $map[strtolower((string) $k)] = (string) $email;
            }
        }
    }
    if (isset($settings['practitioner_emails'][$id]) && filter_var($settings['practitioner_emails'][$id], FILTER_VALIDATE_EMAIL)) {
        return (string) $settings['practitioner_emails'][$id];
    }
    // Config del admin (admin/api/mail.php): reply_to_<id> o la cuenta del profesional en user_emails.
    foreach ([$cfg['reply_to_' . $id] ?? '', $cfg['user_emails'][$id] ?? ''] as $candidate) {
        if (filter_var((string) $candidate, FILTER_VALIDATE_EMAIL)) {
            return (string) $candidate;
        }
    }
    return $map[$id] ?? KINESICA_PRACTITIONER_EMAILS['norberto'];
}

/** Bloque "Información importante para tu sesión": notas del admin o la lista actual como fallback. */
function kinesica_guidelines_html(string $confirmationNotes, string $indicacionPuntualidad, string $indicacionAcompaniante, bool $esMenor): string
{
    if (trim($confirmationNotes) !== '') {
        $html = '<div class="guidelines-notes" style="color:#475569;font-size:14px;line-height:1.55;">' . kinesica_text_to_html($confirmationNotes) . '</div>';
        if ($esMenor) {
            $html .= '<ul class="guidelines-list" style="margin-top:10px;">'
                . '<li><strong>Puntualidad:</strong> ' . $indicacionPuntualidad . '</li>'
                . '<li><strong>Acompañantes:</strong> ' . $indicacionAcompaniante . '</li>'
                . '</ul>';
        }
        return $html;
    }
    return '<ul class="guidelines-list">'
        . '<li><strong>Puntualidad:</strong> ' . $indicacionPuntualidad . '</li>'
        . '<li><strong>Ropa adecuada:</strong> Concurrir con <em>ropa cómoda y flexible</em> (short o calza corta; si sos mujer, corpiño no deportivo) que permita evaluar la postura y la zona a tratar.</li>'
        . '<li><strong>Estudios previos:</strong> Traer estudios y derivación médica si los tuviese.</li>'
        . '<li><strong>Acompañantes:</strong> ' . $indicacionAcompaniante . '</li>'
        . '</ul>';
}
