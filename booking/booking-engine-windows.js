/**
 * Kinésica - Ventanas de Atención, Cesiones y Bajas por Profesional
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine-config"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine-config"));
  } else {
    root.KinesicaBookingEngineWindows = factory(root.KinesicaBookingEngineConfig);
  }
})(typeof self !== "undefined" ? self : this, function (cfg) {
  "use strict";

  const SESSION_DURATION_MINUTES = cfg.SESSION_DURATION_MINUTES;
  const MAX_BOOKING_DAYS = cfg.MAX_BOOKING_DAYS;
  const PRACTITIONERS = cfg.PRACTITIONERS;
  const PRACTITIONER_HOURS = cfg.PRACTITIONER_HOURS;
  const parseHmToMinutes = cfg.parseHmToMinutes;
  const parseLocalDate = cfg.parseLocalDate;
  const formatDateIso = cfg.formatDateIso;

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

  /** Fin de baja activa (end_date ≥ hoy), o null si no hay. */
  function getActiveLeaveEndIso(practitionerId, customOverrides) {
    if (!practitionerId) return null;
    const pid = String(practitionerId).toLowerCase().trim();
    const today = formatDateIso(new Date());
    const overridesList = Array.isArray(customOverrides) ? customOverrides : cfg.getScheduleOverrides();
    let endIso = null;
    overridesList.forEach(function (ov) {
      if (!ov || ov.active === false || ov.action !== "transfer") return;
      if (ov.practitioner_on_leave !== true) return;
      if (String(ov.from_practitioner || "").toLowerCase() !== pid) return;
      const start = String(ov.start_date || "").trim();
      const end = String(ov.end_date || start).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < today) return;
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && start > today) {
        const startDate = parseLocalDate(start);
        const limit = new Date();
        limit.setDate(limit.getDate() + MAX_BOOKING_DAYS);
        if (startDate > limit) return;
      }
      if (!endIso || end > endIso) endIso = end;
    });
    return endIso;
  }

  /** true si la técnica solo la ofrecen profesionales con baja activa (end ≥ hoy). */
  function isTechniqueBlockedByActiveLeave(techniqueId, customOverrides) {
    const technique = cfg.getTechnique(techniqueId);
    if (!technique || technique.bySchedule || technique.internal) return false;
    const pracs = Array.isArray(technique.practitioners) ? technique.practitioners : [];
    if (pracs.length === 0) return false;
    return pracs.every(function (pid) {
      return Boolean(getActiveLeaveEndIso(pid, customOverrides));
    });
  }

  function techniquePractitionerCandidates(techniqueId) {
    const technique = cfg.getTechnique(techniqueId);
    if (!technique) return [];
    if (technique.bySchedule) return Object.keys(PRACTITIONERS);
    return Array.isArray(technique.practitioners) ? technique.practitioners.slice() : [];
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

  return {
    getWorkingWindows,
    isPractitionerOnLeave,
    getActiveLeaveEndIso,
    isTechniqueBlockedByActiveLeave,
    isTechniqueOfferedOnDate,
    practitionersAvailableOnDate,
    practitionersBookableForTechnique,
  };
});
