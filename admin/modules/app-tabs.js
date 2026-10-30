/**
 * Kinésica Admin - Gestión de Pestañas y Navegación Principal
 * Controla la activación de secciones del menú superior y los canales de administración.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=81";
import { showLibrary } from "./library.js?v=93";
import { showPacientesView, hidePacientesView } from "./pacientes.js?v=3";
import { showDashboardView, hideDashboardView, updateDashboardClara, updateDashboardBooking } from "./dashboard.js?v=10";
import { showConsultorioView, hideConsultorioView, showClaraView, hideClaraView } from "./configuracion.js?v=28";
import { showAdminView, hideAdminView } from "./admin-panel.js?v=10";
import { showInteraccionesView, hideInteraccionesView } from "./interacciones.js?v=8";
import { showRecordatoriosView, hideRecordatoriosView } from "./recordatorios.js?v=1";
import { applyHoursToRuntime } from "./horarios.js?v=3";

export function switchTab(tab) {
  const btnInicio = document.querySelector("#nav-btn-inicio");
  const btnFichas = document.querySelector("#nav-btn-fichas");
  const btnPacientes = document.querySelector("#nav-btn-pacientes");
  const btnConsultorio = document.querySelector("#nav-btn-consultorio");
  const btnClara = document.querySelector("#nav-btn-clara");
  const btnInteracciones = document.querySelector("#nav-btn-interacciones");
  const btnRecordatorios = document.querySelector("#nav-btn-recordatorios");
  const btnAdmin = document.querySelector("#nav-btn-admin");

  btnInicio?.classList.remove("is-active");
  btnFichas?.classList.remove("is-active");
  btnPacientes?.classList.remove("is-active");
  btnConsultorio?.classList.remove("is-active");
  btnClara?.classList.remove("is-active");
  btnInteracciones?.classList.remove("is-active");
  btnRecordatorios?.classList.remove("is-active");
  btnAdmin?.classList.remove("is-active");

  hideDashboardView();
  hidePacientesView();
  hideConsultorioView();
  hideClaraView();
  hideInteraccionesView();
  hideRecordatoriosView();
  hideAdminView();

  if (tab === "inicio") {
    btnInicio?.classList.add("is-active");
    showDashboardView();
  } else if (tab === "pacientes") {
    btnPacientes?.classList.add("is-active");
    showPacientesView();
  } else if (tab === "consultorio" || tab === "horarios" || tab === "honorarios") {
    btnConsultorio?.classList.add("is-active");
    showConsultorioView();
  } else if (tab === "clara" || tab === "configuracion") {
    btnClara?.classList.add("is-active");
    showClaraView();
  } else if (tab === "interacciones" || tab === "chats") {
    btnInteracciones?.classList.add("is-active");
    showInteraccionesView();
  } else if (tab === "recordatorios" || tab === "reminders") {
    btnRecordatorios?.classList.add("is-active");
    showRecordatoriosView();
  } else if (tab === "admin") {
    const user = getSessionUser();
    if (!user || user.role !== "admin") {
      switchTab("inicio");
      return;
    }
    btnAdmin?.classList.add("is-active");
    showAdminView();
  } else {
    btnFichas?.classList.add("is-active");
    showLibrary();
  }
}

export function unmountAdminChannels() {
  const nav = document.getElementById("admin-nav");
  if (nav) nav.hidden = true;
}

export function mountAdminChannels() {
  const user = getSessionUser();
  if (!user) {
    unmountAdminChannels();
    return;
  }

  const adminNav = document.getElementById("admin-nav");
  if (adminNav) {
    adminNav.hidden = false;
    const btnAdmin = document.getElementById("nav-btn-admin");
    if (btnAdmin) btnAdmin.hidden = user.role !== "admin";

    if (!adminNav.dataset.bound) {
      adminNav.dataset.bound = "1";
      document.getElementById("nav-btn-inicio")?.addEventListener("click", () => switchTab("inicio"));
      document.getElementById("nav-btn-fichas")?.addEventListener("click", () => switchTab("fichas"));
      document.getElementById("nav-btn-pacientes")?.addEventListener("click", () => switchTab("pacientes"));
      document.getElementById("nav-btn-consultorio")?.addEventListener("click", () => switchTab("consultorio"));
      document.getElementById("nav-btn-clara")?.addEventListener("click", () => switchTab("clara"));
      document.getElementById("nav-btn-interacciones")?.addEventListener("click", () => switchTab("interacciones"));
      document.getElementById("nav-btn-recordatorios")?.addEventListener("click", () => switchTab("recordatorios"));
      document.getElementById("nav-btn-admin")?.addEventListener("click", () => switchTab("admin"));
      document.getElementById("brand-logo")?.addEventListener("click", (e) => {
        e.preventDefault();
        switchTab("inicio");
      });
    }
  }

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
