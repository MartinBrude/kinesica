# Cómo agendar turnos correctamente

Guía breve para que los turnos queden bien en el calendario **consultorio**, con recordatorios y datos de contacto legibles por el sistema.

Podés agendar de tres formas:

1. **Desde Admin** — recomendado para agendar desde el consultorio y reutilizar el directorio de pacientes.
2. **Función Agendar del sitio** (`kinesica.com.ar/agendar.html`) — completa título y descripción sola.
3. **Google Calendar a mano** — seguí el formato de abajo.

---

## 1. Agendar desde Admin

Entrá a `/admin`, abrí la tarjeta **Agendar turnos** y elegí **Abrir turnera profesional**. El flujo tiene dos pasos: seleccionar el paciente y elegir un horario.

### Paciente ya registrado

1. En **¿A quién le agendamos?**, buscá por nombre, teléfono o DNI.
2. Elegí el resultado correcto de la lista.
3. Verificá el nombre y el teléfono que aparecen en la tarjeta verde **Paciente encontrado**.

<p align="center">
  <img src="assets/admin-agendar-buscar-paciente.svg" alt="Admin: buscar y seleccionar un paciente del directorio" width="760">
  <br>
  <em>Figura 1: búsqueda de un paciente existente desde la turnera de Admin.</em>
</p>

Cuando el paciente ya fue encontrado, **alcanza con seleccionarlo**: no hace falta completar mail, documento ni teléfono nuevamente. Los datos disponibles del directorio se reutilizan automáticamente.

Después elegí la técnica y, si corresponde, el profesional. Para pacientes habituales con profesional habitual configurado, Admin lo preselecciona.

<p align="center">
  <img src="assets/admin-agendar-paciente-seleccionado.svg" alt="Admin: paciente seleccionado y elección de técnica" width="760">
  <br>
  <em>Figura 2: paciente confirmado; solo resta elegir la técnica y continuar.</em>
</p>

### Paciente de primera vez

Si no aparece en la búsqueda, usá **+ Paciente de primera vez**. En ese caso sí completá los datos disponibles del paciente, especialmente nombre y teléfono; mail y documento pueden quedar vacíos si todavía no los tenés.

### Elegir y confirmar el horario

1. Tocá **Ver horarios disponibles** o **Confirmar turno**, según el paso mostrado.
2. Seleccioná un día y un horario libre.
3. Revisá el resumen y confirmá.

<p align="center">
  <img src="assets/admin-agendar-horario.svg" alt="Admin: selección de día y horario disponible" width="760">
  <br>
  <em>Figura 3: selección del horario disponible para el paciente.</em>
</p>

El turno queda registrado en el calendario **consultorio**. Si el paciente tiene mail cargado, el sistema intenta enviarle la confirmación; si no tiene, la reserva igualmente se registra desde Admin.

> **Importante:** antes de confirmar, verificá que el paciente seleccionado sea el correcto y que la técnica/profesional coincidan con lo solicitado.

---

## 2. Función Agendar (sitio web)

Entrá a **Agendar**, indicá si el paciente ya se atendió (Sí / No) y seguí los pasos: día, horario y datos.

<p align="center">
  <img src="assets/mockup_agendar_web.png" alt="Pantalla Agendar del sitio Kinésica" width="640">
  <br>
  <em>Figura 4: Inicio del formulario Agendar en el sitio.</em>
</p>

Al confirmar, el turno se crea en el calendario **consultorio** con WhatsApp y DNI ya etiquetados. Es la opción más segura.

---

## 3. Google Calendar a mano

Si cargás el evento vos:

### Título

- Poné el **nombre y apellido** del paciente.
- Recomendado: `[NORBERTO]` o `[MARÍA]` delante del nombre.
- El emoji al inicio es **opcional** (no hace falta).

Ejemplos válidos:

```text
[NORBERTO] Ana Pérez
[MARÍA] Juan Gómez
Ana Pérez
[NORBERTO] [MENOR] Sofía López (Familiar: Carla López)
[MARÍA] Pedro Ruiz (Agendó: Laura Ruiz)
```

### Descripción (lo imprescindible)

Usá etiquetas claras. **Lo que no puede faltar:**

```text
WhatsApp: 11 5555-6666
DNI: 30111222
```

También sirve con emoji o en una sola línea separada por `|`:

```text
📱 WhatsApp: 5491155556666 | 🪪 DNI: 30111222
```

- Profesional y especialidad en la descripción **no son requisitos**.
- No pongas el DNI en el campo de teléfono.
- No dejes solo el DNI sin WhatsApp si el paciente es nuevo o no está en el directorio.

### Calendario y duración

- Calendario destino: **consultorio** (no el calendario personal).
- Duración: **1 hora** exacta.

<p align="center">
  <img src="assets/mockup_google_calendar_correcto.jpg" alt="Ejemplo de turno en Google Calendar con WhatsApp y DNI" width="720">
  <br>
  <em>Figura 5: Ejemplo en Calendar. El emoji del título es opcional; WhatsApp y DNI van en la descripción.</em>
</p>

---

## 4. Resumen: qué sí y qué no

<p align="center">
  <img src="assets/comparativa_agendamiento_dos_donts.jpg" alt="Comparativa de buenas y malas prácticas al agendar" width="760">
  <br>
  <em>Figura 6: Comparativa rápida de buenas prácticas.</em>
</p>

| Sí | No |
|----|----|
| Calendario **consultorio** | Calendario personal |
| Título con **nombre** del paciente | Título vago: “Turno”, “Consulta”, “RPG” |
| `WhatsApp:` con el celular | Solo el DNI, o DNI en el campo de teléfono |
| `DNI:` con el documento | Mezclar documento y celular sin etiquetas |
| Turnos de **1 hora** | 15 / 30 / 45 minutos o solapes |
| Bloqueos: `No dar`, `Bloqueo`, `Feriado` | Dejar un bloqueo con nombre de persona |

---

## 5. Casos especiales

**Agendó un tercero**

```text
Título: [NORBERTO] Nombre Paciente (Agendó: Nombre Familiar)
Descripción: WhatsApp Paciente: 11… | DNI: …
```

**Menor**

```text
Título: [MARÍA] [MENOR] Nombre Menor (Familiar: Nombre Adulto)
Descripción: WhatsApp: 11… | DNI: …
```

---

## 6. Campaña

El listado de turnos de campaña en el admin lee estos eventos de Calendar. Si WhatsApp y DNI están bien etiquetados, el paciente se reconoce solo. El tilde “¿Viene de la campaña?” se marca o corrige en el panel admin.

---

## Checklist rápido

1. ¿Está en el calendario **consultorio**?
2. ¿El título tiene el **nombre** del paciente?
3. ¿Hay `WhatsApp:` con el celular?
4. ¿Hay `DNI:` con el documento?
5. ¿Duración 1 hora, sin solapar otra camilla?
