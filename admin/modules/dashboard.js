/**
 * Kinésica Admin - Módulo de Dashboard y Landing Principal
 * Orquesta la vista principal de inicio con accesos rápidos a Fichas, Pacientes, Clara y Agenda.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=78";
import { escapeHtml, dialogAlert } from "./dom.js?v=78";

const viewDashboard = document.querySelector("#view-dashboard");
const greetingEl = document.querySelector("#dash-greeting");
const loginsEl = document.querySelector("#dash-logins");
const claraDot = document.querySelector("#dash-clara-dot");
const claraText = document.querySelector("#dash-clara-status-text");
const claraToggleBtn = document.querySelector("#dash-btn-toggle-clara");
const bookingDot = document.querySelector("#dash-booking-dot");
const bookingText = document.querySelector("#dash-booking-status-text");
const bookingToggleBtn = document.querySelector("#dash-btn-toggle-booking");

let activeClara = localStorage.getItem("kinesica_clara_active") === "1";
let activeBooking = localStorage.getItem("kinesica_booking_active") === "1";

export function showDashboardView() {
  if (viewDashboard) {
    viewDashboard.hidden = false;
    const views = ["#view-library", "#view-pacientes", "#view-configuracion", "#view-horarios", "#view-honorarios", "#view-form", "#view-compare", "#view-gate"];
    views.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.hidden = true;
    });

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
    claraText.textContent = isActive ? "Clara: Activa en WhatsApp" : "Clara: Pausada";
  }
  if (claraToggleBtn) {
    claraToggleBtn.textContent = isActive ? "Pausar bot" : "Reanudar bot";
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
  const user = getSessionUser();
  if (greetingEl) {
    greetingEl.textContent = "Panel de Control";
  }
  if (loginsEl) {
    const isAdminUser = user?.role === "admin" || user?.username === "martin";
    const logins = isAdminUser && Array.isArray(user.logins) ? user.logins : [];
    if (!logins.length) {
      loginsEl.hidden = true;
      loginsEl.replaceChildren();
    } else {
      loginsEl.hidden = false;
      loginsEl.replaceChildren(
        ...logins.map((row) => {
          const item = document.createElement("li");
          const name = document.createElement("strong");
          name.textContent = row.name || "";
          item.append(name, document.createTextNode(`: ${Number(row.count) || 0}`));
          return item;
        })
      );
    }
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
