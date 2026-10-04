# 🌿 Kinésica — Módulo de Reserva de Turnos y Google Calendar

Este módulo implementa el sistema de reservas web conectado a **Google Calendar** y a la base de datos de pacientes de Kinésica, cumpliendo rigurosamente con las especificaciones y reglas clínicas de **`kinesica-bot`**.

---

## 📌 1. Reglas de Negocio Implementadas

1. **Regla de Primera Vez (Llamada Obligatoria):**
   - Los pacientes nuevos **NO pueden agendar turno presencial directo**.
   - Se les asigna de forma obligatoria una **Llamada telefónica de orientación de 10 minutos** (`📞 [LLAMADA 10m] Nombre`), explicando con calidez que el kinesiólogo evalúa el caso clínico e informa los honorarios correspondientes antes de concurrir.
2. **Pacientes Habituales:**
   - Pueden elegir entre **Turno Presencial en Consultorio de 1 hora** (`🩺 [TURNO] Nombre`) o llamada telefónica de 10 min.
3. **Franja Horaria y Días de Atención:**
   - Lunes a viernes hábiles entre las **08:00 y las 19:00 hs** (zona horaria `America/Argentina/Buenos_Aires`).
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
- [x] Límites de la franja horaria (08:00 a 19:00 hs).
- [x] No-solapamiento entre llamadas y sesiones de 1 hora.
- [x] Buffer de 2 horas para turnos en el día.
- [x] Formato canónico de títulos y descripciones de Google Calendar.

---

## 🌐 4. Conexión con tu Google Calendar Real (Producción)

El archivo [`google-apps-script.js`](file:///Users/martinbrude/Documents/kinesica/booking/google-apps-script.js) contiene el backend serverless listo para Google Workspace:

1. Abrí [script.google.com](https://script.google.com/) y creá un nuevo proyecto (o abrilo dentro del proyecto de `kinesica-bot`).
2. Copiá el contenido de [`booking/google-apps-script.js`](file:///Users/martinbrude/Documents/kinesica/booking/google-apps-script.js).
3. En **Configuración del proyecto** → **Propiedades de la secuencia de comandos**:
   - `CALENDAR_NAME`: `consultorio`
   - `SPREADSHEET_ID`: `1kyGkYea0Iu_OrXxF-yONqhs2rG1O8YUWbbSmQe37GCk`
4. Hacé clic en **Implementar** → **Nueva implementación** → Tipo: **Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
5. Copiá la URL del Webhook generada y agregala en tu configuración o en el selector del prototipo. ¡Listo! El módulo leerá y escribirá directamente en el Google Calendar `consultorio`.

---

## 🧩 5. Cómo Embeber el Widget en Cualquier Página

Para agregar el widget a [`index.html`](file:///Users/martinbrude/Documents/kinesica/index.html) o a una sección de la web:

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
