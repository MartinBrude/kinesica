<?php
declare(strict_types=1);

/**
 * Plantilla HTML/texto del digesto semanal (shell compartido con mails de confirmación si existe).
 */

$kinesicaDigestApi = dirname(__DIR__, 2) . '/api';
foreach (['confirmation-mail-templates.php', 'confirmation-mail-lib.php'] as $kinesicaDigestMailFile) {
    $path = $kinesicaDigestApi . '/' . $kinesicaDigestMailFile;
    if (is_file($path)) {
        require_once $path;
        break;
    }
}

/**
 * @return array{brand:string,site:string,logo:string}
 */
function kinesica_digest_brand(): array
{
    $brand = 'Kinésica';
    $site = 'https://www.kinesica.com.ar';
    $logo = $site . '/images/logo.png';
    if (function_exists('cfg')) {
        $admin = rtrim((string) (cfg()['admin_url'] ?? ''), '/');
        if ($admin !== '' && preg_match('#^https://#i', $admin)) {
            $root = preg_replace('#/admin$#', '', $admin) ?: $site;
            $site = $root;
            if (str_contains(strtolower($root), 'kinesica')) {
                $logo = $root . '/images/logo.png';
            } else {
                $brand = 'Consultorio';
                $logo = $admin . '/logo.png';
            }
        }
    }
    return ['brand' => $brand, 'site' => $site, 'logo' => $logo];
}

function kinesica_digest_document_shell(string $title, string $extraCss, string $contentHtml): string
{
    if (function_exists('kinesica_mail_document_shell')) {
        return kinesica_mail_document_shell($title, $extraCss, $contentHtml);
    }
    $b = kinesica_digest_brand();
    $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $host = preg_replace('#^https?://#i', '', $b['site']) ?? $b['site'];
    return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        . '<title>' . $h($title) . '</title><style>'
        . 'body{margin:0;padding:20px;background:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}'
        . '.wrapper{max-width:580px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e9f0}'
        . '.header{padding:30px 20px 20px;text-align:center;border-bottom:2px solid #005f99}'
        . '.logo{max-width:180px;height:auto;display:block;margin:0 auto}'
        . '.content{padding:30px 26px;color:#2c3e50;font-size:15px;line-height:1.6}'
        . '.greeting{font-size:18px;font-weight:600;color:#1a252f;margin:0 0 12px}'
        . '.lead-text{color:#556575;margin-bottom:22px}'
        . $extraCss
        . '.footer{text-align:center;padding:22px;font-size:12px;color:#8a99a8;background:#f8fafc;border-top:1px solid #edf2f7}'
        . '.footer a{color:#005f99;text-decoration:none;font-weight:500}'
        . '</style></head><body><div class="wrapper"><div class="header">'
        . '<img src="' . $h($b['logo']) . '" alt="' . $h($b['brand']) . '" class="logo"></div>'
        . '<div class="content">' . $contentHtml . '</div>'
        . '<div class="footer"><p style="margin:0 0 6px"><strong>' . $h($b['brand']) . '</strong></p>'
        . '<p style="margin:0"><a href="' . $h($b['site']) . '" target="_blank">' . $h($host) . '</a></p>'
        . '</div></div></body></html>';
}

/**
 * @param array{greeting:string,url:string,cta:string,panel:string,noun_one:string,noun_many:string} $channel
 * @param list<array{title:string,badge?:string,subtitle?:string}> $items
 * @return array{subject:string,html:string,text:string}
 */
function kinesica_digest_build_mail(array $channel, array $items, DateTimeImmutable $now): array
{
    $greeting = trim((string) ($channel['greeting'] ?? ''));
    $url = trim((string) ($channel['url'] ?? ''));
    $cta = trim((string) ($channel['cta'] ?? 'Abrir'));
    $panel = trim((string) ($channel['panel'] ?? 'panel'));
    $nounOne = trim((string) ($channel['noun_one'] ?? 'ítem'));
    $nounMany = trim((string) ($channel['noun_many'] ?? 'ítems'));

    if ($greeting === '' || $url === '' || !preg_match('#^https://#i', $url)) {
        throw new InvalidArgumentException('Canal de digesto inválido (greeting/url).');
    }

    $safe = [];
    foreach ($items as $item) {
        if (!is_array($item)) {
            continue;
        }
        $title = trim((string) ($item['title'] ?? ''));
        if ($title === '') {
            continue;
        }
        if (mb_strlen($title) > 200) {
            $title = mb_substr($title, 0, 197) . '…';
        }
        $row = ['title' => $title];
        $badge = trim((string) ($item['badge'] ?? ''));
        $sub = trim((string) ($item['subtitle'] ?? ''));
        if ($badge !== '') {
            $row['badge'] = mb_substr($badge, 0, 12);
        }
        if ($sub !== '') {
            $row['subtitle'] = mb_strlen($sub) > 80 ? mb_substr($sub, 0, 77) . '…' : $sub;
        }
        $safe[] = $row;
    }

    $count = count($safe);
    $fechaLegible = function_exists('kinesica_format_fecha_legible')
        ? kinesica_format_fecha_legible($now->format('Y-m-d'))
        : $now->format('Y-m-d');
    $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $brand = kinesica_digest_brand()['brand'];

    if ($count === 0) {
        $subject = ucfirst($nounMany) . ' de la semana · todo al día ✅';
        $lead = "Pasé a mirar {$panel} y, por ahora, no hay nada abierto. ¡Buen comienzo de semana!";
        $listHtml = '<p style="margin:0;color:#64748b;font-size:14px;">Cuando surja algo nuevo, lo vas a ver acá y en el panel.</p>';
        $listText = "(Sin {$nounMany} abiertos)\n";
    } else {
        $nLabel = $count === 1 ? "1 {$nounOne}" : "{$count} {$nounMany}";
        $subject = ucfirst($nounMany) . " de la semana · {$nLabel}";
        $lead = $count === 1
            ? "Te dejo el {$nounOne} abierto, por si querés ir resolviéndolo a tu ritmo."
            : "Te dejo los {$count} {$nounMany} abiertos, para que los tengas a mano al empezar la semana.";
        $rows = '';
        $listText = '';
        $i = 1;
        foreach ($safe as $item) {
            $badge = (string) ($item['badge'] ?? (string) $i);
            $title = (string) $item['title'];
            $sub = (string) ($item['subtitle'] ?? '');
            $subHtml = $sub !== ''
                ? '<div style="margin-top:4px;color:#64748b;font-size:13px;">' . $h($sub) . '</div>'
                : '';
            $rows .= '<tr><td style="padding:12px 14px;border-bottom:1px solid #e8eef4;vertical-align:top;width:36px;">'
                . '<span style="display:inline-block;min-width:26px;height:26px;line-height:26px;text-align:center;'
                . 'border-radius:8px;background:#e8f2f6;color:#005f99;font-size:13px;font-weight:700;">'
                . $h($badge) . '</span></td>'
                . '<td style="padding:12px 14px;border-bottom:1px solid #e8eef4;color:#1f2937;font-size:15px;line-height:1.45;">'
                . $h($title) . $subHtml . '</td></tr>';
            $listText .= $sub !== '' ? "{$badge}. {$title} ({$sub})\n" : "{$badge}. {$title}\n";
            $i++;
        }
        $listHtml = '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
            . 'style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">'
            . $rows . '</table>';
    }

    $extraCss = '.cta-wrap{text-align:center;margin:28px 0 8px 0}.cta-btn{display:inline-block;background:#005f99;color:#fff!important;'
        . 'text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px}'
        . '.cta-note{color:#64748b;font-size:13px;margin:10px 0 0;text-align:center}'
        . '.week-pill{display:inline-block;background:#e8f2f6;color:#005f99;font-size:12px;font-weight:700;'
        . 'letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:999px;margin-bottom:14px}';

    $content = '<p class="week-pill">' . $h($fechaLegible) . '</p>'
        . '<p class="greeting">Hola ' . $h($greeting) . ',</p>'
        . '<p class="lead-text">' . $h($lead) . '</p>' . $listHtml
        . '<div class="cta-wrap"><a class="cta-btn" href="' . $h($url) . '" target="_blank" rel="noopener">'
        . $h($cta) . '</a><p class="cta-note">Desde ahí podés marcar como resuelto lo que ya hayas cerrado.</p></div>'
        . '<p style="margin:22px 0 0;color:#556575;font-size:14px;line-height:1.55;">'
        . 'Si preferís dejar algo para más adelante, no hay apuro: la lista sigue ahí cuando la necesites.</p>'
        . '<p style="margin:18px 0 0;color:#1a252f;font-size:15px;">Un abrazo,<br><strong>' . $h($brand) . '</strong></p>';

    $html = kinesica_digest_document_shell($subject . ' · ' . $brand, $extraCss, $content);
    $text = "Hola {$greeting},\n\n{$lead}\n\n{$listText}\n{$cta}: {$url}\n"
        . "Desde ahí podés marcar como resuelto lo que corresponda.\n\nUn abrazo,\n{$brand}\n";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}
