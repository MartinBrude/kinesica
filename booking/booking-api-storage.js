(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"));
  } else {
    root.KinesicaBookingApiStorage = factory(root.KinesicaBookingEngine);
  }
})(typeof self !== "undefined" ? self : this, function (engine) {
  "use strict";

  const MOCK_STORAGE_KEY = "kinesica_mock_calendar_events";

  const MOCK_HABITUAL_PATIENTS = [
    { telefono: "5491100001111", nombre: "Paciente Demo Uno" },
    { telefono: "5491100002222", nombre: "Paciente Demo Dos" },
  ];

  function isStaticPreviewHost() {
    if (typeof location === "undefined") return false;
    if (location.protocol === "file:") return true;
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

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

    const today = new Date();
    return [
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
  }

  function saveMockEvents(events) {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(events));
    } catch (e) {}
  }

  const RANGE_STORAGE_KEY = "kinesica_slots_range_v1";
  const RANGE_TTL_MS = 300000;

  function currentHoursSignature() {
    try {
      const h = engine && typeof engine.getPractitionerHours === "function"
        ? engine.getPractitionerHours()
        : (engine && engine.PRACTITIONER_HOURS) || {};
      const ov = engine && typeof engine.getScheduleOverrides === "function"
        ? engine.getScheduleOverrides()
        : [];
      return JSON.stringify({ h, ov });
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

  return {
    MOCK_STORAGE_KEY,
    MOCK_HABITUAL_PATIENTS,
    isStaticPreviewHost,
    createBookingRequestId,
    getMockEvents,
    saveMockEvents,
    RANGE_STORAGE_KEY,
    RANGE_TTL_MS,
    currentHoursSignature,
    clearStoredRange,
    readStoredRange,
    writeStoredRange,
    storedRangeCovers,
    applyStoredDays,
  };
});
