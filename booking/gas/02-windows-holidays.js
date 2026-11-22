/**
 * Kinésica GAS — Ventanas de atención por profesional, overrides (cesiones/cierres) y feriados.
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 */

function gasToMinutes(hm) {
  const p = String(hm || "").split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1] || "0", 10);
}

function gasMinutesToHm(m) {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const min = String(m % 60).padStart(2, "0");
  return h + ":" + min;
}

function mergeGasWindows(w1, w2) {
  const all = (w1 || []).concat(w2 || []);
  if (all.length <= 1) return all;
  all.sort(function(a, b) { return gasToMinutes(a.start) - gasToMinutes(b.start); });
  const merged = [];
  let curr = { start: all[0].start, end: all[0].end };
  for (let i = 1; i < all.length; i++) {
    const next = all[i];
    if (gasToMinutes(next.start) <= gasToMinutes(curr.end)) {
      curr.end = gasMinutesToHm(Math.max(gasToMinutes(curr.end), gasToMinutes(next.end)));
    } else {
      merged.push(curr);
      curr = { start: next.start, end: next.end };
    }
  }
  merged.push(curr);
  return merged;
}

function extractGasOverrides(opts, params, customHoursRaw) {
  let ov = (opts && (opts.overrides || opts.schedule_overrides)) || (params && (params.overrides || params.schedule_overrides));
  if (typeof ov === "string") {
    try { ov = JSON.parse(ov); } catch (_) { ov = null; }
  }
  if (Array.isArray(ov)) return ov;
  if (customHoursRaw) {
    try {
      const parsed = typeof customHoursRaw === "string" ? JSON.parse(customHoursRaw) : customHoursRaw;
      if (parsed && Array.isArray(parsed.ov)) return parsed.ov;
    } catch (_) {}
  }
  return [];
}

function applyGasOverrides(windows, practitionerId, dateStr, overrides, baseHours) {
  if (!dateStr || !Array.isArray(overrides) || overrides.length === 0) return windows;
  const active = overrides.filter(function(ov) {
    return ov && ov.active !== false && dateStr >= ov.start_date && dateStr <= ov.end_date;
  });
  if (active.length === 0) return windows;

  const hasClosure = active.some(function(ov) {
    return ov.action === "closure" && (ov.time_scope === "all_day" || !ov.time_scope);
  });
  if (hasClosure) return [];

  function subWin(wins, cutS, cutE) {
    const res = [];
    const cs = gasToMinutes(cutS);
    const ce = gasToMinutes(cutE);
    wins.forEach(function(w) {
      const ws = gasToMinutes(w.start);
      const we = gasToMinutes(w.end);
      if (ce <= ws || cs >= we) { res.push(w); return; }
      if (cs > ws && (cs - ws) >= 60) res.push({ start: gasMinutesToHm(ws), end: gasMinutesToHm(cs) });
      if (ce < we && (we - ce) >= 60) res.push({ start: gasMinutesToHm(ce), end: gasMinutesToHm(we) });
    });
    return res;
  }

  let res = windows.slice();
  active.forEach(function(ov) {
    const ranges = Array.isArray(ov.custom_ranges) && ov.custom_ranges.length > 0
      ? ov.custom_ranges
      : (ov.custom_range ? [ov.custom_range] : []);
    if (ov.action === "closure" && ov.time_scope === "custom_hours") {
      ranges.forEach(function(r) {
        res = subWin(res, r.start, r.end);
      });
    } else if (ov.action === "transfer") {
      const from = ov.from_practitioner;
      const to = ov.to_practitioner;
      const scope = ov.time_scope || "all_day";
      const onLeave = ov.practitioner_on_leave === true;
      if (practitionerId === from) {
        // De baja: ausente todo el día (disciplinas exclusivas no se ofrecen).
        if (onLeave || scope === "all_day") {
          res = [];
        } else if (scope === "custom_hours") {
          ranges.forEach(function(r) {
            res = subWin(res, r.start, r.end);
          });
        }
      } else if (practitionerId === to) {
        if (scope === "all_day" && baseHours && baseHours[from]) {
          const dayKey = String(new Date(dateStr + "T12:00:00Z").getUTCDay());
          const ceded = baseHours[from][dayKey] || [];
          res = mergeGasWindows(res, ceded);
        } else if (scope === "custom_hours") {
          res = mergeGasWindows(res, ranges);
        }
      }
    }
  });
  return res;
}

function getGasWorkingWindows(practitionerId, dayOfWeek, customHoursRaw, opts) {
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];
  const activeHours = resolveActivePractitionerHours(customHoursRaw, opts);
  const dayKey = String(dayOfWeek);
  const pid = practitionerId ? String(practitionerId).toLowerCase().trim() : "";
  const overrides = extractGasOverrides(opts, null, customHoursRaw);

  if (pid && activeHours[pid]) {
    const baseWindows = (activeHours[pid][dayKey] || activeHours[pid][dayOfWeek] || []).slice();
    if (opts && opts.date && overrides.length > 0) {
      return applyGasOverrides(baseWindows, pid, opts.date, overrides, activeHours);
    }
    return baseWindows;
  }

  const mWin = getGasWorkingWindows("maria", dayOfWeek, customHoursRaw, opts);
  const nWin = getGasWorkingWindows("norberto", dayOfWeek, customHoursRaw, opts);
  return mergeGasWindows(mWin, nWin);
}

// Feriados Oficiales de Argentina (fuente: scripts/argentina-holidays.mjs → npm run holidays:sync)
const ARGENTINA_HOLIDAYS = [
  // BEGIN_ARGENTINA_HOLIDAYS
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02",
  "2026-04-03", "2026-05-01", "2026-05-25", "2026-06-15", "2026-06-20",
  "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08",
  "2026-12-25", "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24",
  "2027-03-26", "2027-04-02", "2027-05-01", "2027-05-25", "2027-06-20",
  "2027-07-09", "2027-08-16", "2027-10-11", "2027-11-20", "2027-12-08",
  "2027-12-25", "2028-01-01", "2028-02-28", "2028-02-29", "2028-03-24",
  "2028-04-02", "2028-04-14", "2028-05-01", "2028-05-25", "2028-06-20",
  "2028-07-09", "2028-08-21", "2028-10-16", "2028-11-20", "2028-12-08",
  "2028-12-25", "2029-01-01", "2029-02-12", "2029-02-13", "2029-03-24",
  "2029-03-30", "2029-04-02", "2029-05-01", "2029-05-25", "2029-06-20",
  "2029-07-09", "2029-08-20", "2029-10-15", "2029-11-19", "2029-12-08",
  "2029-12-25"
  // END_ARGENTINA_HOLIDAYS
];
