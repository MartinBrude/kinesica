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
    const range = draft.custom_range || {};
    const start = String(range.start || "").trim();
    const end = String(range.end || "").trim();
    if (!isValidHm(start) || !isValidHm(end)) {
      errors.push("Horario personalizado inválido (usar HH:00 o HH:30).");
    } else {
      const sMin = hmToMin(start);
      const eMin = hmToMin(end);
      if (sMin < 8 * 60 || eMin > 20 * 60) {
        errors.push("La franja debe estar dentro de las 08:00 y las 20:00 hs.");
      } else if (eMin <= sMin) {
        errors.push("La hora de fin debe ser posterior a la de inicio.");
      } else if ((eMin - sMin) < 60) {
        errors.push("La franja debe durar al menos 60 minutos.");
      }
    }
  }

  return { isValid: errors.length === 0, errors };
}
