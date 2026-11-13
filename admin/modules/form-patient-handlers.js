import { patientKey } from "../ficha-rules.mjs?v=89";
import { form, getDirectoryPacientesCache } from "./form-patient-state.js";
import { setDniPower, setPatientLocked } from "./form-patient-lock.js";
import { clearPatientInputs, applyPatientData } from "./form-patient-fill.js";

export function setupPatientHandlers({
  getCurrentAllFichas,
  onSyncAge,
  onValidationChange,
  onSelectPatientMotivo,
}) {
  const patientSelect = document.querySelector("#patient-quick-select");
  if (patientSelect) {
    patientSelect.addEventListener("change", () => {
      const selectedKey = patientSelect.value;
      if (!selectedKey) {
        clearPatientInputs();
        if (typeof onSelectPatientMotivo === "function") onSelectPatientMotivo("");
        form.elements.nombre?.focus();
        if (typeof onValidationChange === "function") onValidationChange();
        return;
      }

      if (selectedKey.startsWith("dir:")) {
        const pId = selectedKey.replace("dir:", "");
        const match = getDirectoryPacientesCache().find((p) => String(p.id) === String(pId));
        if (match) {
          clearPatientInputs();
          const fullName = (match.nombre_completo || `${match.nombre || ""} ${match.apellido || ""}`).trim();
          form.elements.nombre.value = fullName;
          form.elements.dni.value = match.dni || "";
          if (form.elements.profesional && match.profesional_habitual) {
            if (match.profesional_habitual === "norberto" || match.profesional_habitual === "maria") {
              form.elements.profesional.value = match.profesional_habitual;
            }
          }
          if (match.motivo_consulta) {
            const mot = match.motivo_consulta.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let matchedVal = "";
            if (mot.includes("no traum")) matchedVal = "No Traumático";
            else if (mot.includes("traum")) matchedVal = "Traumático";
            else if (mot.includes("brux")) matchedVal = "Bruxismo";
            else if (mot.includes("quirurg") || mot.includes("post")) matchedVal = "Pos Quirúrgico";
            if (matchedVal) {
              document.querySelectorAll('[data-single="motivo"] button').forEach((btn) => {
                btn.classList.toggle("on", btn.dataset.value === matchedVal);
              });
              if (typeof onSelectPatientMotivo === "function") onSelectPatientMotivo(matchedVal);
            }
          }
          setPatientLocked(false, { nombre: fullName, dni: match.dni }, 0, false, true);
          const sessionBadge = document.querySelector("#session-count-badge");
          if (sessionBadge) sessionBadge.textContent = "1ª Consulta · Evaluación inicial";
          if (typeof onValidationChange === "function") onValidationChange();
          form.elements.nacimiento?.focus();
          return;
        }
      }

      const all = (typeof getCurrentAllFichas === "function" ? getCurrentAllFichas() : []) || [];
      const match = all.find((f) => patientKey(f) === selectedKey);
      if (match) {
        const pSessions = all.filter((f) => patientKey(f) === selectedKey);
        applyPatientData(match, pSessions.length);
        if (match.motivo && typeof onSelectPatientMotivo === "function") {
          onSelectPatientMotivo(match.motivo);
        }
        if (typeof onSyncAge === "function") onSyncAge();
        if (typeof onValidationChange === "function") onValidationChange();
        form.elements.fechaSesion?.focus();
      }
    });
  }

  const dniPowerBtn = document.querySelector("#btn-dni-power");
  dniPowerBtn?.addEventListener("click", () => {
    if (dniPowerBtn.disabled) return;
    const on = dniPowerBtn.classList.contains("is-on");
    setDniPower(!on, { clear: on });
    if (typeof onValidationChange === "function") onValidationChange();
  });

  const editBtn = document.querySelector("#btn-edit-primary");
  editBtn?.addEventListener("click", () => {
    setPatientLocked(false, null, 0, false, true);
    form?.elements.nombre?.focus();
  });

  const newToggleBtn = document.querySelector("#btn-patient-new-toggle");
  newToggleBtn?.addEventListener("click", () => {
    if (patientSelect) patientSelect.value = "";
    clearPatientInputs();
    if (typeof onSelectPatientMotivo === "function") onSelectPatientMotivo("");
    form?.elements.nombre?.focus();
    if (typeof onValidationChange === "function") onValidationChange();
  });
}
