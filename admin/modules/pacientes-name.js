import { capitalizePersonName } from "./pacientes-format.js";

/** Ruido de títulos de Calendar ("turno acá", "aca") — alineado con sanitize_patient_name PHP. */
function stripCalendarNameNoise(raw) {
  return String(raw || "")
    .replace(/\b(?:turno|aca|acá)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,-]+|[\s,-]+$/g, "");
}

export function formatPatientName(p) {
  let ap = stripCalendarNameNoise(p?.apellido || "");
  let nom = stripCalendarNameNoise(p?.nombre || "");

  if (!ap && !nom) {
    const full = stripCalendarNameNoise(p?.nombre_completo || "");
    if (full) {
      const parts = full.split(/\s+/);
      if (parts.length === 1) {
        nom = parts[0];
      } else {
        nom = parts.slice(0, parts.length > 2 ? 2 : 1).join(" ");
        ap = parts.slice(parts.length > 2 ? 2 : 1).join(" ");
      }
    }
  }

  ap = capitalizePersonName(ap);
  nom = capitalizePersonName(nom);

  let display = "";
  if (ap && nom) display = `${ap}, ${nom}`;
  else if (ap) display = ap;
  else if (nom) display = nom;
  else display = capitalizePersonName((p?.nombre_completo || "").trim()) || "Paciente";

  return { apellido: ap, nombre: nom, display };
}
