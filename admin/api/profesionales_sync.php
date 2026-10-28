<?php
declare(strict_types=1);

require_once __DIR__ . '/settings.php';

function sync_settings_practitioner(string $username, string $email, string $phone, bool $active = true): void
{
    try {
        kinesica_update_settings(function (array $raw) use ($username, $email, $phone, $active): array {
            if ($username !== '' && $username !== 'martin') {
                if (!isset($raw['practitioner_emails']) || !is_array($raw['practitioner_emails'])) {
                    $raw['practitioner_emails'] = [];
                }
                if ($active && $email !== '') {
                    $raw['practitioner_emails'][$username] = $email;
                } else {
                    unset($raw['practitioner_emails'][$username]);
                }

                if (!isset($raw['practitioner_phones']) || !is_array($raw['practitioner_phones'])) {
                    $raw['practitioner_phones'] = [];
                }
                if ($active && $phone !== '') {
                    $raw['practitioner_phones'][$username] = $phone;
                } else {
                    unset($raw['practitioner_phones'][$username]);
                }
            }

            try {
                $stmt = db()->query(
                    'SELECT username, display_name, first_name, last_name, email, telefono, active 
                     FROM users 
                     WHERE username != "martin" AND active = 1 
                     ORDER BY (username = "norberto") DESC, (username = "maria") DESC, display_name ASC'
                );
                $activeProfs = $stmt->fetchAll();
                if ($activeProfs) {
                    foreach ($activeProfs as $p) {
                        $u = (string) ($p['username'] ?? '');
                        $em = trim((string) ($p['email'] ?? ''));
                        $ph = trim((string) ($p['telefono'] ?? ''));
                        if ($u !== '' && $em !== '') $raw['practitioner_emails'][$u] = $em;
                        if ($u !== '' && $ph !== '') $raw['practitioner_phones'][$u] = $ph;
                    }

                    $names = array_map(static function ($p) {
                        $n = trim((string) ($p['display_name'] ?: ($p['first_name'] . ' ' . $p['last_name'])));
                        return (stripos($n, 'Lic.') === false ? 'Lic. ' : '') . $n;
                    }, $activeProfs);

                    $namesJoined = implode(' / ', $names);

                    if (isset($raw['clara_texts']['menu_welcome'])) {
                        $raw['clara_texts']['menu_welcome'] = preg_replace(
                            '/\*E\.\*\s*💬\s*Comunicarte con un profesional[^\n]*/u',
                            "*E.* 💬 Comunicarte con un profesional ({$namesJoined})",
                            $raw['clara_texts']['menu_welcome']
                        );
                    }

                    if (isset($raw['clara_texts']['opt_e_text'])) {
                        $optLines = [
                            "💬 *Contacto con un Profesional*\n",
                            "¿Con quién te gustaría comunicarte?",
                        ];
                        $idx = 1;
                        foreach ($names as $proName) {
                            $optLines[] = "*{$idx}.* {$proName}";
                            $idx++;
                        }
                        $optLines[] = "*{$idx}.* Indistinto / Primera consulta general\n";
                        $optLines[] = "_(Respondé indicando la opción deseada o escribí tu consulta directamente y se la transmitimos)_";
                        $optLines[] = "_Escribí *MENU* para volver_";
                        $raw['clara_texts']['opt_e_text'] = implode("\n", $optLines);
                    }
                }
            } catch (Throwable $t) {}

            return $raw;
        });
    } catch (Throwable $e) {
        error_log('Error syncing practitioner to settings: ' . $e->getMessage());
    }
}
