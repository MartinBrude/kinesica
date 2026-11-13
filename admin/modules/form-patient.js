/**
 * Kinésica Admin - Filiación y Selector de Paciente del Formulario (facade).
 */

export {
  getIdentityKey,
  setIdentityKey,
  isIdentityEdited,
  setIdentityEdited,
  form,
} from "./form-patient-state.js";

export { fetchDirectoryPacientes, invalidateDirectoryCache } from "./form-patient-directory.js";

export { setDniPower, setPatientLocked } from "./form-patient-lock.js";

export { populatePatientPicker } from "./form-patient-picker.js";

export { clearPatientInputs, applyPatientData } from "./form-patient-fill.js";

export { setupPatientHandlers } from "./form-patient-handlers.js";
