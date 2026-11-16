# Gestión web de turnos (`/mi-turno`)

Los pacientes pueden **consultar o anular** un turno agendado por la turnera con:

1. Apellido del paciente  
2. Email de la reserva  
3. Código de gestión (7 caracteres) enviado en el mail de confirmación

No hay link en el home todavía; URL directa: `https://www.kinesica.com.ar/mi-turno` (también `/en/`, `/fr/`, `/pt/`).
El mail de confirmación incluye un deep-link `?apellido=&email=&codigo=` que precarga el formulario y busca el turno.

## Flujo

1. Reserva en `/agendar` → GAS crea el evento en Google Calendar.  
2. `api/send-confirmation.php` genera el código, guarda hash + email + apellido en `turnos`, y lo incluye en el mail.  
3. En `/mi-turno` el paciente busca (`POST /api/mi-turno.php` `action=lookup`) o anula (`action=cancel`).  
4. Cancelación (camino 2A):  
   - Valida triple + política 24 hs  
   - Llama a GAS `action=cancel` (borra/marca el evento en Calendar + aviso WhatsApp al profesional)  
   - Dispara webhook n8n opcional (`clara_web_cancel_webhook_url`) para lista de espera / Clara  
   - Marca sombra local `status=cancelled` y envía mail de anulación

## Deploy necesario

```bash
# 1) Migración DB (columnas manage_*)
php admin/api/migrate-self.php
# (o: php admin/api/migrate.php --token="$INSTALL_TOKEN")

# 2) Redeploy Apps Script (action=cancel)
npm run gas:deploy

# 3) (Opcional) en admin/api/config.php:
# 'clara_web_cancel_webhook_url' => 'https://n8n.kinesica.com.ar/webhook/web-cancel',
```

## Build

```bash
npm run build:mi-turno
```

## Notas

- Solo turnos con código (reservas web posteriores a este feature).  
- Dentro de 24 hs: la web no anula; deriva a WhatsApp Clara.  
- Página `noindex` (fuera del sitemap).  
