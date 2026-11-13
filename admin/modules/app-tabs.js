/**
 * Kinésica Admin - Gestión de Pestañas y Navegación Principal (facade).
 */

import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { setPacientesMissingPhoneBadge, stopPacientesBadgePoll } from "./pacientes.js?v=16";
import { updateDashboardClara, updateDashboardBooking } from "./dashboard.js?v=13";
import { applyHoursToRuntime } from "./horarios.js?v=4";

export { closeAllDropdowns } from "./app-tabs-dropdowns.js";
export { closeMobileNav, openMobileNav, toggleMobileNav } from "./app-tabs-mobile.js";
export { switchTab } from "./app-tabs-switch.js";

import { closeMobileNav } from "./app-tabs-mobile.js";
import { bindAdminNavOnce } from "./app-tabs-nav.js";

function setAdminOnlyVisibility(isAdmin) {
  const navGroupAdmin = document.getElementById("nav-group-admin");
  if (navGroupAdmin) navGroupAdmin.hidden = !isAdmin;
  const btnAdmin = document.getElementById("nav-btn-admin");
  if (btnAdmin) btnAdmin.hidden = !isAdmin;
  const dashCardAdmin = document.getElementById("dash-card-admin");
  if (dashCardAdmin) dashCardAdmin.hidden = !isAdmin;
}

export function unmountAdminChannels() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("is-admin-role");
  }
  closeMobileNav();
  const nav = document.getElementById("admin-nav");
  if (nav) nav.hidden = true;
  const navToggle = document.getElementById("btn-nav-toggle");
  if (navToggle) navToggle.hidden = true;
  const dock = document.getElementById("admin-mobile-dock");
  if (dock) dock.hidden = true;
  setAdminOnlyVisibility(false);
  setPacientesMissingPhoneBadge(0);
  stopPacientesBadgePoll();
}

export function mountAdminChannels() {
  const user = getSessionUser();
  if (!user) {
    unmountAdminChannels();
    return;
  }

  const isAdmin = user.role === "admin";
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("is-admin-role", isAdmin);
  }

  const adminNav = document.getElementById("admin-nav");
  if (adminNav) adminNav.hidden = false;
  const navToggle = document.getElementById("btn-nav-toggle");
  if (navToggle) navToggle.hidden = false;
  const dock = document.getElementById("admin-mobile-dock");
  if (dock) dock.hidden = false;
  setAdminOnlyVisibility(isAdmin);
  bindAdminNavOnce(adminNav);

  api("settings.php")
    .then((data) => {
      if (!data) return;
      if (typeof data.clara_active === "boolean") {
        localStorage.setItem("kinesica_clara_active", data.clara_active ? "1" : "0");
        updateDashboardClara(data.clara_active);
      }
      if (typeof data.booking_active === "boolean") {
        localStorage.setItem("kinesica_booking_active", data.booking_active ? "1" : "0");
        updateDashboardBooking(data.booking_active);
      }
      if (data.practitioner_hours && typeof data.practitioner_hours === "object") {
        applyHoursToRuntime(data.practitioner_hours);
      }
    })
    .catch(() => {});
}
