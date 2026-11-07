# 🌿 Kinésica — Módulo de Reserva de Turnos y Google Calendar

Este módulo implementa el sistema de reservas web conectado a **Google Calendar** y a la base de datos de pacientes de Kinésica, cumpliendo rigurosamente con las especificaciones y reglas clínicas de **`kinesica-bot`**.

---

## 📌 1. Reglas de Negocio Implementadas

1. **Solo turnos presenciales de 1 hora.** Ya no se agendan llamadas de orientación.
2. **Técnica y profesional:**
   - Osteopatía: Norberto.
   - Acupuntura y posturología: María.
   - RPG, neurodinamia y manipulaciones viscerales (método Barral): ambos.
   - Los horarios de cada uno viven en `PRACTITIONER_HOURS` (`booking-engine.js`). Mientras estén en `null`, se ofrece lun–vie 08:00–19:30.
3. **Franja Horaria y Días de Atención:**
   - Lunes a viernes hábiles entre las **08:00 y las 19:30 hs** (zona horaria `America/Argentina/Buenos_Aires`).
   - Sábados, domingos y feriados nacionales de Argentina están **bloqueados determinísticamente** (0 slots).
4. **Anti-Colisión Determinista (Unicidad del Profesional):**
   - El profesional atiende de forma individual: una llamada de 10 min no colisiona con un turno de 60 min, ni con citas previas ni con bloqueos administrativos (`🚫 [BLOQUEADO]`).
5. **Margen de Anticipación y Traslado (Same-Day Buffer):**
   - **Llamadas telefónicas de orientación (10 min):** Para reservas en el mismo día, se excluyen horarios dentro de la **siguiente hora** (mínimo 1 hora de anticipación).
   - **Turnos presenciales (60 min):** Para reservas en el mismo día, se excluyen horarios con menos de **2 horas de anticipación** para permitir el viaje al consultorio.
6. **Privacidad de Ubicación y Normas del Consultorio:**
   - La dirección exacta (**Charcas 3889, Piso 5º B, Palermo, entre Scalabrini Ortiz y Aráoz**) y las indicaciones (*llegar a la hora de la sesión ni antes ni después por características del espacio, sin acompañantes, traer estudios previos*) solo se muestran al confirmar un **Turno Presencial**.

---

## 🚀 2. Cómo Probarlo en Local Ahora Mismo

Se incluye un **Modo Mock Integrado** para probar toda la interfaz y flujos sin necesidad de configurar claves previas:

1. Ejecutá el servidor local de prueba:
   ```bash
   npm run booking:serve
   ```
2. Abrí en tu navegador:
   ```
   http://localhost:3000/booking/
   ```
3. Podés probar:
   - **Caso 1 (Primera vez):** Dejar "Es mi primera vez" -> verificar que solo ofrece llamadas de 10 min y explica el motivo.
   - **Caso 2 (Habitual):** Seleccionar "Ya soy paciente" -> verificar que habilita turno presencial de 1 hora.
   - **Caso 3 (Anti-solapamiento):** Confirmar una reserva y volver a consultar esa misma fecha; el horario ya no aparecerá disponible.

---

## 🧪 3. Tests Automatizados

Para correr la suite de verificación de reglas de negocio:

```bash
npm run booking:test
```

Valida:
- [x] Bloqueo de turnos directos a pacientes de primera vez.
- [x] Habilitación de sesiones a pacientes habituales.
- [x] Exclusión de fines de semana y feriados nacionales.
- [x] Límites de la franja horaria (08:00 a 19:30 hs).
- [x] No-solapamiento entre llamadas y sesiones de 1 hora.
- [x] Buffer de 2 horas para turnos en el día.
- [x] Formato canónico de títulos y descripciones de Google Calendar.

---

## 🌐 4. Conexión con tu Google Calendar Real (Producción)

El archivo [`google-apps-script.js`](./google-apps-script.js) es el backend serverless (Calendar + Sheets). El deploy a [script.google.com](https://script.google.com/) se hace con **clasp** (no hace falta copiar/pegar).

### Deploy automático (recomendado)

Primera vez (una sola):

```bash
npm install
npm run gas:login    # una vez (cuenta con acceso al proyecto)
npm run gas:deploy   # push + actualiza la web app
```

Proyecto: [Apps Script turnera](https://script.google.com/home/projects/1oDT31aCTKOB35n1kS-iKzVHUn0ILDz8ZlRPwLEyvnnMsOTyZ5AYVebIm/edit) (`booking/gas/.clasp.json`).

Cada cambio después:

```bash
# editás booking/google-apps-script.js
npm run gas:deploy
```

Eso hace `clasp push` y **actualiza la implementación existente** (misma URL `/exec` de `bookingApiUrl`). **No** uses «Nueva implementación» en la UI ni `clasp create-deployment` sin `-i`: generarían otra URL.

Otros comandos: `npm run gas:push` (solo sube HEAD), `npm run gas:deployments` (lista IDs).

Override opcionales: `GAS_BOOKING_SCRIPT_ID`, `GAS_BOOKING_DEPLOYMENT_ID`, `GAS_DEPLOY_DESCRIPTION`.

> El proyecto del webhook de Sheets/Clara es **otro** scriptId. No lo mezcles con el de la turnera.

### Propiedades del script (una vez, en la consola de GAS)

En **Configuración del proyecto** → **Propiedades de la secuencia de comandos**:

- `CALENDAR_NAME`: `consultorio`
- `SPREADSHEET_ID`: `1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk`
- `WHATSAPP_TOKEN`: Token Bearer de Meta WhatsApp Cloud API (alerta inmediata a Norberto).
- `NORBERTO_PHONE`: `541161564311` (opcional).
- `NORBERTO_EMAIL`: `norberto1712@gmail.com` (opcional).
- `MARIA_PHONE`: `541128531224` (opcional).
- `MARIA_EMAIL`: `manosmagicas7116@gmail.com` (opcional).
- `WHATSAPP_PHONE_NUMBER_ID`: `1340013275870491` (opcional).
- `N8N_ALERT_WEBHOOK_URL`: (opcional) webhook n8n.
- `GAS_API_SECRET` / `WEBHOOK_SECRET`: alineado con el admin (mirror de turnos / backup).

Las propiedades **no** se pisan con `gas:deploy`.

### Primera implementación manual (solo si el proyecto aún no tiene web app)

1. Implementar → **Nueva implementación** → Tipo: **Aplicación web**
2. Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier persona**
3. Copiá la URL `/exec` a `js/site-config.js` (`bookingApiUrl`) y a `GAS_BOOKING_DEPLOYMENT_ID` si cambió.
4. A partir de ahí, solo `npm run gas:deploy`.

### Protección ante cortes o doble clic

El flujo de **Confirmar reserva** genera una clave idempotente por intento. Google Apps Script la guarda junto con el resultado y reutiliza el mismo `eventId` si el navegador reintenta después de un timeout. Además, `LockService` comprueba la disponibilidad y crea el evento como una única operación lógica, evitando dos reservas simultáneas del mismo horario.

---

## 🧩 5. Cómo Embeber el Widget en Cualquier Página

Para agregar el widget a [`index.html`](../index.html) o a una sección de la web:

```html
<!-- 1. Estilos en el <head> -->
<link rel="stylesheet" href="/booking/booking-widget.css">

<!-- 2. Contenedor donde se dibuja el formulario -->
<div id="kinesica-booking-widget"></div>

<!-- 3. Scripts antes de cerrar el <body> -->
<script src="/booking/booking-engine.js"></script>
<script src="/booking/booking-api-client.js"></script>
<script src="/booking/booking-widget.js"></script>
<script>
  new KinesicaBookingWidget("kinesica-booking-widget", {
    apiUrl: "URL_DE_TU_GOOGLE_APPS_SCRIPT_WEBHOOK"
  });
</script>
```
