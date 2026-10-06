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
      this._slotsCache = {};
      this._inFlightSlots = {};
      this._prewarmed = false;
    }

    setApiUrl(url) {
      this.apiUrl = url;
      this.isMock = !url;
      this._slotsCache = {};
    }

    setForceMock(force) {
      this.isMock = force;
    }

    /**
     * Precalienta la conexión con Google Apps Script en segundo plano (fire-and-forget).
     * Reduce drásticamente la latencia de cold-start antes de que el usuario elija fecha.
     */
    prewarm() {
      if (this.isMock || this._prewarmed) return;
      this._prewarmed = true;
      const effectiveUrl = this.getEffectiveApiUrl();
      if (!effectiveUrl) return;
      try {
        fetch(`${effectiveUrl}?action=ping`, {
          method: "GET",
          mode: "cors",
          redirect: "follow",
          cache: "no-store",
        }).catch(() => {});
      } catch (e) {}
    }

    getEffectiveApiUrl() {
      // Si options.apiUrl se pasó explícitamente y no es la default de GAS, respetarla
      if (
        this.options &&
        this.options.apiUrl &&
        typeof window !== "undefined" &&
        this.options.apiUrl !== (window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl)
      ) {
        return this.apiUrl;
      }
      // En servidor local de pruebas (puerto 3000), usar el proxy local transparente
      if (
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
        window.location.port === "3000"
      ) {
        return "/api/booking";
      }
      return this.apiUrl;
    }

    /**
     * Consulta horarios disponibles para una fecha y tipo con reintentos automáticos y caché en memoria.
     * Si el servidor de Google Apps Script está en "cold start", reintenta de forma transparente
     * antes de arrojar error en la interfaz.
     */
    async getAvailableSlots(dateStr, appointmentType, options) {
      options = options || {};
      const forceRefresh = options.forceRefresh === true;
      const maxRetries = typeof options.maxRetries === "number" ? options.maxRetries : 2; // hasta 3 intentos

      if (this.isMock) {
        // Simular latencia de red (150ms)
        await new Promise((r) => setTimeout(r, 150));
        const events = getMockEvents();
        const slots = engine.calculateAvailableSlots({
          date: dateStr,
          practitionerId: options.practitionerId,
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

      const cacheKey = `${dateStr}_${appointmentType}_${options.practitionerId || ""}`;

      // 1. Revisar caché en memoria (validez 2 minutos para respuesta instantánea)
      this._slotsCache = this._slotsCache || {};
      const cached = this._slotsCache[cacheKey];
      if (!forceRefresh && cached && Date.now() - cached.timestamp < 120000) {
        return cached.data;
      }

      // 2. Si ya hay una petición idéntica en vuelo, reutilizar la misma Promise (anti-duplicación)
      this._inFlightSlots = this._inFlightSlots || {};
      if (!forceRefresh && this._inFlightSlots[cacheKey]) {
        return this._inFlightSlots[cacheKey];
      }

      const effectiveUrl = this.getEffectiveApiUrl();
      const url = `${effectiveUrl}?action=get_slots&date=${encodeURIComponent(dateStr)}&type=session&practitioner=${encodeURIComponent(options.practitionerId || "")}&technique=${encodeURIComponent(options.techniqueId || "")}`;

      const fetchWithRetry = async (attempt) => {
        // En el primer intento damos 20s para permitir que el cold start de GAS despierte
        const timeoutMs = attempt === 0 ? 20000 : 15000;
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        try {
          const res = await fetch(url, {
            method: "GET",
            mode: "cors",
            redirect: "follow",
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const json = await res.json();
          if (json.status === "error") {
            throw new Error(json.message || "Error al obtener disponibilidad");
          }
          return json;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);

          const isAbort = err.name === "AbortError";
          const isTransientError =
            isAbort ||
            err instanceof TypeError ||
            (err.message && (err.message.includes("Failed to fetch") || err.message.includes("HTTP Error 5")));

          // Si falla por cold-start o corte transitorio y quedan reintentos, reintentar automáticamente
          if (attempt < maxRetries && isTransientError) {
            const delay = (attempt + 1) * 600; // 600ms, 1200ms
            await new Promise((r) => setTimeout(r, delay));
            return fetchWithRetry(attempt + 1);
          }

          if (isAbort) {
            throw new Error("La consulta a Google Calendar demoró demasiado. Por favor intenta recargar la página.");
          }
          throw err;
        }
      };

      const reqPromise = (async () => {
        try {
          const result = await fetchWithRetry(0);
          this._slotsCache[cacheKey] = {
            data: result,
            timestamp: Date.now(),
          };
          return result;
        } finally {
          delete this._inFlightSlots[cacheKey];
        }
      })();

      this._inFlightSlots[cacheKey] = reqPromise;
      return reqPromise;
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

      const effectiveUrl = this.getEffectiveApiUrl();
      const query = new URLSearchParams({
        action: "check_patient",
        telefono: phone,
      });
      const url = `${effectiveUrl}?${query.toString()}`;
      const res = await fetch(url, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
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

        const events = getMockEvents();

        // Chequeo anti-colisión en el mock
        const collision = events.some((ev) => start < ev.end && end > ev.start);
        if (collision) {
          throw new Error("El horario seleccionado ya no está disponible. Por favor elegí otro horario.");
        }

        const summary = engine.formatCalendarSummary(data);
        events.push({ start, end, title: summary, practitioner: data.practitionerId });
        saveMockEvents(events);

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

      // Enviar a Google Apps Script / Proxy local
      // Enviamos tanto en la query string (garantiza supervivencia si un navegador degrada 302 a GET)
      // como en el cuerpo POST en formato JSON
      const effectiveUrl = this.getEffectiveApiUrl();
      const query = new URLSearchParams({
        action: "book",
        tipo: data.tipo || "",
        appointmentType: data.appointmentType || "",
        date: data.date || "",
        time: data.time || "",
        nombre: data.nombre || "",
        telefono: data.telefono || "",
        dni: data.dni || "",
        techniqueId: data.techniqueId || "",
        practitionerId: data.practitionerId || "",
        motivo: data.motivo || "",
        isMenor: data.isMenor ? "true" : "false",
        nombreFamiliar: data.nombreFamiliar || "",
        notas: data.notas || "",
      });

      const url = `${effectiveUrl}?${query.toString()}`;
      const payload = Object.assign({ action: "book" }, data);

      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
      let res;
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
          throw new Error("La reserva tardó demasiado. Revisá el calendario antes de intentar de nuevo: el turno puede haber quedado agendado.");
        }
        throw err;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error(`Error de comunicación con el servidor (${res.status})`);
      }

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
