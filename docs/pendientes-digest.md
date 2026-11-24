# Digesto semanal (Pendientes + Errores)

El **primer día hábil** de cada semana (lun–vie, feriados AR) Kinésica envía:

| Canal | Destinatario | Panel |
|-------|--------------|-------|
| `pendientes` | `NORBERTO_EMAIL` o `user_emails.norberto` | [/admin/pendientes](https://www.kinesica.com.ar/admin/pendientes) |
| `errores` | `MARTIN_EMAIL` o `user_emails.martin` | [/admin/errores](https://www.kinesica.com.ar/admin/errores) |

Sin email en env/cfg el canal falla cerrado (`config_error`); no hay fallback hardcodeado.

- Ambos canales: **si no hay ítems abiertos, no se envía mail** (`skip_if_empty`).
- Primer envío Kinésica: **2026-11-25** (`digest_not_before`). Ese día (y los hábiles restantes de esa semana ISO si aún no se marcó enviado) permiten el envío aunque no sea el primer hábil. Después, solo el primer día hábil de cada semana.

Markers independientes: `admin/api/data/digest_{canal}_sent.json` (escritura atómica + lock de envío).

## Arquitectura (≤250 líneas / archivo)

| Archivo | Rol |
|---------|-----|
| `lib_digest.php` | Fachada |
| `lib_digest_schedule.php` | Días hábiles + ventana inaugural (feriados vía `lib_argentina_holidays.php`) |
| `lib_argentina_holidays.php` | Feriados AR (sync: `npm run holidays:sync`) |
| `lib_digest_marker.php` | Anti-doble-envío (lock + atomic) |
| `lib_digest_mail.php` | HTML/texto Kinésica |
| `lib_digest_channels.php` | Canales + loaders |
| `lib_digest_run.php` | Motor send/skip/dry/preview |
| `cron_weekly_digest.php` | Entrypoint CLI |
| `cron_pendientes_digest.php` | Alias BC → `--channel=pendientes` |

## Cron Hostinger

```cron
0 12 * * 1-5  /usr/bin/php /home/<USER>/domains/kinesica.com.ar/public_html/admin/api/cron_weekly_digest.php
```

(09:00 AR = 12:00 UTC.)

## Flags

```bash
php admin/api/cron_weekly_digest.php --dry-run
php admin/api/cron_weekly_digest.php --preview --channel=errores
php admin/api/cron_weekly_digest.php --force --channel=pendientes
```

## Tests

```bash
php scripts/verify-weekly-digest.php
```
