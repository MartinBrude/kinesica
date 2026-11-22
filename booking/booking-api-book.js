(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine", "./booking-api-storage", "./booking-api-backup"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-engine"),
      require("./booking-api-storage"),
      require("./booking-api-backup")
    );
  } else {
    root.KinesicaBookingApiBook = factory(
      root.KinesicaBookingEngine,
      root.KinesicaBookingApiStorage,
      root.KinesicaBookingApiBackup
    );
  }
})(typeof self !== "undefined" ? self : this, function (engine, storage, backup) {
  "use strict";

  const st = storage || (typeof window !== "undefined" && window.KinesicaBookingApiStorage) || {};
  const bk = backup || (typeof window !== "undefined" && window.KinesicaBookingApiBackup) || {};

  async function submitBooking(client, data) {
    const validation = engine.validateBookingRequest(data);
    if (!validation.isValid) throw new Error(validation.errors.join("\n"));

    if (data && data.adminMode && client.adminBookProxyUrl && typeof bk.bookViaAdminProxy === "function") {
      if (!data.bookingRequestId && typeof st.createBookingRequestId === "function") {
        data.bookingRequestId = st.createBookingRequestId();
      }
      try {
        const adminResult = await bk.bookViaAdminProxy(client, data);
        if (adminResult) {
          client.clearCache();
          return adminResult;
        }
      } catch (adminErr) {
        if (adminErr && (adminErr.isConflict || adminErr.isValidation)) throw adminErr;
        if (typeof bk.bookViaBackup === "function") {
          const backupResult = await bk.bookViaBackup(client, data);
          if (backupResult) {
            client.clearCache();
            return backupResult;
          }
        }
        throw adminErr || new Error("Error al registrar la cita (admin)");
      }
    }

    if (client.isMock) {
      await new Promise((r) => setTimeout(r, 300));
      const duration = engine.SESSION_DURATION_MINUTES;
      const parts = data.date.split("-");
      const timeParts = data.time.split(":");
      const start = new Date(
        parseInt(parts[0], 10),
        parseInt(parts[1], 10) - 1,
        parseInt(parts[2], 10),
        parseInt(timeParts[0], 10),
        parseInt(timeParts[1], 10)
      ).getTime();
      const end = start + duration * 60 * 1000;

      const events = typeof st.getMockEvents === "function" ? st.getMockEvents() : [];
      const collision = events.some((ev) => start < ev.end && end > ev.start);
      if (collision) {
        throw new Error("El horario seleccionado ya no está disponible. Por favor elegí otro horario.");
      }
      const summary = engine.formatCalendarSummary(data);
      events.push({ start, end, title: summary, practitioner: data.practitionerId });
      if (typeof st.saveMockEvents === "function") st.saveMockEvents(events);
      return {
        status: "success",
        appointmentType: data.appointmentType,
        summary: summary,
        date: data.date,
        time: data.time,
        eventId: `mock_evt_${Date.now()}`,
        message: "Tu turno presencial ha sido agendado con éxito.",
        source: "mock",
      };
    }

    const effectiveUrl = client.getEffectiveApiUrl();
    const hoursSig = typeof st.currentHoursSignature === "function" ? st.currentHoursSignature() : "";
    const currentOverrides = engine && typeof engine.getScheduleOverrides === "function"
      ? engine.getScheduleOverrides()
      : [];
    const overridesJson = JSON.stringify(currentOverrides);
    if (!data.bookingRequestId && typeof st.createBookingRequestId === "function") {
      data.bookingRequestId = st.createBookingRequestId();
    }

    const query = new URLSearchParams({
      action: "book",
      tipo: data.tipo || "",
      appointmentType: data.appointmentType || "",
      date: data.date || "",
      time: data.time || "",
      nombre: data.nombre || "",
      email: data.email || "",
      telefono: data.telefono || "",
      dni: data.dni || "",
      techniqueId: data.techniqueId || "",
      practitionerId: data.practitionerId || "",
      motivo: data.motivo || "",
      isMenor: data.isMenor ? "true" : "false",
      nombreFamiliar: data.nombreFamiliar || "",
      notas: data.notas || "",
      bookingRequestId: data.bookingRequestId,
      hours: hoursSig,
      schedule_overrides: overridesJson,
    });

    const url = `${effectiveUrl}?${query.toString()}`;
    const payload = Object.assign({ action: "book", hours: hoursSig, schedule_overrides: overridesJson }, data);

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 55000) : null;
    let res;
    let primaryError = null;
    try {
      res = await fetch(url, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      });
    } catch (err) {
      if (err && err.name === "AbortError") {
        primaryError = new Error("La reserva tardó demasiado. Revisá el calendario antes de intentar de nuevo: el turno puede haber quedado agendado.");
      } else {
        primaryError = err;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (!primaryError && res && res.ok) {
      try {
        const json = await res.json();
        if (json && json.status === "success") {
          client.clearCache();
          return json;
        }
        if (json && json.status === "conflict") {
          const conflictErr = new Error(json.message || "El horario seleccionado acaba de ser reservado por otro paciente.");
          conflictErr.isConflict = true;
          throw conflictErr;
        }
        const msg = (json && json.message) || "Error al registrar la cita en Google Calendar";
        if (/fuera del horario|anticipaci[oó]n|fechas pasadas|requerid|inv[aá]lid/i.test(msg)) {
          const valErr = new Error(msg);
          valErr.isValidation = true;
          throw valErr;
        }
        primaryError = new Error(msg);
      } catch (parseOrLogicErr) {
        if (parseOrLogicErr && (parseOrLogicErr.isConflict || parseOrLogicErr.isValidation)) throw parseOrLogicErr;
        primaryError = parseOrLogicErr;
      }
    } else if (!primaryError) {
      primaryError = new Error(`Error de comunicación con el servidor (${res ? res.status : "sin respuesta"})`);
    }

    if (typeof bk.bookViaBackup === "function") {
      const backupResult = await bk.bookViaBackup(client, payload);
      if (backupResult) {
        client.clearCache();
        return backupResult;
      }
    }

    const finalErr = primaryError || new Error("Error al registrar la cita");
    finalErr.bothSystemsFailed = true;
    throw finalErr;
  }

  return {
    submitBooking,
  };
});
