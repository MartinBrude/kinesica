import { capitalizePersonName } from "./pacientes-format.js";

/** Ruido de títulos de Calendar ("turno acá", "aca") — alineado con sanitize_patient_name PHP. */
function stripCalendarNameNoise(raw) {
  return String(raw || "")
    .replace(/\b(?:turno|aca|acá)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,-]+|[\s,-]+$/g, "");
}

/** Parte "Apellido, Nombre(s)" o "Nombre Apellido" desde un nombre completo. */
function splitFullName(fullRaw) {
  const full = stripCalendarNameNoise(fullRaw);
  if (!full) return { apellido: "", nombre: "" };

  if (full.includes(",")) {
    const [left, ...rightParts] = full.split(",");
    const ap = stripCalendarNameNoise(left);
    const nom = stripCalendarNameNoise(rightParts.join(" "));
    if (ap || nom) return { apellido: ap, nombre: nom };
  }

  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { apellido: "", nombre: parts[0] };
  // Convención habitual del alta: Nombre [Nombre2] Apellido…
  const nombreCount = parts.length > 2 ? 2 : 1;
  return {
    nombre: parts.slice(0, nombreCount).join(" "),
    apellido: parts.slice(nombreCount).join(" "),
  };
}

export function formatPatientName(p) {
  let ap = stripCalendarNameNoise(p?.apellido || "");
  let nom = stripCalendarNameNoise(p?.nombre || "");

  if (!ap && !nom) {
    const split = splitFullName(p?.nombre_completo || "");
    ap = split.apellido;
    nom = split.nombre;
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
