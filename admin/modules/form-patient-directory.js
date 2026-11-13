import { api } from "./api.js?v=79";
import {
  getDirectoryPacientesCache,
  setDirectoryPacientesCache,
  isDirectoryLoaded,
  setDirectoryLoaded,
} from "./form-patient-state.js";

export async function fetchDirectoryPacientes() {
  if (isDirectoryLoaded()) return getDirectoryPacientesCache();
  try {
    const res = await api("pacientes.php");
    const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
    setDirectoryPacientesCache(items);
    setDirectoryLoaded(true);
    return getDirectoryPacientesCache();
  } catch {
    return [];
  }
}

export function invalidateDirectoryCache() {
  setDirectoryLoaded(false);
  setDirectoryPacientesCache([]);
}
