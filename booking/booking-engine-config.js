/**
 * Kinésica - Configuración, Estado en Runtime y Helpers del Motor de Reservas
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.KinesicaBookingEngineConfig = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SESSION_DURATION_MINUTES = 60;
  const DAY_START_HOUR = 8;
  const DAY_END_HOUR = 20;
  const SESSION_BUFFER_HOURS = 2;
  const SAME_DAY_BUFFER_HOURS = 2;
  const SLOT_STEP_MINUTES = 30;
  const MAX_BOOKING_DAYS = 60;

  const PRACTITIONERS = {
    norberto: { id: "norberto", name: "Norberto", whatsapp: "5491161564311" },
    maria: { id: "maria", name: "María", whatsapp: "5491128531224" },
  };

  const FEATURED_TECHNIQUE_IDS = ["no-se", "osteopatia", "rpg", "atm"];
  const TECHNIQUES = [
    { id: "no-se", label: "No sé", bySchedule: true, practitioners: ["norberto", "maria"] },
    { id: "osteopatia", label: "Osteopatía", practitioners: ["norberto"] },
    { id: "rpg", label: "RPG", practitioners: ["norberto", "maria"] },
    { id: "atm", label: "ATM (Bruxismo / Mandíbula)", practitioners: ["norberto", "maria"] },
    { id: "acupuntura", label: "Acupuntura", practitioners: ["maria"] },
    { id: "neurodinamia", label: "Neurodinamia", practitioners: ["norberto", "maria"] },
    { id: "viscerales", label: "Manipulaciones viscerales (Barral)", practitioners: ["norberto"] },
    { id: "posturologia", label: "Posturología", practitioners: ["maria"] },
    { id: "paciente", label: "Paciente en tratamiento", internal: true, practitioners: ["norberto", "maria"] },
  ];

  const DEFAULT_FEES = {
    atm: 65000,
    general: 75000,
    payment_methods: "Efectivo o transferencia bancaria",
  };

  let runtimeFees = Object.assign({}, DEFAULT_FEES);

  function setRuntimeFees(fees) {
    if (fees && typeof fees === "object") {
      if (typeof fees.atm === "number" || (typeof fees.atm === "string" && !isNaN(Number(fees.atm)))) {
        runtimeFees.atm = Number(fees.atm);
      }
      if (typeof fees.general === "number" || (typeof fees.general === "string" && !isNaN(Number(fees.general)))) {
        runtimeFees.general = Number(fees.general);
      }
      if (typeof fees.payment_methods === "string" && fees.payment_methods.trim()) {
        runtimeFees.payment_methods = fees.payment_methods.trim();
      }
    }
    return Object.assign({}, runtimeFees);
  }

  function getRuntimeFees() {
    return Object.assign({}, runtimeFees);
  }

  function getFeeForTechnique(techniqueId) {
    return techniqueId === "atm" ? runtimeFees.atm : runtimeFees.general;
  }

  // Horario semanal por defecto por profesional (clave = día JS: 1 lunes … 5 viernes).
  const DEFAULT_PRACTITIONER_HOURS = {
    norberto: {
      1: [{ start: "17:30", end: "19:30" }],
      2: [{ start: "16:30", end: "19:30" }],
      3: [{ start: "09:00", end: "16:30" }],
      4: [{ start: "15:00", end: "19:00" }],
      5: [{ start: "13:30", end: "19:30" }],
    },
    maria: {
      1: [{ start: "09:00", end: "17:00" }],
      2: [{ start: "09:00", end: "16:00" }],
      5: [{ start: "09:00", end: "13:00" }],
    },
  };

  function clonePractitionerHours(source) {
    const src = source || DEFAULT_PRACTITIONER_HOURS;
    const out = { norberto: {}, maria: {} };
    ["norberto", "maria"].forEach(function (pid) {
      const pDays = (src && src[pid]) || {};
      Object.keys(pDays).forEach(function (dow) {
        const list = pDays[dow];
        if (Array.isArray(list) && list.length > 0) {
          out[pid][dow] = list.map(function (r) {
            return { start: String(r.start || ""), end: String(r.end || "") };
          });
        }
      });
    });
    return out;
  }

  const PRACTITIONER_HOURS = clonePractitionerHours(DEFAULT_PRACTITIONER_HOURS);
  let runtimeScheduleOverrides = [];

  function setScheduleOverrides(overrides) {
    if (Array.isArray(overrides)) {
      runtimeScheduleOverrides = overrides.filter(function (ov) {
        return ov && typeof ov === "object" && ov.active !== false;
      });
    } else {
      runtimeScheduleOverrides = [];
    }
    return runtimeScheduleOverrides.slice();
  }

  function getScheduleOverrides() {
    return runtimeScheduleOverrides.slice();
  }

  function resetScheduleOverrides() {
    runtimeScheduleOverrides = [];
    return [];
  }

  const DAY_NAMES_ES = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

  function minutesToHm(totalMin) {
    const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const m = String(totalMin % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function parseHmToMinutes(hm) {
    const parts = String(hm || "").split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
  }

  function isValidTimeFormat(hm) {
    return typeof hm === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(hm.trim());
  }

  function parseLocalDate(dateStr) {
    const parts = String(dateStr || "").split("-").map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return new Date(NaN);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (d.getFullYear() !== parts[0] || d.getMonth() !== parts[1] - 1 || d.getDate() !== parts[2]) {
      return new Date(NaN);
    }
    return d;
  }

  function formatDateIso(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatTime(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function getTechnique(techniqueId) {
    return TECHNIQUES.find(function (t) { return t.id === techniqueId; }) || null;
  }

  function practitionerOffersTechnique(practitionerId, techniqueId) {
    const technique = getTechnique(techniqueId);
    if (!technique || !PRACTITIONERS[practitionerId]) return false;
    if (technique.bySchedule) return true;
    return technique.practitioners.indexOf(practitionerId) !== -1;
  }

  return {
    SESSION_DURATION_MINUTES,
    DAY_START_HOUR,
    DAY_END_HOUR,
    SESSION_BUFFER_HOURS,
    SAME_DAY_BUFFER_HOURS,
    SLOT_STEP_MINUTES,
    MAX_BOOKING_DAYS,
    PRACTITIONERS,
    FEATURED_TECHNIQUE_IDS,
    TECHNIQUES,
    DEFAULT_FEES,
    setRuntimeFees,
    getRuntimeFees,
    getFeeForTechnique,
    DEFAULT_PRACTITIONER_HOURS,
    clonePractitionerHours,
    PRACTITIONER_HOURS,
    setScheduleOverrides,
    getScheduleOverrides,
    resetScheduleOverrides,
    DAY_NAMES_ES,
    minutesToHm,
    parseHmToMinutes,
    isValidTimeFormat,
    parseLocalDate,
    formatDateIso,
    formatTime,
    getTechnique,
    practitionerOffersTechnique,
  };
});
