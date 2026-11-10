/**
 * Kinésica Admin - Gestión de Vistas de Consultorio y Configuración
 * Enrutamiento de subpestañas y activación de paneles de horarios/honorarios/clara.
 */

import { switchActiveView } from "./dom.js?v=79";
import { loadHorariosFromServer } from "./horarios.js?v=4";
import { loadHonorarios } from "./honorarios.js?v=3";

export function showConsultorioView() {
  const view = switchActiveView("view-consultorio");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "consultorio" }));
    } catch { /* ignore */ }
    loadHorariosFromServer();
    loadHonorarios();
  }
}

export function hideConsultorioView() {
  const view = document.querySelector("#view-consultorio");
  if (view) view.hidden = true;
}

const CLARA_SECTIONS = new Set(["estado", "mensajes", "plantilla", "politicas", "simulador"]);

export function normalizeClaraSection(section) {
  const raw = String(section || "").toLowerCase().trim();
  if (raw === "mails" || raw === "politica" || raw === "políticas") return "politicas";
  if (raw === "demo" || raw === "simulator") return "simulador";
  if (raw === "menu" || raw === "mensajes-menu" || raw === "textos") return "mensajes";
  if (raw === "servicios" || raw === "bot") return "estado";
  if (raw === "recordatorio" || raw === "reminder" || raw === "reminders") return "plantilla";
  return CLARA_SECTIONS.has(raw) ? raw : "";
}

export function focusClaraSection(section) {
  const id = normalizeClaraSection(section);
  if (!id) return;
  const el = document.getElementById(`clara-section-${id}`);
  if (!el) return;
  document.querySelectorAll("#view-clara details.admin-collapsible-card[data-clara-section]").forEach((card) => {
    if (card !== el) card.open = false;
  });
  el.open = true;
  requestAnimationFrame(() => {
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch { /* ignore */ }
  });
}

export function showClaraView(onClaraShow, section = "") {
  const view = switchActiveView("view-clara");
  if (view) {
    const normalized = normalizeClaraSection(section);
    try {
      sessionStorage.setItem(
        "kinesica_admin_view",
        JSON.stringify(normalized ? { view: "clara", section: normalized } : { view: "clara" })
      );
    } catch { /* ignore */ }
    if (typeof onClaraShow === "function") onClaraShow();
    if (normalized) {
      // Esperar un tick por si la vista se acaba de mostrar / cargar.
      setTimeout(() => focusClaraSection(normalized), 40);
    }
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
