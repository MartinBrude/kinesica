/**
 * Kinésica Admin - Reglas Clínicas de ATM y Esquema CDI-TTM
 * Define los esquemas de historia clínica, campos obligatorios, coerción de tipos y valores iniciales.
 */

import {
  validateField,
  validateFicha,
  validateStep,
} from "./ficha-rules-validate.mjs";

import {
  normalizeDni,
  stripAccents,
  matchFichaSearch,
  patientKey,
  personNameKey,
  dniNameConflict,
  ownsFicha,
  ageOn,
  PATIENT_FIELDS,
  getUniquePatients,
  getSessionIndex,
  formatSessionBadgeText,
  shouldOmitInvariableFields,
  assignProfesional as assignProfHelper,
  capitalizePersonName,
  sanitizePersonName,
  hasDisallowedNameChars,
} from "./ficha-rules-patient.mjs";

import { emptyFicha, exampleFicha } from "./ficha-rules-defaults.mjs";

export {
  validateField,
  validateFicha,
  validateStep,
  normalizeDni,
  stripAccents,
  matchFichaSearch,
  patientKey,
  personNameKey,
  dniNameConflict,
  ownsFicha,
  ageOn,
  PATIENT_FIELDS,
  getUniquePatients,
  getSessionIndex,
  formatSessionBadgeText,
  shouldOmitInvariableFields,
  capitalizePersonName,
  sanitizePersonName,
  hasDisallowedNameChars,
  emptyFicha,
  exampleFicha,
};

export function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

export function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const REQUIRED_FIELDS = [
  ["nombre", "el nombre completo"],
  ["fechaSesion", "la fecha de la sesión"],
  ["nacimiento", "la fecha de nacimiento"],
  ["edad", "la edad"],
  ["motivo", "el motivo de consulta"],
  ["antecedentes", "los antecedentes clínicos"],
];

export const CLINICIANS = {
  norberto: "Norberto",
  maria: "María",
};

export const CLINICIAN_DETAILS = {
  norberto: {
    nombre: "Lic. Norberto Brude",
    titulo: "Kinesiólogo Fisiatra",
    matricula: "M.N. 11816",
    signatureFile: "/admin/signatures/norberto.png?v=2",
  },
  maria: {
    nombre: "Lic. María Gulin",
    titulo: "Kinesióloga Fisiatra",
    matricula: "M.N. 15322 · M.P. 3112",
    signatureFile: "/admin/signatures/maria.png?v=2",
  },
};

export function missingFieldKeys(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(data?.[key] ?? "").trim())
    .map(([key]) => key);
}

export function missingFields(data) {
  return REQUIRED_FIELDS
    .filter(([key]) => !String(data?.[key] ?? "").trim())
    .map(([, label]) => label);
}

export function assignProfesional(username, previous, requested, options = {}) {
  return assignProfHelper(username, previous, requested, CLINICIANS, options);
}

export function nextSession(item, fechaSesion) {
  const copy = emptyFicha();
  for (const key of PATIENT_FIELDS) copy[key] = item?.[key] ?? copy[key];
  copy.sinDocumento = Boolean(item?.sinDocumento);
  copy.fechaSesion = fechaSesion || "";
  copy.edad = ageOn(item?.nacimiento, fechaSesion);
  if (CLINICIANS[item?.profesional]) copy.profesional = item.profesional;
  // Nueva sesión del mismo paciente: conservar vínculo canónico (sin version de la ficha previa).
  const pid = Number(item?.paciente_id);
  if (Number.isInteger(pid) && pid > 0) copy.paciente_id = pid;
  const prid = Number(item?.profesional_id);
  if (Number.isInteger(prid) && prid > 0) copy.profesional_id = prid;
  return copy;
}

export function coerceFicha(input = {}) {
  const template = emptyFicha();
  const out = {};
  for (const [key, defaultVal] of Object.entries(template)) {
    const val = input?.[key];
    if (typeof defaultVal === "boolean") {
      out[key] = parseBoolean(val) ?? defaultVal;
    } else if (typeof defaultVal === "number") {
      const num = Number(val);
      out[key] = Number.isFinite(num) ? num : defaultVal;
    } else if (Array.isArray(defaultVal)) {
      out[key] = Array.isArray(val) ? val.filter((x) => typeof x === "string") : [];
    } else {
      out[key] = val != null ? String(val).trim() : "";
    }
  }
  out.eva = Math.max(0, Math.min(10, Math.round(out.eva || 0)));

  if (out.nombre) {
    out.nombre = sanitizePersonName(out.nombre);
  }

  if (out.edad) {
    const cleanEdad = String(out.edad).replace(/\D/g, "");
    const edadNum = parseInt(cleanEdad, 10);
    out.edad = Number.isInteger(edadNum) && edadNum >= 1 && edadNum <= 120 ? String(edadNum) : "";
  }

  for (const mKey of [
    "aperturaLibre", "aperturaDolor", "protrusion", "latIzq", "latDer",
    "aperturaLibrePost", "aperturaDolorPost", "protrusionPost", "latIzqPost", "latDerPost",
  ]) {
    if (out[mKey]) {
      const cleanVal = String(out[mKey]).replace(",", ".").replace(/[^\d.]/g, "");
      const numVal = Number(cleanVal);
      out[mKey] = Number.isFinite(numVal) && numVal >= 0 ? cleanVal : "";
    }
  }

  if (input?.id) out.id = String(input.id);
  if (input?.savedAt) out.savedAt = String(input.savedAt);
  if (input?.profesional) out.profesional = String(input.profesional);
  if (input?.profesionalNombre) out.profesionalNombre = String(input.profesionalNombre);

  // Metadatos relacionales (no están en emptyFicha; round-trip para locking / IDs).
  if (input?.version != null && input.version !== "") {
    const v = Number(input.version);
    if (Number.isInteger(v) && v > 0) out.version = v;
  }
  if (input?.paciente_id != null && input.paciente_id !== "") {
    const pid = Number(input.paciente_id);
    if (Number.isInteger(pid) && pid > 0) out.paciente_id = pid;
  }
  if (input?.profesional_id != null && input.profesional_id !== "") {
    const prid = Number(input.profesional_id);
    if (Number.isInteger(prid) && prid > 0) out.profesional_id = prid;
  }

  if (out.fotoUrl && out.fotosUrls.length === 0) {
    out.fotosUrls = [out.fotoUrl];
  } else if (!out.fotoUrl && out.fotosUrls.length > 0) {
    out.fotoUrl = out.fotosUrls[0];
  }

  return out;
}

export {
  sideText,
  formatSide,
  daysBetween,
  compareFichas,
} from "./ficha-compare.mjs";
