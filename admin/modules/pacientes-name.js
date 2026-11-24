import { capitalizePersonName } from "./pacientes-format.js";

/** Alineado con kinesica_known_inverted_patient_names() en PHP. */
const KNOWN_INVERTED_NAMES = {
  "dalamon viviana": { nombre: "Viviana", apellido: "Dalamon" },
  "lipsyc silvana": { nombre: "Silvana", apellido: "Lipsyc" },
  "mira walter": { nombre: "Walter", apellido: "Mira" },
  "silvestre rodrigo": { nombre: "Rodrigo", apellido: "Silvestre" },
};

/** Ruido de títulos de Calendar ("turno acá", "aca") — alineado con sanitize_patient_name PHP. */
function stripCalendarNameNoise(raw) {
  return String(raw || "")
    .replace(/\b(?:turno|aca|acá)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s,-]+|[\s,-]+$/g, "");
}

function normNameKey(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function lookupKnownInverted(nombre, apellido, full) {
  // Solo full y "nombre apellido" (no "apellido nombre": en fichas ya correctas
  // eso reproduce la clave invertida y volveríamos a invertirlo).
  const candidates = [
    stripCalendarNameNoise(full),
    stripCalendarNameNoise(`${nombre} ${apellido}`),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hit = KNOWN_INVERTED_NAMES[normNameKey(candidate)];
    if (hit) return { ...hit };
  }
  return null;
}

/**
 * Normaliza nombre/apellido para listado y edición.
 * Corrige entradas conocidas del Calendar ("Mira Walter" → Walter Mira)
 * y campos invertidos respecto de un nombre_completo "Nombre Apellido".
 * Display: "Nombre Apellido".
 */
export function formatPatientName(p) {
  let ap = stripCalendarNameNoise(p?.apellido || "");
  let nom = stripCalendarNameNoise(p?.nombre || "");
  const fullRaw = p?.nombre_completo || "";

  const known = lookupKnownInverted(nom, ap, fullRaw);
  if (known) {
    nom = known.nombre;
    ap = known.apellido;
  } else if (!ap && !nom) {
    const split = splitFullName(fullRaw);
    ap = split.apellido;
    nom = split.nombre;
  } else {
    const fromFull = splitFullName(fullRaw);
    // Campos al revés respecto de un nombre_completo "Nombre Apellido"
    // (ej. full=Walter Mira, apellido=Walter, nombre=Mira).
    if (
      fromFull.nombre &&
      fromFull.apellido &&
      !String(fullRaw || "").includes(",") &&
      normNameKey(ap) === normNameKey(fromFull.nombre) &&
      normNameKey(nom) === normNameKey(fromFull.apellido)
    ) {
      nom = fromFull.nombre;
      ap = fromFull.apellido;
    }
  }

  ap = capitalizePersonName(ap);
  nom = capitalizePersonName(nom);

  let display = "";
  if (nom && ap) display = `${nom} ${ap}`;
  else if (nom) display = nom;
  else if (ap) display = ap;
  else display = capitalizePersonName(String(fullRaw).trim()) || "Paciente";

  return { apellido: ap, nombre: nom, display };
}
