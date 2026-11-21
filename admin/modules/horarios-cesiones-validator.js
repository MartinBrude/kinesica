/**
 * Kinésica Admin - Validador de Cesiones y Cierres de Consultorio
 * Reglas de negocio para transferencias de tiempo y bloqueos administrativos.
 */

export function isValidIsoDate(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return false;
  const parts = str.trim().split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.getFullYear() === parts[0] && d.getMonth() === parts[1] - 1 && d.getDate() === parts[2];
}

export function isValidHm(hm) {
  return typeof hm === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(hm.trim());
}

export function hmToMin(hm) {
  const [h, m] = String(hm || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function validateCesionDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== "object") {
    return { isValid: false, errors: ["Datos de formulario inválidos."] };
  }

  const action = draft.action || "transfer";
  if (!["transfer", "closure"].includes(action)) {
    errors.push("Tipo de acción inválido (transferir o cerrar).");
  }

  if (action === "transfer") {
    if (!["norberto", "maria"].includes(draft.from_practitioner)) {
      errors.push("Seleccioná quién cede el horario.");
    }
    if (!["norberto", "maria"].includes(draft.to_practitioner)) {
      errors.push("Seleccioná quién recibe el horario.");
    }
    if (draft.from_practitioner && draft.from_practitioner === draft.to_practitioner) {
      errors.push("El profesional cedente y receptor no pueden ser la misma persona.");
    }
  }

  const sDate = String(draft.start_date || "").trim();
  const eDate = draft.period_type === "single_day" ? sDate : String(draft.end_date || "").trim();

  if (!isValidIsoDate(sDate)) {
    errors.push("Ingresá una fecha de inicio válida (AAAA-MM-DD).");
  }
  if (!isValidIsoDate(eDate)) {
    errors.push("Ingresá una fecha de fin válida (AAAA-MM-DD).");
  } else if (sDate && eDate && eDate < sDate) {
    errors.push("La fecha de fin no puede ser anterior a la de inicio.");
  }

  if (draft.time_scope === "custom_hours") {
    const rawRanges = Array.isArray(draft.custom_ranges) && draft.custom_ranges.length > 0
      ? draft.custom_ranges
      : (draft.custom_range ? [draft.custom_range] : []);

    if (rawRanges.length === 0) {
      errors.push("Debés indicar al menos una franja horaria.");
    } else {
      const parsedIntervals = [];
      for (let i = 0; i < rawRanges.length; i++) {
        const r = rawRanges[i];
        const start = String(r?.start || "").trim();
        const end = String(r?.end || "").trim();
        if (!isValidHm(start) || !isValidHm(end)) {
          errors.push(`Franja ${i + 1}: formato de hora inválido (usar HH:00 o HH:30).`);
          continue;
        }
        const sMin = hmToMin(start);
        const eMin = hmToMin(end);
        if (sMin < 8 * 60 || eMin > 20 * 60) {
          errors.push(`Franja ${i + 1}: debe estar entre las 08:00 y las 20:00 hs.`);
        } else if (eMin <= sMin) {
          errors.push(`Franja ${i + 1}: la hora de fin debe ser posterior a la de inicio.`);
        } else if ((eMin - sMin) < 60) {
          errors.push(`Franja ${i + 1}: debe durar al menos 60 minutos.`);
        } else {
          parsedIntervals.push({ sMin, eMin, idx: i + 1 });
        }
      }
      parsedIntervals.sort((a, b) => a.sMin - b.sMin);
      for (let i = 0; i < parsedIntervals.length - 1; i++) {
        if (parsedIntervals[i].eMin > parsedIntervals[i + 1].sMin) {
          errors.push("Las franjas horarias no deben superponerse entre sí.");
          break;
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
