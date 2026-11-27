/**
 * Kinésica - Cálculo de Slots Disponibles (delega ventanas/bajas a booking-engine-windows.js).
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine-config", "./booking-engine-windows"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./booking-engine-config"),
      require("./booking-engine-windows")
    );
  } else {
    root.KinesicaBookingEngineSlots = factory(
      root.KinesicaBookingEngineConfig,
      root.KinesicaBookingEngineWindows
    );
  }
})(typeof self !== "undefined" ? self : this, function (cfg, winMod) {
  "use strict";

  const SESSION_DURATION_MINUTES = cfg.SESSION_DURATION_MINUTES;
  const SESSION_BUFFER_HOURS = cfg.SESSION_BUFFER_HOURS;
  const SLOT_STEP_MINUTES = cfg.SLOT_STEP_MINUTES;
  const MAX_BOOKING_DAYS = cfg.MAX_BOOKING_DAYS;
  const PRACTITIONERS = cfg.PRACTITIONERS;
  const parseHmToMinutes = cfg.parseHmToMinutes;
  const parseLocalDate = cfg.parseLocalDate;
  const formatDateIso = cfg.formatDateIso;
  const formatTime = cfg.formatTime;
  const getWorkingWindows = winMod.getWorkingWindows;

  function practitionersAt(dateInput, timeHm, customOverrides) {
    const timeMin = parseHmToMinutes(timeHm);
    return Object.keys(PRACTITIONERS).filter(function (id) {
      return getWorkingWindows(id, dateInput, customOverrides).some(function (w) {
        return timeMin >= w.startMin && timeMin + SESSION_DURATION_MINUTES <= w.endMin;
      });
    });
  }

  function eventBlocksPractitioner() {
    // Un solo consultorio: cualquier turno ocupa el horario para los dos.
    return true;
  }

  function normalizeBusyIntervals(events) {
    if (!Array.isArray(events)) return [];
    return events.map(function (ev) {
      const start = new Date(ev.start || ev.startTime || ev);
      const end = new Date(ev.end || ev.endTime || ev);
      return { start: start.getTime(), end: end.getTime() };
    });
  }

  function createSlotCalculator(isBusinessDay) {
    return function calculateAvailableSlots(options) {
      if (!options || !options.date) return [];
      const durationMinutes = SESSION_DURATION_MINUTES;
      const practitionerId = options.practitionerId || null;

      let baseDate;
      if (typeof options.date === "string") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date.trim())) return [];
        baseDate = parseLocalDate(options.date.trim());
      } else {
        baseDate = new Date(options.date);
      }
      if (isNaN(baseDate.getTime()) || !isBusinessDay(baseDate, options.holidays)) return [];

      const now = options.now ? new Date(options.now) : new Date();
      const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const targetZero = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      const diffDays = Math.round((targetZero.getTime() - todayZero.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays > MAX_BOOKING_DAYS) return [];

      const overrides = options.overrides || cfg.getScheduleOverrides();
      const windows = getWorkingWindows(practitionerId, baseDate, overrides);
      if (!windows.length) return [];

      const rawBusy = Array.isArray(options.busyIntervals) ? options.busyIntervals : [];
      const busy = normalizeBusyIntervals(rawBusy.filter(function (ev) {
        return eventBlocksPractitioner(ev, practitionerId);
      }));

      const isToday = formatDateIso(baseDate) === formatDateIso(now);
      const minAllowedTime = isToday ? now.getTime() + SESSION_BUFFER_HOURS * 60 * 60 * 1000 : 0;
      const slots = [];

      windows.forEach(function (windowRange) {
        let minute = windowRange.startMin;
        while (minute + durationMinutes <= windowRange.endMin) {
          const current = new Date(baseDate);
          current.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
          const slotStart = current.getTime();
          const slotEnd = slotStart + durationMinutes * 60 * 1000;

          if (slotStart >= minAllowedTime) {
            const overlaps = busy.some(function (b) { return slotStart < b.end && slotEnd > b.start; });
            if (!overlaps) {
              const onDuty = practitionerId || (practitionersAt(baseDate, formatTime(current), overrides)[0] || null);
              slots.push({
                time: formatTime(current),
                startIso: new Date(slotStart).toISOString(),
                endIso: new Date(slotEnd).toISOString(),
                durationMinutes,
                practitionerId: onDuty,
              });
            }
          }
          minute += SLOT_STEP_MINUTES;
        }
      });

      return slots;
    };
  }

  return {
    getWorkingWindows: winMod.getWorkingWindows,
    practitionersAt,
    isPractitionerOnLeave: winMod.isPractitionerOnLeave,
    getActiveLeaveEndIso: winMod.getActiveLeaveEndIso,
    isTechniqueBlockedByActiveLeave: winMod.isTechniqueBlockedByActiveLeave,
    isTechniqueOfferedOnDate: winMod.isTechniqueOfferedOnDate,
    practitionersAvailableOnDate: winMod.practitionersAvailableOnDate,
    practitionersBookableForTechnique: winMod.practitionersBookableForTechnique,
    createSlotCalculator,
  };
});
