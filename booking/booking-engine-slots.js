/**
 * Kinésica - Ventanas de Atención y Cálculo de Slots Disponibles
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine-config"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine-config"));
  } else {
    root.KinesicaBookingEngineSlots = factory(root.KinesicaBookingEngineConfig);
  }
})(typeof self !== "undefined" ? self : this, function (cfg) {
  "use strict";

  const SESSION_DURATION_MINUTES = cfg.SESSION_DURATION_MINUTES;
  const SESSION_BUFFER_HOURS = cfg.SESSION_BUFFER_HOURS;
  const SLOT_STEP_MINUTES = cfg.SLOT_STEP_MINUTES;
  const MAX_BOOKING_DAYS = cfg.MAX_BOOKING_DAYS;
  const PRACTITIONERS = cfg.PRACTITIONERS;
  const PRACTITIONER_HOURS = cfg.PRACTITIONER_HOURS;
  const parseHmToMinutes = cfg.parseHmToMinutes;
  const parseLocalDate = cfg.parseLocalDate;
  const formatDateIso = cfg.formatDateIso;
  const formatTime = cfg.formatTime;

  function subtractTimeWindow(windows, cutStartMin, cutEndMin) {
    const result = [];
    windows.forEach(function (w) {
      if (cutEndMin <= w.startMin || cutStartMin >= w.endMin) {
        result.push(w);
        return;
      }
      if (cutStartMin > w.startMin && (cutStartMin - w.startMin) >= SESSION_DURATION_MINUTES) {
        result.push({ startMin: w.startMin, endMin: cutStartMin });
      }
      if (cutEndMin < w.endMin && (w.endMin - cutEndMin) >= SESSION_DURATION_MINUTES) {
        result.push({ startMin: cutEndMin, endMin: w.endMin });
      }
    });
    return result;
  }

  function mergeTimeWindows(w1, w2) {
    const all = w1.concat(w2);
    if (all.length <= 1) return all;
    all.sort(function (a, b) { return a.startMin - b.startMin; });
    const merged = [];
    let curr = Object.assign({}, all[0]);
    for (let i = 1; i < all.length; i++) {
      const next = all[i];
      if (next.startMin <= curr.endMin) {
        curr.endMin = Math.max(curr.endMin, next.endMin);
      } else {
        merged.push(curr);
        curr = Object.assign({}, next);
      }
    }
    merged.push(curr);
    return merged;
  }

  function isPractitionerOnLeave(practitionerId, dateInput, customOverrides) {
    if (!practitionerId || !dateInput) return false;
    let isoDate;
    if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      isoDate = dateInput.trim();
    } else {
      const d = typeof dateInput === "string" ? parseLocalDate(dateInput) : new Date(dateInput);
      if (isNaN(d.getTime())) return false;
      isoDate = formatDateIso(d);
    }
    const pid = String(practitionerId).toLowerCase().trim();
    const overridesList = Array.isArray(customOverrides) ? customOverrides : cfg.getScheduleOverrides();
    return overridesList.some(function (ov) {
      return ov
        && ov.active !== false
        && ov.action === "transfer"
        && ov.practitioner_on_leave === true
        && String(ov.from_practitioner || "").toLowerCase() === pid
        && isoDate >= ov.start_date
        && isoDate <= ov.end_date;
    });
  }

  function techniquePractitionerCandidates(techniqueId) {
    const technique = cfg.getTechnique(techniqueId);
    if (!technique) return [];
    if (technique.bySchedule) return Object.keys(PRACTITIONERS);
    return Array.isArray(technique.practitioners) ? technique.practitioners.slice() : [];
  }

  function practitionersAvailableOnDate(techniqueId, dateInput, customOverrides) {
    return techniquePractitionerCandidates(techniqueId).filter(function (pid) {
      if (isPractitionerOnLeave(pid, dateInput, customOverrides)) return false;
      return getWorkingWindows(pid, dateInput, customOverrides).length > 0;
    });
  }

  function isTechniqueOfferedOnDate(techniqueId, dateInput, customOverrides) {
    return practitionersAvailableOnDate(techniqueId, dateInput, customOverrides).length > 0;
  }

  /** Profesionales de la técnica con al menos un día hábil con ventanas en el horizonte de reserva. */
  function practitionersBookableForTechnique(techniqueId, customOverrides) {
    const candidates = techniquePractitionerCandidates(techniqueId);
    if (candidates.length === 0) return [];
    const remaining = {};
    candidates.forEach(function (pid) { remaining[pid] = true; });
    const found = [];
    const now = new Date();
    for (let i = 0; i < MAX_BOOKING_DAYS; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const still = Object.keys(remaining);
      if (still.length === 0) break;
      still.forEach(function (pid) {
        if (isPractitionerOnLeave(pid, d, customOverrides)) return;
        if (getWorkingWindows(pid, d, customOverrides).length > 0) {
          found.push(pid);
          delete remaining[pid];
        }
      });
    }
    return candidates.filter(function (pid) { return found.indexOf(pid) !== -1; });
  }

  function getWorkingWindows(practitionerId, dateInput, customOverrides) {
    if (!dateInput) return [];
    let d;
    if (typeof dateInput === "string") {
      d = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())
        ? parseLocalDate(dateInput.trim())
        : new Date(dateInput);
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return [];
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return [];

    const pid = practitionerId ? String(practitionerId).toLowerCase().trim() : "";
    const isoDate = formatDateIso(d);
    const overridesList = Array.isArray(customOverrides) ? customOverrides : cfg.getScheduleOverrides();
    const activeForDate = overridesList.filter(function (ov) {
      return ov && ov.active !== false && isoDate >= ov.start_date && isoDate <= ov.end_date;
    });

    const hasFullClosure = activeForDate.some(function (ov) {
      return ov.action === "closure" && (ov.time_scope === "all_day" || !ov.time_scope);
    });
    if (hasFullClosure) return [];

    const getBaseWindows = function (id) {
      const hours = PRACTITIONER_HOURS[id];
      if (!hours) return [];
      const ranges = hours[dow] || [];
      return ranges.map(function (range) {
        return { startMin: parseHmToMinutes(range.start), endMin: parseHmToMinutes(range.end) };
      });
    };

    if (pid) {
      let windows = getBaseWindows(pid);
      activeForDate.forEach(function (ov) {
        const ranges = Array.isArray(ov.custom_ranges) && ov.custom_ranges.length > 0
          ? ov.custom_ranges
          : (ov.custom_range ? [ov.custom_range] : []);
        if (ov.action === "closure" && ov.time_scope === "custom_hours") {
          ranges.forEach(function (r) {
            windows = subtractTimeWindow(windows, parseHmToMinutes(r.start), parseHmToMinutes(r.end));
          });
        } else if (ov.action === "transfer") {
          const from = ov.from_practitioner;
          const to = ov.to_practitioner;
          const scope = ov.time_scope || "all_day";
          const onLeave = ov.practitioner_on_leave === true;
          if (pid === from) {
            // De baja: ausente todo el día (no solo la franja cedida).
            if (onLeave || scope === "all_day") {
              windows = [];
            } else if (scope === "custom_hours") {
              ranges.forEach(function (r) {
                windows = subtractTimeWindow(windows, parseHmToMinutes(r.start), parseHmToMinutes(r.end));
              });
            }
          } else if (pid === to) {
            if (scope === "all_day") {
              windows = mergeTimeWindows(windows, getBaseWindows(from));
            } else if (scope === "custom_hours") {
              const added = ranges.map(function (r) {
                return { startMin: parseHmToMinutes(r.start), endMin: parseHmToMinutes(r.end) };
              });
              windows = mergeTimeWindows(windows, added);
            }
          }
        }
      });
      return windows;
    }

    const mWin = getWorkingWindows("maria", d, customOverrides);
    const nWin = getWorkingWindows("norberto", d, customOverrides);
    return mergeTimeWindows(mWin, nWin);
  }

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
    getWorkingWindows,
    practitionersAt,
    isPractitionerOnLeave,
    isTechniqueOfferedOnDate,
    practitionersAvailableOnDate,
    practitionersBookableForTechnique,
    createSlotCalculator,
  };
});
