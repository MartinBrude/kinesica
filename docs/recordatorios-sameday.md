# Recordatorios: día previo + catch-up mismo día

Objetivo: **un solo recordatorio por turno** (`calendar_event_id`). Si el día previo no alcanzó a enviar, el catch-up del mismo día lo cubre.

## Horarios (America/Argentina/Buenos_Aires)

| Corrida | Cuándo | Qué mira | Copy |
|---------|--------|----------|------|
| n8n 24h | Lun–Jue 10:00, Dom 18:00 | Turnos de **mañana** | «mañana a las …» |
| PHP catch-up | Lun–Vie 08:00 | Turnos de **hoy** sin `sent`/`sent_email` | «hoy a las …» |

No se usan 16:00 ni 23:00.

## Cron Hostinger (catch-up)

```text
0 11 * * 1-5  /usr/bin/php /home/u696348908/domains/kinesica.com.ar/public_html/admin/api/cron_recordatorios_sameday.php
```

(08:00 AR ≈ 11:00 UTC). Dry-run: añadir `--dry-run`.

Código: [`admin/api/cron_recordatorios_sameday.php`](../admin/api/cron_recordatorios_sameday.php), lógica en [`admin/api/lib_recordatorios_sameday.php`](../admin/api/lib_recordatorios_sameday.php).

## Plantilla Meta (obligatorio para WA same-day)

Plantilla actual `recordatorio_turno_kinesica` dice *«programada para mañana a las {{3}}»* → `{{3}}` es solo la hora.

Para soportar hoy/mañana con un solo template:

1. En Meta Business, editar/crear versión del cuerpo a:
   > … tu {{2}} programada para {{3}}.
2. `{{3}}` pasa a ser la frase completa, p. ej. `mañana a las 16:00 hs` o `hoy a las 16:00 hs`.
3. En `admin/api/config.php` (producción):

```php
'reminder_template_when_mode' => 'when_phrase',
```

4. En n8n (`kinesica-bot/workflow_recordatorios.json`), `formatted_time` / `{{3}}` es la frase completa `mañana a las HH:MM hs`. El catch-up PHP manda `hoy a las HH:MM hs`.

Default de código: `reminder_template_when_mode=when_phrase` (override a `legacy` solo si hace falta rollback).

## Dedupe

- Éxito previo para el mismo `calendar_event_id` (`sent` / `sent_email`) → skip `already_sent`.
- Margen &lt; 60 min al inicio → skip `too_soon`.
- Turno ya pasado → skip `past_appointment`.
- Sigue valiendo el tope de 1 envío por persona y día en el disparo manual.

## Checklist de puesta en marcha

1. Deploy del código PHP + docs.
2. Crear cron Hostinger (arriba).
3. Reaprobar plantilla Meta y setear `reminder_template_when_mode=when_phrase`.
4. Actualizar n8n día previo al nuevo `{{3}}`.
5. Probar `--dry-run` un día hábil a la mañana; luego un caso real con turno de tarde creado el mismo día.
