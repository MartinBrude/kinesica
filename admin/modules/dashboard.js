/**
 * Kinésica Admin - Módulo de Dashboard y Landing Principal
 * Orquesta la vista principal de inicio con accesos rápidos a Fichas, Pacientes, Clara y Agenda.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=81";
import { escapeHtml, dialogAlert, switchActiveView } from "./dom.js?v=78";

const viewDashboard = document.querySelector("#view-dashboard");
const greetingEl = document.querySelector("#dash-greeting");
const claraDot = document.querySelector("#dash-clara-dot");
const claraText = document.querySelector("#dash-clara-status-text");
const claraToggleBtn = document.querySelector("#dash-btn-toggle-clara");
const bookingDot = document.querySelector("#dash-booking-dot");
const bookingText = document.querySelector("#dash-booking-status-text");
const bookingToggleBtn = document.querySelector("#dash-btn-toggle-booking");

let activeClara = localStorage.getItem("kinesica_clara_active") === "1";
let activeBooking = localStorage.getItem("kinesica_booking_active") === "1";

export function showDashboardView() {
  const isColaborador = getSessionUser()?.role === "colaborador";
  if (claraToggleBtn) claraToggleBtn.disabled = isColaborador;
  if (bookingToggleBtn) bookingToggleBtn.disabled = isColaborador;

  const view = switchActiveView("view-dashboard");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "inicio" }));
    } catch {}

    updateDashboardState();
  }
}

export function hideDashboardView() {
  if (viewDashboard) {
    viewDashboard.hidden = true;
  }
}

export async function updateDashboardClara(isActive) {
  activeClara = isActive;
  if (claraDot) {
    claraDot.className = `dash-status-dot ${isActive ? "active" : "inactive"}`;
  }
  if (claraText) {
    claraText.textContent = isActive ? "Clara: Visible en web + recordatorios" : "Clara: Oculta en web (sin recordatorios)";
  }
  if (claraToggleBtn) {
    claraToggleBtn.textContent = isActive ? "Ocultar en web" : "Mostrar en web";
  }
}

export async function updateDashboardBooking(isActive) {
  activeBooking = isActive;
  if (bookingDot) {
    bookingDot.className = `dash-status-dot ${isActive ? "active" : "inactive"}`;
  }
  if (bookingText) {
    bookingText.textContent = isActive ? "Reservas Web: Activas" : "Reservas Web: Pausadas";
  }
  if (bookingToggleBtn) {
    bookingToggleBtn.textContent = isActive ? "Pausar reservas" : "Activar reservas";
  }
}

export async function updateDashboardState() {
  if (greetingEl) {
    greetingEl.textContent = "Panel de Control";
  }

  // Sincronizar estados de Clara y Booking desde el backend (settings.php)
  try {
    const settings = await api("settings.php").catch(() => null);
    if (settings) {
      const isClaraOn = typeof settings.clara_active === "boolean" ? settings.clara_active : true;
      const isBookingOn = typeof settings.booking_active === "boolean" ? settings.booking_active : true;
      try {
        localStorage.setItem("kinesica_clara_active", isClaraOn ? "1" : "0");
        localStorage.setItem("kinesica_booking_active", isBookingOn ? "1" : "0");
      } catch (_) {}
      updateDashboardClara(isClaraOn);
      updateDashboardBooking(isBookingOn);
      return;
    }
  } catch (_) {}

  const claraStorage = localStorage.getItem("kinesica_clara_active") === "1";
  const bookingStorage = localStorage.getItem("kinesica_booking_active") === "1";
  updateDashboardClara(claraStorage);
  updateDashboardBooking(bookingStorage);
}

export function initDashboardModule(callbacks = {}) {
  // Conectar acciones directas de las tarjetas
  const attachCard = (sel, action) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.addEventListener("click", () => action());
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        action();
      }
    });
  };

  attachCard("#dash-card-fichas", () => callbacks.onNavigate?.("fichas"));
  attachCard("#dash-card-pacientes", () => callbacks.onNavigate?.("pacientes"));
  attachCard("#dash-card-consultorio", () => callbacks.onNavigate?.("consultorio"));
  attachCard("#dash-card-clara", () => callbacks.onNavigate?.("clara"));
  attachCard("#dash-card-interacciones", () => callbacks.onNavigate?.("interacciones"));
  attachCard("#dash-card-recordatorios", () => callbacks.onNavigate?.("recordatorios"));

  // Card de turnera (abre el modal accesible de reservas)
  const agendarCard = document.querySelector("#dash-card-agendar");
  if (agendarCard) {
    agendarCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        agendarCard.click();
      }
    });
  }

  // Toggle de Clara desde el dashboard
  claraToggleBtn?.addEventListener("click", async () => {
    if (getSessionUser()?.role === "colaborador") {
      dialogAlert("Los usuarios con rol Colaborador tienen permisos de solo lectura.");
      return;
    }
    const nextState = !activeClara;
    claraToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ clara_active: nextState }),
      });
      localStorage.setItem("kinesica_clara_active", nextState ? "1" : "0");
      updateDashboardClara(nextState);
      // Sincronizar también el botón del topbar si existe
      callbacks.onClaraToggled?.(nextState);
    } catch (err) {
      dialogAlert("No se pudo cambiar el estado de Clara.");
    } finally {
      claraToggleBtn.disabled = false;
    }
  });

  // Toggle de Booking desde el dashboard
  bookingToggleBtn?.addEventListener("click", async () => {
    if (getSessionUser()?.role === "colaborador") {
      dialogAlert("Los usuarios con rol Colaborador tienen permisos de solo lectura.");
      return;
    }
    const nextState = !activeBooking;
    bookingToggleBtn.disabled = true;
    try {
      await api("settings.php", {
        method: "POST",
        body: JSON.stringify({ booking_active: nextState }),
      });
      localStorage.setItem("kinesica_booking_active", nextState ? "1" : "0");
      updateDashboardBooking(nextState);
      callbacks.onBookingToggled?.(nextState);
    } catch (err) {
      dialogAlert("No se pudo cambiar el estado de la turnera web.");
    } finally {
      bookingToggleBtn.disabled = false;
    }
  });
}
