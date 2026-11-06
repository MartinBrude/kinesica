# Cómo agendar turnos correctamente

Guía breve para que los turnos queden bien en el calendario **consultorio**, con recordatorios y datos de contacto legibles por el sistema.

Podés agendar de dos formas:

1. **Función Agendar del sitio** (`kinesica.com.ar/agendar.html`) — completa título y descripción sola.
2. **Google Calendar a mano** — seguí el formato de abajo.

---

## 1. Función Agendar (sitio web)

Entrá a **Agendar**, indicá si el paciente ya se atendió (Sí / No) y seguí los pasos: día, horario y datos.

<p align="center">
  <img src="assets/mockup_agendar_web.png" alt="Pantalla Agendar del sitio Kinésica" width="640">
  <br>
  <em>Figura 1: Inicio del formulario Agendar en el sitio.</em>
</p>

Al confirmar, el turno se crea en el calendario **consultorio** con WhatsApp y DNI ya etiquetados. Es la opción más segura.

---

## 2. Google Calendar a mano

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
  <em>Figura 2: Ejemplo en Calendar. El emoji del título es opcional; WhatsApp y DNI van en la descripción.</em>
</p>

---

## 3. Resumen: qué sí y qué no

<p align="center">
  <img src="assets/comparativa_agendamiento_dos_donts.jpg" alt="Comparativa de buenas y malas prácticas al agendar" width="760">
  <br>
  <em>Figura 3: Comparativa rápida de buenas prácticas.</em>
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

## 4. Casos especiales

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

## 5. Campaña

El listado de turnos de campaña en el admin lee estos eventos de Calendar. Si WhatsApp y DNI están bien etiquetados, el paciente se reconoce solo. El tilde “¿Viene de la campaña?” se marca o corrige en el panel admin.

---

## Checklist rápido

1. ¿Está en el calendario **consultorio**?
2. ¿El título tiene el **nombre** del paciente?
3. ¿Hay `WhatsApp:` con el celular?
4. ¿Hay `DNI:` con el documento?
5. ¿Duración 1 hora, sin solapar otra camilla?
