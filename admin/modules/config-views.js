/**
 * Kinésica Admin - Gestión de Vistas de Consultorio y Configuración
 * Enrutamiento de subpestañas y activación de paneles de horarios/honorarios/clara.
 */

import { switchActiveView } from "./dom.js?v=78";
import { loadHorariosFromServer } from "./horarios.js?v=3";
import { loadHonorarios } from "./honorarios.js?v=2";

export function showConsultorioView() {
  const view = switchActiveView("view-consultorio");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "consultorio" }));
    } catch {}
    loadHorariosFromServer();
    loadHonorarios();
  }
}

export function hideConsultorioView() {
  const view = document.querySelector("#view-consultorio");
  if (view) view.hidden = true;
}

export function showClaraView(onClaraShow) {
  const view = switchActiveView("view-clara");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "clara" }));
    } catch {}
    if (typeof onClaraShow === "function") onClaraShow();
  }
}

export function hideClaraView() {
  const view = document.querySelector("#view-clara");
  if (view) view.hidden = true;
}

export function showConfiguracionView(subtab = "clara", onClaraShow) {
  if (subtab === "horarios" || subtab === "honorarios") showConsultorioView();
  else showClaraView(onClaraShow);
}

export function hideConfiguracionView() {
  hideConsultorioView();
  hideClaraView();
}

export function switchConfigSubtab(subtabId, onClaraShow) {
  if (subtabId === "horarios" || subtabId === "honorarios") showConsultorioView();
  else showClaraView(onClaraShow);
}
