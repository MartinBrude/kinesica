/**
 * Kinésica - Sincronización y Exportación a Calendarios (Google Calendar / iCal / Outlook)
 * =======================================================================================
 * Genera títulos y descripciones normalizadas para Google Calendar y archivos .ics descargables.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingCalendarSync = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createCalendarSync(deps) {
    const PRACTITIONERS = (deps && deps.PRACTITIONERS) || {};
    const getTechnique = (deps && deps.getTechnique) || function() { return null; };
    const SESSION_DURATION_MINUTES = (deps && deps.SESSION_DURATION_MINUTES) || 60;

function formatCalendarSummary(data) {
    const isMenor = Boolean(data.isMenor);
    const nombre = data.nombre.trim();
    const familiar = (data.contactoNombre || data.nombreFamiliar || "").trim();
    const esParaTercero = Boolean(data.esParaTercero || (data.contactoNombre && data.contactoNombre.trim()));

    const who = PRACTITIONERS[data.practitionerId];
    const whoTag = who ? `[${who.name.toUpperCase()}] ` : "";
    if (isMenor && familiar) {
      return `🩺 ${whoTag}[TURNO - MENOR] ${nombre} (Familiar: ${familiar})`;
    }
    if (esParaTercero && familiar) {
      return `🩺 ${whoTag}[TURNO] ${nombre} (Agendó: ${familiar})`;
    }
    return `🩺 ${whoTag}[TURNO] ${nombre}`;
  }

  /**
   * Genera la descripción normalizada para Google Calendar.
   */
  function formatCalendarDescription(data) {
    const technique = getTechnique(data.techniqueId);
    const who = PRACTITIONERS[data.practitionerId];
    const especialidad = data.techniqueId === "no-se"
      ? "No especifica"
      : (technique && !technique.internal ? technique.label : data.especialidad || data.motivo || "No especifica");

    const parts = [];
    if (data.esParaTercero && data.contactoNombre) {
      const telPaciente = (data.telefono || "").trim();
      const telContacto = (data.contactoTelefono || "").trim();
      if (telPaciente && telContacto && telPaciente !== telContacto) {
        parts.push(`📱 WhatsApp Paciente: ${telPaciente}`);
        parts.push(`👤 Agendado por: ${data.contactoNombre.trim()} (WhatsApp: ${telContacto})`);
        parts.push(`📱 WhatsApp: ${telPaciente} / ${telContacto}`);
      } else {
        parts.push(`📱 WhatsApp: ${telPaciente || telContacto}`);
        parts.push(`👤 Agendado por: ${data.contactoNombre.trim()}`);
      }
      if (data.contactoNotas && data.contactoNotas.trim()) {
        parts.push(`👥 Relación/Rol: ${data.contactoNotas.trim()}`);
      }
    } else {
      parts.push(`📱 WhatsApp: ${data.telefono.trim()}`);
    }

    parts.push(
      `📧 Email: ${String(data.email || "").trim()}`,
      `🪪 DNI: ${data.dni ? data.dni.trim() : "No provisto"}`,
      `🌿 Origen: Reserva Web Oficial Kinésica`
    );

    if (who) parts.push(`👤 Profesional: ${who.name}`);
    if (data.techniqueId || data.especialidad) {
      parts.push(`📋 Especialidad: ${especialidad}`);
    } else if (data.motivo && data.motivo.trim()) {
      parts.push(`📋 Motivo: ${data.motivo.trim()}`);
    }
    if (data.isMenor && data.nombreFamiliar) {
      parts.push(`👥 Adulto Responsable: ${data.nombreFamiliar.trim()}`);
    }
    if (data.notas) {
      parts.push(`💬 Notas del paciente: ${data.notas.trim()}`);
    }
    return parts.join(" | ");
  }

  /**
   * Genera los datos para sincronización con calendarios personales del paciente
   * (Google Calendar e iCal/.ics para Apple Calendar y Outlook).
   */
  function generateCalendarExportData(payload, eventId) {
    const durationMinutes = SESSION_DURATION_MINUTES;

    const [year, month, day] = (payload.date || "").split("-").map(Number);
    const [hour, minute] = (payload.time || "").split(":").map(Number);

    // Horario local de Argentina: UTC-3
    const startUtc = new Date(Date.UTC(year, month - 1, day, hour + 3, minute));
    const endUtc = new Date(startUtc.getTime() + durationMinutes * 60 * 1000);

    const technique = getTechnique(payload.techniqueId);
    const who = PRACTITIONERS[payload.practitionerId];
    const title = technique && !technique.internal
      ? `Turno en Kinésica — ${technique.label}`
      : "Turno en Kinésica";

    const location = "Charcas 3889, Piso 5º B, Palermo, CABA (entre Scalabrini Ortiz y Aráoz)";

    const specialtyLabel = payload.techniqueId === "no-se"
      ? "No especifica"
      : (technique && !technique.internal ? technique.label : (payload.especialidad || ""));

    const specialtyLine = specialtyLabel ? `Especialidad: ${specialtyLabel}.` : "";

    const description = [
      "Información importante:",
      "- Te pedimos que llegues a la hora de la sesión, ni antes ni después, por características del espacio y la organización.",
      "- Asistir sin acompañantes (salvo necesidad directa o menores).",
      "- Traer estudios médicos previos si contás con ellos.",
      specialtyLine,
      who ? `Profesional: ${who.id === "maria" ? "mujer" : "hombre"}.` : "",
    ].filter(Boolean).join("\n");

    const toCompactUtc = (d) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    const startCompact = toCompactUtc(startUtc);
    const endCompact = toCompactUtc(endUtc);

    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${startCompact}/${endCompact}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;

    const escapeIcs = (str) =>
      (str || "")
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r?\n/g, "\\n");

    const nowCompact = toCompactUtc(new Date());
    const uid = eventId || `kinesica-${Date.now()}@kinesica.com.ar`;

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Kinesica//Consultorio Kinesiologia//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${nowCompact}`,
      `DTSTART:${startCompact}`,
      `DTEND:${endCompact}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return {
      title,
      location,
      description,
      startUtc,
      endUtc,
      startCompact,
      endCompact,
      googleCalendarUrl,
      icsContent,
      filename: `kinesica-turno-${payload.date}.ics`,
    };
  }

    return {
      formatCalendarSummary: formatCalendarSummary,
      formatCalendarDescription: formatCalendarDescription,
      generateCalendarExportData: generateCalendarExportData,
    };
  }

  return {
    createCalendarSync: createCalendarSync,
  };
});
