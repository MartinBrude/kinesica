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

const CLARA_SECTION_TITLES = {
  estado: "Clara · Estado de servicios",
  mensajes: "Clara · Mensajes y menú",
  plantilla: "Clara · Plantilla de recordatorio",
  politicas: "Clara · Políticas del mail",
  simulador: "Clara · Simulador",
};

export function normalizeClaraSection(section) {
  const raw = String(section || "").toLowerCase().trim();
  if (raw === "mails" || raw === "politica" || raw === "políticas") return "politicas";
  if (raw === "demo" || raw === "simulator") return "simulador";
  if (raw === "menu" || raw === "mensajes-menu" || raw === "textos") return "mensajes";
  if (raw === "servicios" || raw === "bot") return "estado";
  if (raw === "recordatorio" || raw === "reminder" || raw === "reminders") return "plantilla";
  return CLARA_SECTIONS.has(raw) ? raw : "";
}

/** Como Administración: muestra solo la sección elegida y oculta el resto. */
export function setClaraActiveSection(section = "mensajes") {
  const id = normalizeClaraSection(section) || "mensajes";
  document.querySelectorAll("#view-clara details.admin-collapsible-card[data-clara-section]").forEach((card) => {
    const match = card.getAttribute("data-clara-section") === id;
    card.hidden = !match;
    if (match) {
      card.open = true;
    }
  });
  const heroTitle = document.querySelector("#view-clara .hero-title");
  if (heroTitle) {
    heroTitle.textContent = CLARA_SECTION_TITLES[id] || "Clara";
  }
  try {
    window.scrollTo({ top: 0, behavior: "instant" });
  } catch { /* ignore */ }
}

/** @deprecated Prefer setClaraActiveSection — se mantiene por compatibilidad. */
export function focusClaraSection(section) {
  setClaraActiveSection(section);
}

export function showClaraView(onClaraShow, section = "") {
  const view = switchActiveView("view-clara");
  if (view) {
    const normalized = normalizeClaraSection(section) || "mensajes";
    try {
      sessionStorage.setItem(
        "kinesica_admin_view",
        JSON.stringify({ view: "clara", section: normalized })
      );
    } catch { /* ignore */ }
    setClaraActiveSection(normalized);
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
