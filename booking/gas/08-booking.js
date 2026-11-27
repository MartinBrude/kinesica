/**
 * Kinésica GAS — Reserva de turnos (book): evento en Calendar + efectos secundarios.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

/** Título y descripción normalizados del evento Kinésica. */
function buildBookingEventMeta(f, payload) {
  // 3. Construir título normalizado Kinésica
  const practitionerNames = { norberto: "Norberto", maria: "María" };
  const whoName = practitionerNames[f.practitionerId] || "";
  const whoTag = whoName ? "[" + whoName.toUpperCase() + "] " : "";
  const familiarTitle = f.contactoNombre || f.nombreFamiliar;
  const summary = (f.isMenor && familiarTitle)
    ? "🩺 " + whoTag + "[MENOR] " + f.nombre + " (Familiar: " + familiarTitle + ")"
    : (f.esParaTercero && familiarTitle)
      ? "🩺 " + whoTag + f.nombre + " (Agendó: " + familiarTitle + ")"
      : "🩺 " + whoTag + f.nombre;

  const techniqueLabels = {
    osteopatia: "Osteopatía",
    acupuntura: "Acupuntura",
    rpg: "RPG",
    atm: "ATM",
    neurodinamia: "Neurodinamia",
    viscerales: "Manipulaciones viscerales (Barral)",
    posturologia: "Posturología",
    "no-se": "No especifica"
  };
  const techniqueId = String(payload.techniqueId || "");
  const techniqueLabel = techniqueLabels[techniqueId] || "";

  const especialidad = techniqueId === "no-se"
    ? "No especifica"
    : (techniqueLabel || payload.especialidad || (payload.motivo && payload.motivo !== "Consulta general" ? payload.motivo : "") || "No especifica");

  // 3. Construir descripción normalizada
  const descParts = [];
  if (whoName) descParts.push("👤 Profesional: " + whoName);

  if (f.esParaTercero && familiarTitle) {
    if (f.telefono && f.contactoTelefono && f.telefono !== f.contactoTelefono) {
      descParts.push("📱 WhatsApp Paciente: " + f.telefono);
      descParts.push("👤 Agendado por: " + familiarTitle + " (WhatsApp: " + f.contactoTelefono + ")");
      descParts.push("📱 WhatsApp: " + f.telefono + " / " + f.contactoTelefono);
    } else {
      descParts.push("📱 WhatsApp: " + (f.telefono || f.contactoTelefono));
      descParts.push("👤 Agendado por: " + familiarTitle);
    }
    if (f.contactoNotas) descParts.push("👥 Relación/Rol: " + f.contactoNotas);
  } else {
    descParts.push("📱 WhatsApp: " + f.telefono);
  }

  descParts.push(
    "📧 Email: " + (f.email || "No provisto"),
    "🪪 DNI: " + f.dni,
    "🌿 Origen: Reserva Web Oficial Kinésica",
    "📋 Especialidad: " + especialidad
  );
  if (f.isMenor && familiarTitle) descParts.push("👥 Adulto Responsable: " + familiarTitle);
  if (f.notas) descParts.push("💬 Notas: " + f.notas);

  return {
    summary: summary,
    description: descParts.filter(Boolean).join(" | "),
    whoName: whoName,
    techniqueLabel: techniqueLabel,
    especialidad: especialidad,
    motivo: especialidad
  };
}

/** Invitado, planilla, avisos al profesional y espejo admin — best-effort, no bloquean la reserva. */
function runBookingSideEffects(f, payload, meta, event, bookingResult) {
  const practitionerContact = resolvePractitionerContact(f.practitionerId);
  if (f.practitionerId && practitionerContact.email) {
    try {
      event.addGuest(practitionerContact.email);
    } catch (guestErr) {
      console.error("No se pudo invitar a " + practitionerContact.email + ": " + guestErr);
    }
  }

  // 5. Si es Primera Sesión Presencial, registrar en Google Sheets
  if (f.appointmentType === "session") {
    try {
      const sheet = getPatientsSheet();
      if (sheet) {
        const phoneFormatted = f.telefono.startsWith("'") ? f.telefono : "'" + f.telefono;
        const fechaHora = f.dateStr + " " + f.timeStr + " hs";
        sheet.appendRow([f.nombre, f.dni, phoneFormatted, fechaHora, meta.motivo, meta.techniqueLabel, f.email]);
      }
    } catch (e) {
      // No bloquea la respuesta si la planilla falla
    }
  }

  // 6. Avisar por WhatsApp (y mail de respaldo) al profesional del turno.
  // Si viene sincronizado desde el servidor de respaldo (from_backup_server), no duplicar aviso
  // porque el servidor ya envió la Alerta de Auditoría exclusivamente a Norberto.
  if (!payload.from_backup_server) {
    try {
      const notifyIds = f.practitionerId ? [f.practitionerId] : ["norberto", "maria"];
      notifyIds.forEach(function (id) {
        notifyPractitionerNewWebBooking(id, {
          appointmentType: f.appointmentType,
          nombre: f.nombre,
          telefono: f.telefono,
          dni: f.dni,
          date: f.dateStr,
          time: f.timeStr,
          especialidad: meta.especialidad,
          motivo: meta.especialidad,
          isMenor: f.isMenor,
          nombreFamiliar: f.nombreFamiliar,
          notas: f.notas,
          summary: meta.summary,
          practitionerName: meta.whoName,
          technique: meta.techniqueLabel
        });
      });
    } catch (errNotify) {
      console.error("Error al notificar al profesional: " + errNotify);
    }
  }

  // 7. Espejo local turnos (MariaDB) — best-effort; no bloquea la reserva.
  try {
    mirrorTurnoToAdmin({
      eventId: bookingResult.eventId,
      date: f.dateStr,
      time: f.timeStr,
      nombre: f.nombre,
      telefono: f.telefono,
      dni: f.dni,
      practitionerId: f.practitionerId,
      summary: meta.summary
    });
  } catch (errMirror) {
    console.error("mirrorTurnoToAdmin: " + errMirror);
  }
}

/**
 * Endpoint POST: Agenda el turno o llamada en Google Calendar.
 */
function handleBookAppointment(payload) {
  const f = readBookingFields(payload);

  const previousResult = getStoredBookingResult(f.bookingRequestId);
  if (previousResult && previousResult.status === "success") {
    return createJsonResponse(previousResult);
  }

  const invalid = validateBookingFields(f, payload);
  if (invalid) return invalid;

  const duration = SESSION_DURATION_MINUTES;
  const startTime = parseArgentinaDate(f.dateStr, f.timeStr);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  const scheduleError = validateBookingSchedule(f, payload, startTime, duration);
  if (scheduleError) return scheduleError;

  const meta = buildBookingEventMeta(f, payload);

  // 4. Comprobar y crear dentro del mismo lock: CalendarApp no ofrece una operación
  // condicional atómica y dos peticiones concurrentes podrían ver el mismo hueco.
  const cal = getKinesicaCalendar();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return createJsonResponse({
      status: "error",
      message: "La agenda está atendiendo otra reserva. Por favor intenta nuevamente en unos segundos."
    }, 503);
  }

  let event;
  let bookingResult;
  try {
    const concurrentResult = getStoredBookingResult(f.bookingRequestId);
    if (concurrentResult && concurrentResult.status === "success") {
      return createJsonResponse(concurrentResult);
    }
    const existingEvents = cal.getEvents(startTime, endTime);
    if (existingEvents.length > 0) {
      return createJsonResponse({
        status: "conflict",
        message: "El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible."
      }, 409);
    }

    // Crear evento en Google Calendar.
    event = cal.createEvent(meta.summary, startTime, endTime, {
      description: meta.description
    });
    bookingResult = {
      status: "success",
      appointmentType: f.appointmentType,
      summary: meta.summary,
      date: f.dateStr,
      time: f.timeStr,
      eventId: event.getId(),
      message: f.appointmentType === "call"
        ? "Tu llamada de orientación ha sido agendada con éxito."
        : "Tu turno presencial ha sido agendado con éxito."
    };
    const confirmToken = signBookingConfirmationToken({
      eventId: bookingResult.eventId,
      telefono: f.telefono,
      email: f.email,
      nombre: f.nombre,
      date: f.dateStr,
      time: f.timeStr,
      practitionerId: f.practitionerId,
      especialidad: meta.especialidad
    });
    if (confirmToken) {
      bookingResult.confirmToken = confirmToken;
    }
    // Persistir antes de liberar el lock para que un timeout del navegador sea
    // recuperable reenviando exactamente la misma solicitud.
    storeBookingResult(f.bookingRequestId, bookingResult);
  } finally {
    lock.releaseLock();
  }

  runBookingSideEffects(f, payload, meta, event, bookingResult);
  return createJsonResponse(bookingResult);
}
