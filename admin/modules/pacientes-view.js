import { switchActiveView } from "./dom.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { btnNuevo, viewPacientes } from "./pacientes-state.js";
import { loadPacientes } from "./pacientes-load.js";

export function showPacientesView() {
  const isColaborador = getSessionUser()?.role === "colaborador";
  if (btnNuevo) btnNuevo.hidden = isColaborador;
  const view = switchActiveView("view-pacientes");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "pacientes" }));
    } catch { /* ignore */ }
    loadPacientes();
  }
}

export function hidePacientesView() {
  if (viewPacientes) viewPacientes.hidden = true;
}
