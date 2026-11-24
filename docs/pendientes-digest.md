# Digesto semanal (Pendientes + Errores)

El **primer día hábil** de cada semana (lun–vie, feriados AR) Kinésica envía:

| Canal | Destinatario | Panel |
|-------|--------------|-------|
| `pendientes` | Norberto (`norberto1712@gmail.com`) | [/admin/pendientes](https://www.kinesica.com.ar/admin/pendientes) |
| `errores` | Martín (`martin.brude@gmail.com`) | [/admin/errores](https://www.kinesica.com.ar/admin/errores) |

- Ambos canales: **si no hay ítems abiertos, no se envía mail** (`skip_if_empty`).
- Primer envío Kinésica: **2026-11-25** (`digest_not_before`; ese día se permite aunque no sea el primer hábil). Después, solo el primer día hábil de cada semana.

Markers independientes: `admin/api/data/digest_{canal}_sent.json`.

## Arquitectura (≤250 líneas / archivo)

| Archivo | Rol |
|---------|-----|
| `lib_digest.php` | Fachada |
| `lib_digest_schedule.php` | Feriados + primer día hábil |
| `lib_digest_marker.php` | Anti-doble-envío |
| `lib_digest_mail.php` | HTML/texto Kinésica |
| `lib_digest_channels.php` | Canales + loaders |
| `lib_digest_run.php` | Motor send/skip/dry/preview |
| `cron_weekly_digest.php` | Entrypoint CLI |
| `cron_pendientes_digest.php` | Alias BC → `--channel=pendientes` |

## Cron Hostinger

```cron
0 12 * * 1-5  /usr/bin/php /home/u696348908/domains/kinesica.com.ar/public_html/admin/api/cron_weekly_digest.php
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
