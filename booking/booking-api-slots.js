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
    root.KinesicaBookingApiSlots = factory(
      root.KinesicaBookingEngine,
      root.KinesicaBookingApiStorage,
      root.KinesicaBookingApiBackup
    );
  }
})(typeof self !== "undefined" ? self : this, function (engine, storage, backup) {
  "use strict";

  const getMockEvents = storage ? storage.getMockEvents : function () { return []; };
  const readStoredRange = storage ? storage.readStoredRange : function () { return null; };
  const applyStoredDays = storage ? storage.applyStoredDays : function () {};
  const currentHoursSignature = storage ? storage.currentHoursSignature : function () { return ""; };
  const RANGE_TTL_MS = storage ? storage.RANGE_TTL_MS : 300000;

  async function fetchAvailableSlots(client, dateStr, appointmentType, options) {
    options = options || {};
    const forceRefresh = options.forceRefresh === true;
    const maxRetries = typeof options.maxRetries === "number" ? options.maxRetries : 2;

    if (client.isMock) {
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

    const cacheKey = `${dateStr}_${appointmentType}`;
    client._slotsCache = client._slotsCache || {};
    const cached = client._slotsCache[cacheKey];
    if (!forceRefresh && cached && Date.now() - cached.timestamp < RANGE_TTL_MS) {
      return cached.data;
    }

    if (!forceRefresh) {
      const stored = readStoredRange();
      if (stored && stored.days && stored.days[dateStr]) {
        applyStoredDays(client._slotsCache, stored.days, stored.at);
        const warmed = client._slotsCache[cacheKey];
        if (warmed) return warmed.data;
      }
    }

    const rangePromise = typeof window !== "undefined" ? window.__kinesicaSlotsRangePromise : null;
    if (!forceRefresh && rangePromise) {
      try {
        await rangePromise;
      } catch (e) {}
      const warmed = client._slotsCache[cacheKey];
      if (warmed && Date.now() - warmed.timestamp < RANGE_TTL_MS) {
        return warmed.data;
      }
      const stored = readStoredRange();
      if (stored && stored.days && stored.days[dateStr]) {
        applyStoredDays(client._slotsCache, stored.days, stored.at);
        const fromStored = client._slotsCache[cacheKey];
        if (fromStored) return fromStored.data;
      }
    }

    client._inFlightSlots = client._inFlightSlots || {};
    if (!forceRefresh && client._inFlightSlots[cacheKey]) {
      return client._inFlightSlots[cacheKey];
    }

    const effectiveUrl = client.getEffectiveApiUrl();
    const hoursParam = encodeURIComponent(currentHoursSignature());
    const url = `${effectiveUrl}?action=get_slots&date=${encodeURIComponent(dateStr)}&type=session&hours=${hoursParam}`;

    const fetchWithRetry = async (attempt) => {
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

        if (attempt < maxRetries && isTransientError) {
          const delay = (attempt + 1) * 600;
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
          client._slotsCache[cacheKey] = {
            data: result,
            timestamp: Date.now(),
          };
          if (backup && typeof backup.syncBackupSlots === "function") {
            backup.syncBackupSlots(client, { date: dateStr, availableSlots: result.availableSlots });
          }
          return result;
        } catch (primaryErr) {
          if (backup && typeof backup.fetchSlotsFromBackup === "function") {
            const backupResult = await backup.fetchSlotsFromBackup(client, dateStr, options);
            if (backupResult) {
              client._slotsCache[cacheKey] = {
                data: backupResult,
                timestamp: Date.now(),
              };
              return backupResult;
            }
          }
          throw primaryErr;
        }
      } finally {
        delete client._inFlightSlots[cacheKey];
      }
    })();

    client._inFlightSlots[cacheKey] = reqPromise;
    return reqPromise;
  }

  return {
    fetchAvailableSlots,
  };
});
