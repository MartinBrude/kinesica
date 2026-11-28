import { getUniquePatients, capitalizePersonName } from "../ficha-rules.mjs?v=91";
import { getSessionUser } from "./auth.js?v=83";
import { getDirectoryPacientesCache, isDirectoryLoaded } from "./form-patient-state.js";
import { fetchDirectoryPacientes } from "./form-patient-directory.js";

function normName(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function populatePatientPicker(allFichas = [], selectedKey = "", extraPacientes = null) {
  const select = document.querySelector("#patient-quick-select");
  const card = document.querySelector("#patient-picker-card");
  if (!select) return;

  const fichasPatients = getUniquePatients(allFichas);
  const dirPacientes = Array.isArray(extraPacientes) ? extraPacientes : getDirectoryPacientesCache();

  const registeredOnly = [];
  if (dirPacientes && dirPacientes.length > 0) {
    const fichaDnis = new Set();
    const fichaNames = new Set();
    for (const f of fichasPatients) {
      const fDniClean = String(f.dni || "").replace(/[^0-9kK]/g, "");
      if (fDniClean) fichaDnis.add(fDniClean);
      const fNameNorm = normName(f.nombre);
      if (fNameNorm) fichaNames.add(fNameNorm);
    }

    for (const p of dirPacientes) {
      const pDniClean = String(p.dni || "").replace(/[^0-9kK]/g, "");
      const pNameNorm = normName(p.nombre_completo || `${p.nombre || ""} ${p.apellido || ""}`);
      if (!pNameNorm && !pDniClean) continue;

      const hasFicha = (pDniClean && fichaDnis.has(pDniClean)) || (pNameNorm && fichaNames.has(pNameNorm));
      if (!hasFicha) {
        registeredOnly.push(p);
      }
    }
  }

  const total = fichasPatients.length + registeredOnly.length;
  if (card) card.hidden = total === 0;

  select.innerHTML = '<option value="">— Cargar nuevo paciente (o seleccionar existente) —</option>';

  if (fichasPatients.length > 0) {
    const groupFichas = document.createElement("optgroup");
    groupFichas.label = "Pacientes con Historias Clínicas";
    for (const p of fichasPatients) {
      const opt = document.createElement("option");
      opt.value = p.key;
      opt.textContent = `${capitalizePersonName(p.nombre)} (DNI ${p.dni || "—"}) · ${p.sessions.length} ses.`;
      groupFichas.append(opt);
    }
    select.append(groupFichas);
  }

  if (registeredOnly.length > 0) {
    const groupDir = document.createElement("optgroup");
    groupDir.label = "Pacientes registrados (sin historia previa)";
    for (const p of registeredOnly) {
      const opt = document.createElement("option");
      const fullName = capitalizePersonName((p.nombre_completo || `${p.nombre || ""} ${p.apellido || ""}`).trim());
      opt.value = `dir:${p.id}`;
      opt.textContent = `${fullName} (DNI ${p.dni || "—"})${p.profesional_habitual && p.profesional_habitual !== "indistinto" ? ` · ${p.profesional_habitual}` : ""}`;
      groupDir.append(opt);
    }
    select.append(groupDir);
  }

  select.value = selectedKey || "";

  if (!isDirectoryLoaded() && !extraPacientes && getSessionUser()) {
    fetchDirectoryPacientes().then((pacientes) => {
      if (pacientes && pacientes.length > 0) {
        populatePatientPicker(allFichas, select.value, pacientes);
      }
    });
  }
}
