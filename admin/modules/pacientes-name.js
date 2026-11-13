import { capitalizePersonName } from "./pacientes-format.js";

export function formatPatientName(p) {
  let ap = (p?.apellido || "").trim();
  let nom = (p?.nombre || "").trim();

  if (!ap && !nom) {
    const full = (p?.nombre_completo || "").trim();
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
