/**
 * Kinésica - Cliente API de Reservas (Dual: Webhook de Google Apps Script + Mock Local)
 * =====================================================================================
 * Permite alternar de forma transparente entre:
 * 1. Google Apps Script Webhook real (conectado a Google Calendar en producción).
 * 2. Mock API local (para pruebas visuales e interactivas instantáneas sin credenciales).
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingClient = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  // Almacén en memoria / LocalStorage para el modo Mock
  const MOCK_STORAGE_KEY = "kinesica_mock_calendar_events";

  // Pacientes de prueba precargados para verificar el reconocimiento
  const MOCK_HABITUAL_PATIENTS = [
    { telefono: "5491100001111", nombre: "Paciente Demo Uno" },
    { telefono: "5491100002222", nombre: "Paciente Demo Dos" },
  ];

  function getMockEvents() {
    try {
      const stored = localStorage.getItem(MOCK_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // Eventos simulados por defecto (algunos huecos ocupados para probar)
    const today = new Date();
    const mockDate = engine.formatDateIso(today);
    const defaults = [
      {
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0).getTime(),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).getTime(),
        title: "🩺 [TURNO] Paciente Ocupado 11hs",
      },
      {
        start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0).getTime(),
        end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 10).getTime(),
        title: "📞 [LLAMADA 10m] Paciente Ocupado 15hs",
      },
    ];
    return defaults;
  }

  function saveMockEvents(events) {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {}
  }

  class BookingClient {
    constructor(options) {
      this.options = options || {};
      this.apiUrl =
        this.options.apiUrl ||
        (typeof window !== "undefined" && window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) ||
        null;
      this.isMock = !this.apiUrl || this.options.forceMock === true;
    }

    setApiUrl(url) {
      this.apiUrl = url;
      this.isMock = !url;
    }

    setForceMock(force) {
      this.isMock = force;
    }

    /**
     * Consulta horarios disponibles para una fecha y tipo.
     */
    async getAvailableSlots(dateStr, appointmentType) {
      if (this.isMock) {
        // Simular latencia de red (150ms)
        await new Promise((r) => setTimeout(r, 150));
        const events = getMockEvents();
        const slots = engine.calculateAvailableSlots({
          date: dateStr,
          appointmentType: appointmentType,
          busyIntervals: events,
        });
        return {
          status: "success",
          date: dateStr,
          type: appointmentType,
          availableSlots: slots,
          source: "mock",
        };
      }

      // Conexión real a Google Apps Script Webhook con timeout de 15 segundos
      const url = `${this.apiUrl}?action=get_slots&date=${encodeURIComponent(dateStr)}&type=${encodeURIComponent(appointmentType)}`;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

      try {
        const res = await fetch(url, {
          signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return await res.json();
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          throw new Error("La consulta a Google Calendar demoró demasiado. Por favor intenta recargar la página.");
        }
        throw err;
      }
    }

    /**
     * Verifica si el número telefónico pertenece a un paciente habitual.
     */
    async checkPatient(phone) {
      const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
      const last8 = cleanPhone.slice(-8);

      if (this.isMock) {
        await new Promise((r) => setTimeout(r, 100));
        const match = MOCK_HABITUAL_PATIENTS.find((p) => p.telefono.endsWith(last8));
        if (match) {
          return { status: "success", is_habitual: true, nombre: match.nombre, source: "mock" };
        }
        return { status: "success", is_habitual: false, nombre: null, source: "mock" };
      }

      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "check_patient", telefono: phone }),
      });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    }

    /**
     * Envía la reserva a Google Calendar (o al mock local).
     */
    async bookAppointment(data) {
      // Validación previa en cliente usando el motor de reglas
      const validation = engine.validateBookingRequest(data);
      if (!validation.isValid) {
        throw new Error(validation.errors.join("\n"));
      }

      if (this.isMock) {
        await new Promise((r) => setTimeout(r, 300));
        const duration =
          data.appointmentType === "session"
            ? engine.SESSION_DURATION_MINUTES
            : engine.CALL_DURATION_MINUTES;

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

        const events = getMockEvents();

        // Chequeo anti-colisión en el mock
        const collision = events.some((ev) => start < ev.end && end > ev.start);
        if (collision) {
          throw new Error("El horario seleccionado ya no está disponible. Por favor elegí otro horario.");
        }

        const summary = engine.formatCalendarSummary(data);
        events.push({ start, end, title: summary });
        saveMockEvents(events);

        return {
          status: "success",
          appointmentType: data.appointmentType,
          summary: summary,
          date: data.date,
          time: data.time,
          eventId: `mock_evt_${Date.now()}`,
          message:
            data.appointmentType === "call"
              ? "Tu llamada de orientación ha sido agendada con éxito."
              : "Tu turno presencial ha sido agendado con éxito.",
          source: "mock",
        };
      }

      // Enviar a Google Apps Script
      const payload = Object.assign({ action: "book" }, data);
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.status !== "success") {
        throw new Error(json.message || "Error al registrar la cita en Google Calendar");
      }
      return json;
    }
  }

  return {
    BookingClient: BookingClient,
    getMockEvents: getMockEvents,
    saveMockEvents: saveMockEvents,
  };
});
