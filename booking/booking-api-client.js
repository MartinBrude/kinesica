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

  function createBookingRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `web-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

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
        title: "🩺 Paciente Ocupado 11hs",
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

  const RANGE_STORAGE_KEY = "kinesica_slots_range_v1";
  const RANGE_TTL_MS = 300000; // 5 minutos de caché para navegación fluida

  function currentHoursSignature() {
    try {
      const h = engine && typeof engine.getPractitionerHours === "function"
        ? engine.getPractitionerHours()
        : (engine && engine.PRACTITIONER_HOURS) || {};
      return JSON.stringify(h);
    } catch (e) {
      return "";
    }
  }

  function clearStoredRange() {
    try {
      sessionStorage.removeItem(RANGE_STORAGE_KEY);
    } catch (e) {}
  }

  function readStoredRange() {
    try {
      const raw = sessionStorage.getItem(RANGE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.days || Date.now() - parsed.at > RANGE_TTL_MS) return null;
      if (parsed.hoursSig && parsed.hoursSig !== currentHoursSignature()) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeStoredRange(from, to, days) {
    try {
      sessionStorage.setItem(
        RANGE_STORAGE_KEY,
        JSON.stringify({ at: Date.now(), from, to, days, hoursSig: currentHoursSignature() })
      );
    } catch (e) {}
  }

  function storedRangeCovers(stored, from, to) {
    return stored && stored.from <= from && stored.to >= to;
  }

  function applyStoredDays(cache, days, timestamp) {
    Object.keys(days).forEach((dateStr) => {
      cache[`${dateStr}_session`] = {
        data: {
          status: "success",
          date: dateStr,
          type: "session",
          availableSlots: days[dateStr] || [],
        },
        timestamp: timestamp,
      };
    });
  }

  class BookingClient {
    constructor(options) {
      this.options = options || {};
      this.apiUrl =
        this.options.apiUrl ||
        (typeof window !== "undefined" && window.KINESICA_SITE && window.KINESICA_SITE.bookingApiUrl) ||
        null;
      this.backupApiUrl =
        this.options.backupApiUrl !== undefined
          ? this.options.backupApiUrl
          : "/admin/api/calendar_backup.php";
      // Turnera admin: book con sesión + secret server-side (no confiar adminMode en GAS público).
      this.adminBookProxyUrl =
        this.options.adminBookProxyUrl !== undefined
          ? this.options.adminBookProxyUrl
          : null;
      this.isMock = !this.apiUrl || this.options.forceMock === true;
      this._slotsCache = {};
      this._inFlightSlots = {};
      this._rangeInFlight = null;
      this._rangeUnsupported = false;
      this._prewarmedAt = 0;
    }

    getBackupApiUrl() {
      if (!this.backupApiUrl || this.isMock) return null;
      return this.backupApiUrl;
    }

    /**
     * Sincronización pasiva en segundo plano (Piggybacking):
     * Cuando Google Calendar responde OK, actualiza silenciosamente la copia de respaldo del servidor.
     */
    syncBackupSlots(payload) {
      const backupUrl = this.getBackupApiUrl();
      if (!backupUrl || typeof fetch !== "function") return;
      try {
        fetch(`${backupUrl}?action=sync_client_slots`, {
          method: "POST",
          mode: "cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ action: "sync_client_slots" }, payload)),
        }).catch(() => {});
      } catch (e) {}
    }

    async fetchSlotsFromBackup(dateStr, options) {
      const backupUrl = this.getBackupApiUrl();
      if (!backupUrl || typeof fetch !== "function") return null;
      const practitionerId = (options && options.practitionerId) || "";
      const query = new URLSearchParams({
        action: "get_slots",
        date: dateStr,
        type: "session",
        practitioner: practitionerId,
      });
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
      try {
        const res = await fetch(`${backupUrl}?${query.toString()}`, {
          method: "GET",
          mode: "cors",
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) return null;
        const json = await res.json();
        if (!json || json.status !== "success" || !Array.isArray(json.availableSlots)) {
          return null;
        }
        return json;
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        return null;
      }
    }

    async fetchSlotsRangeFromBackup(from, to) {
      const backupUrl = this.getBackupApiUrl();
      if (!backupUrl || typeof fetch !== "function") return null;
      const query = new URLSearchParams({
        action: "get_slots_range",
        from: from,
        to: to,
      });
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
      try {
        const res = await fetch(`${backupUrl}?${query.toString()}`, {
          method: "GET",
          mode: "cors",
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) return null;
        const json = await res.json();
        if (!json || json.status !== "success" || !json.days) {
          return null;
        }
        return json;
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        return null;
      }
    }

    async bookViaAdminProxy(payload) {
      const proxyUrl = this.adminBookProxyUrl;
      if (!proxyUrl || typeof fetch !== "function") return null;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 55000) : null;
      try {
        const res = await fetch(proxyUrl, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Kinesica": "1",
          },
          body: JSON.stringify(Object.assign({}, payload, { action: "book", adminMode: true })),
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        const json = await res.json();
        if (json && json.status === "conflict") {
          const conflictErr = new Error(
            json.message || "El horario seleccionado acaba de ser reservado por otro paciente."
          );
          conflictErr.isConflict = true;
          throw conflictErr;
        }
        if (!res.ok || !json || json.status !== "success") {
          const msg = (json && (json.message || json.error)) || `Error admin book (${res.status})`;
          const err = new Error(msg);
          if (/requerid|inv[aá]lid|fuera del horario|anticipaci/i.test(msg)) {
            err.isValidation = true;
          }
          throw err;
        }
        return json;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        throw err;
      }
    }

    async bookViaBackup(payload) {
      const backupUrl = this.getBackupApiUrl();
      if (!backupUrl || typeof fetch !== "function") return null;
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;
      try {
        const res = await fetch(`${backupUrl}?action=book`, {
          method: "POST",
          mode: "cors",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, payload, { action: "book" })),
          signal: controller ? controller.signal : undefined,
        });
        if (timeoutId) clearTimeout(timeoutId);
        const json = await res.json();
        if (json && json.status === "conflict") {
          const conflictErr = new Error(
            json.message || "El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible."
          );
          conflictErr.isConflict = true;
          throw conflictErr;
        }
        if (!res.ok || !json || json.status !== "success") {
          return null;
        }
        return json;
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId);
        if (err && err.isConflict) throw err;
        return null;
      }
    }

    setApiUrl(url) {
      this.apiUrl = url;
      this.isMock = !url;
      this._slotsCache = {};
    }

    setForceMock(force) {
      this.isMock = force;
    }

    hasCachedSlots(dateStr) {
      if (this.isMock) return true;
      const cacheKey = `${dateStr}_session`;
      if (this._slotsCache && this._slotsCache[cacheKey]) return true;
      const stored = readStoredRange();
      return Boolean(stored && stored.days && stored.days[dateStr]);
    }

    /**
     * Precalienta la conexión con Google Apps Script en segundo plano (fire-and-forget).
     * Reduce drásticamente la latencia de cold-start antes de que el usuario elija fecha.
     */
    prewarm() {
      if (this.isMock) return;
      const now = Date.now();
      const last = typeof window !== "undefined" ? window.__kinesicaPrewarmAt || 0 : this._prewarmedAt || 0;
      if (now - last < 90000) return;
      if (typeof window !== "undefined") window.__kinesicaPrewarmAt = now;
      this._prewarmedAt = now;
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

      // El webhook ignora profesional y técnica: un solo calendario del consultorio.
      const cacheKey = `${dateStr}_${appointmentType}`;

      // 1. Revisar caché en memoria (validez TTL para respuesta instantánea)
      this._slotsCache = this._slotsCache || {};
      const cached = this._slotsCache[cacheKey];
      if (!forceRefresh && cached && Date.now() - cached.timestamp < RANGE_TTL_MS) {
        return cached.data;
      }

      // 2. Revisar sessionStorage (donde se guardó el rango de 2 semanas de la consulta de fondo o previa)
      if (!forceRefresh) {
        const stored = readStoredRange();
        if (stored && stored.days && stored.days[dateStr]) {
          applyStoredDays(this._slotsCache, stored.days, stored.at);
          const warmed = this._slotsCache[cacheKey];
          if (warmed) return warmed.data;
        }
      }

      // 3. Si hay una consulta de rango en vuelo (warmAgenda o prefetch), esperarla
      const rangePromise = typeof window !== "undefined" ? window.__kinesicaSlotsRangePromise : null;
      if (!forceRefresh && rangePromise) {
        try {
          await rangePromise;
        } catch (e) {}
        const warmed = this._slotsCache[cacheKey];
        if (warmed && Date.now() - warmed.timestamp < RANGE_TTL_MS) {
          return warmed.data;
        }
        const stored = readStoredRange();
        if (stored && stored.days && stored.days[dateStr]) {
          applyStoredDays(this._slotsCache, stored.days, stored.at);
          const fromStored = this._slotsCache[cacheKey];
          if (fromStored) return fromStored.data;
        }
      }

      // 4. Si ya hay una petición idéntica en vuelo, reutilizar la misma Promise (anti-duplicación)
      this._inFlightSlots = this._inFlightSlots || {};
      if (!forceRefresh && this._inFlightSlots[cacheKey]) {
        return this._inFlightSlots[cacheKey];
      }

      const effectiveUrl = this.getEffectiveApiUrl();
      const hoursParam = encodeURIComponent(currentHoursSignature());
      const url = `${effectiveUrl}?action=get_slots&date=${encodeURIComponent(dateStr)}&type=session&hours=${hoursParam}`;

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
          if (!Array.isArray(json.availableSlots)) {
            throw new Error("Respuesta inválida del servidor de agenda: 'availableSlots' no es un arreglo");
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
          try {
            const result = await fetchWithRetry(0);
            this._slotsCache[cacheKey] = {
              data: result,
              timestamp: Date.now(),
            };
            this.syncBackupSlots({ date: dateStr, availableSlots: result.availableSlots });
            return result;
          } catch (primaryErr) {
            const backupResult = await this.fetchSlotsFromBackup(dateStr, options);
            if (backupResult) {
              this._slotsCache[cacheKey] = {
                data: backupResult,
                timestamp: Date.now(),
              };
              return backupResult;
            }
            throw primaryErr;
          }
        } finally {
          delete this._inFlightSlots[cacheKey];
        }
      })();

      this._inFlightSlots[cacheKey] = reqPromise;
      return reqPromise;
    }

    /**
     * Una sola ida al script para varios días. Llena la misma caché que getAvailableSlots.
     * Si la implementación publicada todavía no tiene la acción, devuelve false.
     */
    async getSlotsRange(dateList) {
      const dates = (dateList || []).filter(Boolean);
      if (!dates.length) return false;
      if (this.isMock) {
        await Promise.all(dates.map((dateStr) => this.getAvailableSlots(dateStr, "session")));
        return true;
      }
      if (this._rangeUnsupported) return false;

      const from = dates[0];
      const to = dates[dates.length - 1];
      const stored = readStoredRange();
      if (storedRangeCovers(stored, from, to)) {
        applyStoredDays(this._slotsCache, stored.days, stored.at);
        return true;
      }
      if (typeof window !== "undefined" && window.__kinesicaSlotsRangePromise) {
        const ok = await window.__kinesicaSlotsRangePromise;
        const shared = readStoredRange();
        if (shared) applyStoredDays(this._slotsCache, shared.days, shared.at);
        return ok && storedRangeCovers(shared, from, to);
      }

      const effectiveUrl = this.getEffectiveApiUrl();
      const hoursParam = encodeURIComponent(currentHoursSignature());
      const url = `${effectiveUrl}?action=get_slots_range&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&hours=${hoursParam}`;

      const promise = (async () => {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
        try {
          const res = await fetch(url, {
            method: "GET",
            mode: "cors",
            redirect: "follow",
            signal: controller ? controller.signal : undefined,
          });
          if (timeoutId) clearTimeout(timeoutId);
          const json = await res.json();
          if (!json || json.status === "error" || !json.days) {
            const message = json && json.message ? json.message : "";
            if (message.indexOf("no reconocida") !== -1) {
              this._rangeUnsupported = true;
              return false;
            }
            const backupRange = await this.fetchSlotsRangeFromBackup(from, to);
            if (backupRange && backupRange.days) {
              const now = Date.now();
              applyStoredDays(this._slotsCache, backupRange.days, now);
              writeStoredRange(from, to, backupRange.days);
              return true;
            }
            return false;
          }
          const now = Date.now();
          applyStoredDays(this._slotsCache, json.days, now);
          writeStoredRange(from, to, json.days);
          this.syncBackupSlots({ days: json.days });
          return true;
        } catch (err) {
          if (timeoutId) clearTimeout(timeoutId);
          const backupRange = await this.fetchSlotsRangeFromBackup(from, to);
          if (backupRange && backupRange.days) {
            const now = Date.now();
            applyStoredDays(this._slotsCache, backupRange.days, now);
            writeStoredRange(from, to, backupRange.days);
            return true;
          }
          return false;
        } finally {
          if (typeof window !== "undefined") window.__kinesicaSlotsRangePromise = null;
          this._rangeInFlight = null;
        }
      })();

      if (typeof window !== "undefined") window.__kinesicaSlotsRangePromise = promise;
      this._rangeInFlight = { promise };
      return promise;
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
     * Si Google Calendar falla por caída o timeout, conmuta de forma 100% transparente al Modo Respaldo.
     */
    async bookAppointment(data) {
      // Validación previa en cliente usando el motor de reglas
      const validation = engine.validateBookingRequest(data);
      if (!validation.isValid) {
        throw new Error(validation.errors.join("\n"));
      }

      // Admin: secret solo en servidor (booking_admin_book.php). No enviar adminMode a GAS público.
      if (data && data.adminMode && this.adminBookProxyUrl) {
        if (!data.bookingRequestId) data.bookingRequestId = createBookingRequestId();
        try {
          const adminResult = await this.bookViaAdminProxy(data);
          if (adminResult) {
            this.clearCache();
            return adminResult;
          }
        } catch (adminErr) {
          if (adminErr && (adminErr.isConflict || adminErr.isValidation)) throw adminErr;
          // Fallback al espejo local con sesión admin (calendar_backup valida sesión).
          const backupResult = await this.bookViaBackup(data);
          if (backupResult) {
            this.clearCache();
            return backupResult;
          }
          throw adminErr || new Error("Error al registrar la cita (admin)");
        }
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
      const hoursSig = currentHoursSignature();
      // Se conserva en el objeto para que un reintento tras un timeout sea idempotente.
      if (!data.bookingRequestId) data.bookingRequestId = createBookingRequestId();
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
      });

      const url = `${effectiveUrl}?${query.toString()}`;
      const payload = Object.assign({ action: "book", hours: hoursSig }, data);

      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      // El script crea el evento y después avisa por WhatsApp. 25s cortaba la espera con el turno ya agendado.
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
            this.clearCache();
            return json;
          }
          if (json && json.status === "conflict") {
            const conflictErr = new Error(json.message || "El horario seleccionado acaba de ser reservado por otro paciente.");
            conflictErr.isConflict = true;
            throw conflictErr;
          }
          const msg = (json && json.message) || "Error al registrar la cita en Google Calendar";
          // Si es un error de validación de reglas (horario inválido, fecha pasada), no usar respaldo
          if (/fuera del horario|anticipaci[oó]n|fechas pasadas|requerid|inv[aá]lid/i.test(msg)) {
            const valErr = new Error(msg);
            valErr.isValidation = true;
            throw valErr;
          }
          primaryError = new Error(msg);
        } catch (parseOrLogicErr) {
          if (parseOrLogicErr && (parseOrLogicErr.isConflict || parseOrLogicErr.isValidation)) {
            throw parseOrLogicErr;
          }
          primaryError = parseOrLogicErr;
        }
      } else if (!primaryError) {
        primaryError = new Error(`Error de comunicación con el servidor (${res ? res.status : "sin respuesta"})`);
      }

      // Nivel 2: Conmutación silenciosa al Modo Respaldo (auditoría a Norberto)
      const backupResult = await this.bookViaBackup(payload);
      if (backupResult) {
        this.clearCache();
        return backupResult;
      }

      const finalErr = primaryError || new Error("Error al registrar la cita");
      finalErr.bothSystemsFailed = true;
      throw finalErr;
    }

    clearCache() {
      this._slotsCache = {};
      clearStoredRange();
    }
  }

  return {
    BookingClient: BookingClient,
    getMockEvents: getMockEvents,
    saveMockEvents: saveMockEvents,
    clearStoredRange: clearStoredRange,
  };
});
