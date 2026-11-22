/**
 * Kinésica - Validación de Solicitudes de Reserva
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine-config"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine-config"));
  } else {
    root.KinesicaBookingEngineValidate = factory(root.KinesicaBookingEngineConfig);
  }
})(typeof self !== "undefined" ? self : this, function (cfg) {
  "use strict";

  const SESSION_DURATION_MINUTES = cfg.SESSION_DURATION_MINUTES;
  const MAX_BOOKING_DAYS = cfg.MAX_BOOKING_DAYS;
  const PRACTITIONERS = cfg.PRACTITIONERS;
  const parseLocalDate = cfg.parseLocalDate;
  const parseHmToMinutes = cfg.parseHmToMinutes;
  const getTechnique = cfg.getTechnique;
  const practitionerOffersTechnique = cfg.practitionerOffersTechnique;

  function isValidEmailAddress(raw) {
    const s = String(raw || "").trim();
    if (!s || s.length > 120 || /\s/.test(s)) return false;
    const parts = s.split("@");
    if (parts.length !== 2) return false;
    const local = parts[0];
    const domain = parts[1];
    if (!local || !domain || local.length > 64 || domain.length > 253) return false;
    if (local.startsWith(".") || local.endsWith(".") || local.indexOf("..") !== -1) return false;
    if (domain.startsWith(".") || domain.endsWith(".") || domain.indexOf("..") !== -1) return false;
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
    const labels = domain.split(".");
    if (labels.length < 2) return false;
    const tld = labels[labels.length - 1];
    if (!/^[A-Za-z]{2,24}$/.test(tld)) return false;
    return labels.every(function (lbl) {
      return lbl.length > 0 && lbl.length <= 63 && /^[A-Za-z0-9-]+$/.test(lbl) && !lbl.startsWith("-") && !lbl.endsWith("-");
    });
  }

  function createRequestValidator(deps) {
    const isBusinessDay = deps.isBusinessDay;
    const getWorkingWindows = deps.getWorkingWindows;
    const practitionersAt = deps.practitionersAt;

    return function validateBookingRequest(req) {
      const errors = [];

      if (!req.nombre || req.nombre.trim().length < 3 || req.nombre.trim().length > 120) {
        errors.push("El nombre y apellido completo es obligatorio (mínimo 3 caracteres).");
      }

      const cleanPhone = String(req.telefono || "").replace(/[^0-9]/g, "");
      if (!cleanPhone || cleanPhone.length < 6 || cleanPhone.length > 16 || /^(\d)\1+$/.test(cleanPhone)) {
        errors.push("El número de teléfono o WhatsApp ingresado no es válido.");
      }

      if (req.email !== undefined && req.email !== null && String(req.email).trim() !== "") {
        if (!isValidEmailAddress(String(req.email).trim())) {
          errors.push("El correo electrónico ingresado no es válido.");
        }
      }

      if (!req.date || !req.time) {
        errors.push("Debes seleccionar una fecha y horario.");
      } else {
        const parts = req.date.split("-");
        if (parts.length === 3) {
          const d = parseLocalDate(req.date);
          if (!isBusinessDay(d)) {
            errors.push("La fecha seleccionada no es un día hábil de atención (lunes a viernes).");
          }
          const today = req.now ? new Date(req.now) : new Date();
          const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const targetZero = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays > MAX_BOOKING_DAYS) {
            errors.push(`Los turnos se pueden solicitar a un máximo de ${MAX_BOOKING_DAYS} días.`);
          }
        }
      }

      if (req.appointmentType === "call") {
        errors.push("Ya no se agendan llamadas. Elegí un turno presencial de 1 hora.");
      }

      const technique = getTechnique(req.techniqueId);
      if (!technique) {
        errors.push("Elegí la técnica de la sesión.");
      } else if (technique.bySchedule) {
        if (req.practitionerId && !PRACTITIONERS[req.practitionerId]) {
          errors.push("Elegí un horario de atención.");
        } else if (req.date && req.time && practitionersAt(req.date, req.time).length === 0) {
          errors.push("Ese horario está fuera del día de atención.");
        }
      } else if (req.practitionerId && (!PRACTITIONERS[req.practitionerId] || !practitionerOffersTechnique(req.practitionerId, req.techniqueId))) {
        errors.push("Esa técnica no la atiende el profesional elegido.");
      } else if (!req.practitionerId && technique.practitioners.length < 2) {
        errors.push("Elegí el profesional de la sesión.");
      }

      if (technique && !technique.bySchedule && req.date && req.time && req.practitionerId && PRACTITIONERS[req.practitionerId]) {
        const windows = getWorkingWindows(req.practitionerId, req.date);
        const timeMin = parseHmToMinutes(req.time);
        const fits = windows.some(function (w) {
          return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
        });
        if (!fits) errors.push("Ese horario está fuera del día de atención del profesional.");
      } else if (technique && !technique.bySchedule && req.date && req.time && !req.practitionerId) {
        const timeMin = parseHmToMinutes(req.time);
        const fitsAny = technique.practitioners.some(function (pid) {
          return getWorkingWindows(pid, req.date).some(function (w) {
            return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
          });
        });
        if (!fitsAny) errors.push("Ese horario está fuera del horario de atención del consultorio.");
      }

      return { isValid: errors.length === 0, errors };
    };
  }

  return {
    isValidEmailAddress,
    createRequestValidator,
  };
});
