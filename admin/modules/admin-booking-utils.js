import { getSessionUser } from "./auth.js?v=83";
import { MAX_RESULTS, getPatients } from "./admin-booking-state.js";

export function isAdmin() {
  const user = getSessionUser();
  return Boolean(user && ["admin", "professional"].includes(user.role));
}

export function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function patientName(patient) {
  return String(patient.nombre_completo || `${patient.nombre || ""} ${patient.apellido || ""}`).trim() || "Sin nombre";
}

export function patientMeta(patient) {
  const parts = [];
  if (patient.telefono && !String(patient.telefono).startsWith("sin-")) parts.push(patient.telefono);
  if (patient.dni) parts.push(`DNI ${patient.dni}`);
  return parts.join(" · ");
}

export function searchPatients(query) {
  const q = normalize(query);
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  const terms = q.split(/\s+/).filter(Boolean);
  const patients = getPatients();
  return patients
    .filter((patient) => {
      const haystack = normalize(`${patientName(patient)} ${patient.email || ""}`);
      if (terms.every((term) => haystack.includes(term))) return true;
      if (digits.length >= 3) {
        const phone = String(patient.telefono || "").replace(/\D/g, "");
        const dni = String(patient.dni || "").replace(/\D/g, "");
        return phone.includes(digits) || dni.includes(digits);
      }
      return false;
    })
    .slice(0, MAX_RESULTS);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);
}
