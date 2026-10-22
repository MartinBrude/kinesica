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

/**
 * Formato estilo WhatsApp de los textos del admin.
 * Pares *x* → negrita y _x_ → cursiva sólo en límites de palabra (no toca foo_bar@x.com ni URLs);
 * "* " / "- " al inicio de línea → "• "; marcadores sueltos se eliminan.
 * Devuelve el texto con marcas internas \x01b…\x02 / \x01i…\x02 y los emails/URLs protegidos.
 */
function kinesica_wa_markup(string $text, array &$protected): string
{
    $text = str_replace(["\r\n", "\r"], "\n", trim($text));
    $protected = [];
    // Emails y URLs: se protegen tal cual.
    $text = preg_replace_callback('~\b(?:https?://|www\.)[^\s<>"]+|[\p{L}\p{N}._%+\-]+@[\p{L}\p{N}.\-]+\.[\p{L}]{2,}~u', function ($m) use (&$protected) {
        $protected[] = $m[0];
        return "\x03" . (count($protected) - 1) . "\x03";
    }, $text) ?? $text;
    // Viñetas al inicio de línea.
    $text = preg_replace('/^[ \t]*[*\-•][ \t]+/mu', '• ', $text) ?? $text;
    // Pares en límite de palabra, contenido sin espacios en los bordes y en una sola línea.
    $text = preg_replace('/(?<![\p{L}\p{N}*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/u', "\x01b$1\x02", $text) ?? $text;
    $text = preg_replace('/(?<![\p{L}\p{N}_])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\p{L}\p{N}_])/u', "\x01i$1\x02", $text) ?? $text;
    // Marcadores sueltos: todo * restante; _ salvo entre letras/números (snake_case).
    $text = str_replace('*', '', $text);
    $text = preg_replace('/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/u', '', $text) ?? $text;
    $text = preg_replace('/[ \t]{2,}/', ' ', $text) ?? $text;
    return trim(preg_replace('/[ \t]+$/m', '', $text) ?? $text);
}

function kinesica_restore_protected(string $text, array $protected, bool $html): string
{
    return preg_replace_callback('/\x03(\d+)\x03/', function ($m) use ($protected, $html) {
        $v = $protected[(int) $m[1]] ?? '';
        return $html ? htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') : $v;
    }, $text) ?? $text;
}

/** Texto del admin → HTML seguro: escapa todo, *x*→<strong>, _x_→<em>, respeta saltos de línea. */
function kinesica_text_to_html(string $text): string
{
    $protected = [];
    $marked = kinesica_wa_markup($text, $protected);
    $html = htmlspecialchars($marked, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $html = preg_replace_callback('/\x01([bi])(.*?)\x02/s', fn ($m) => $m[1] === 'b' ? "<strong>{$m[2]}</strong>" : "<em>{$m[2]}</em>", $html) ?? $html;
    $html = str_replace(["\x01", "\x02"], '', $html);
    return nl2br(kinesica_restore_protected($html, $protected, true), false);
}

/** Texto del admin → texto plano: sin marcadores de WhatsApp. */
function kinesica_text_to_plain(string $text): string
{
    $protected = [];
    $marked = preg_replace('/\x01[bi]/', '', kinesica_wa_markup($text, $protected)) ?? '';
    return kinesica_restore_protected(str_replace(["\x01", "\x02"], '', $marked), $protected, false);
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
