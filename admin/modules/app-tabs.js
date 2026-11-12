/**
 * Kinésica Admin - Gestión de Pestañas y Navegación Principal
 * Controla la activación de secciones del menú superior y los canales de administración.
 */

import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { showLibrary } from "./library.js?v=94";
import { showPacientesView, hidePacientesView } from "./pacientes.js?v=12";
import { showDashboardView, hideDashboardView, updateDashboardClara, updateDashboardBooking } from "./dashboard.js?v=13";
import { showConsultorioView, hideConsultorioView, showClaraView, hideClaraView } from "./configuracion.js?v=39";
import { showAdminView, hideAdminView } from "./admin-panel.js?v=94";
import { showInteraccionesView, hideInteraccionesView } from "./interacciones.js?v=16";
import { showRecordatoriosView, hideRecordatoriosView } from "./recordatorios.js?v=24";
import { showEncuestasView, hideEncuestasView } from "./encuestas.js?v=2";
import { applyHoursToRuntime } from "./horarios.js?v=4";

export function closeAllDropdowns() {
  document.querySelectorAll(".nav-dropdown").forEach((el) => {
    el.classList.remove("is-open");
    el.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
  });
}

export function closeMobileNav() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("is-nav-open");
  const toggle = document.getElementById("btn-nav-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  }
  const backdrop = document.getElementById("admin-nav-backdrop");
  if (backdrop) backdrop.hidden = true;
}

export function openMobileNav() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add("is-nav-open");
  const toggle = document.getElementById("btn-nav-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú");
  }
  const backdrop = document.getElementById("admin-nav-backdrop");
  if (backdrop) backdrop.hidden = false;
}

export function toggleMobileNav() {
  if (document.documentElement.classList.contains("is-nav-open")) closeMobileNav();
  else openMobileNav();
}

/** @param {string} tab @param {string} [subtab] @param {{editId?: string}|null} [routeState] */
export function switchTab(tab, subtab, routeState = null) {
  const btnClinica = document.querySelector("#nav-btn-clinica");
  const btnFichas = document.querySelector("#nav-btn-fichas");
  const btnPacientes = document.querySelector("#nav-btn-pacientes");
  const btnConsultorio = document.querySelector("#nav-btn-consultorio");
  const btnConsultorioAgendar = document.querySelector("#nav-btn-consultorio-agendar");
  const btnConsultorioHorarios = document.querySelector("#nav-btn-consultorio-horarios");
  const btnConsultorioHonorarios = document.querySelector("#nav-btn-consultorio-honorarios");
  const btnWhatsapp = document.querySelector("#nav-btn-whatsapp");
  const btnInteracciones = document.querySelector("#nav-btn-interacciones");
  const btnRecordatorios = document.querySelector("#nav-btn-recordatorios");
  const btnEncuestas = document.querySelector("#nav-btn-encuestas");
  const btnClara = document.querySelector("#nav-btn-clara");
  const btnClaraEstado = document.querySelector("#nav-btn-clara-estado");
  const btnClaraMensajes = document.querySelector("#nav-btn-clara-mensajes");
  const btnClaraPlantilla = document.querySelector("#nav-btn-clara-plantilla");
  const btnClaraPoliticas = document.querySelector("#nav-btn-clara-politicas");
  const btnClaraSimulador = document.querySelector("#nav-btn-clara-simulador");
  const btnAdmin = document.querySelector("#nav-btn-admin");
  const btnAdminUsuarios = document.querySelector("#nav-btn-admin-usuarios");
  const btnAdminGastos = document.querySelector("#nav-btn-admin-gastos");
  const btnAdminErrores = document.querySelector("#nav-btn-admin-errores");
  const btnAdminBackups = document.querySelector("#nav-btn-admin-backups");
  const btnAdminServicios = document.querySelector("#nav-btn-admin-servicios");
  const btnAdminCampana = document.querySelector("#nav-btn-admin-campana");
  const btnAdminCreativos = document.querySelector("#nav-btn-admin-creativos");

  document.querySelectorAll(".admin-nav .btn, .admin-nav .nav-dropdown-item").forEach((b) => b.classList.remove("is-active"));
  closeAllDropdowns();
  closeMobileNav();

  hideDashboardView();
  hidePacientesView();
  hideConsultorioView();
  hideClaraView();
  hideInteraccionesView();
  hideRecordatoriosView();
  hideEncuestasView();
  hideAdminView();

  if (tab === "inicio") {
    showDashboardView();
  } else if (tab === "pacientes") {
    btnClinica?.classList.add("is-active");
    btnPacientes?.classList.add("is-active");
    showPacientesView();
  } else if (tab === "consultorio" || tab === "agendar" || tab === "horarios" || tab === "honorarios") {
    btnConsultorio?.classList.add("is-active");
    let section = subtab || null;
    if (!section) {
      if (tab === "agendar") section = "agendar";
      else if (tab === "horarios") section = "horarios";
      else if (tab === "honorarios") section = "honorarios";
      else section = "agendar";
    }
    if (section === "horarios") btnConsultorioHorarios?.classList.add("is-active");
    else if (section === "honorarios") btnConsultorioHonorarios?.classList.add("is-active");
    else btnConsultorioAgendar?.classList.add("is-active");
    showConsultorioView(section);
  } else if (tab === "clara" || tab === "configuracion") {
    btnClara?.classList.add("is-active");
    const section = subtab || "mensajes";
    if (section === "estado") btnClaraEstado?.classList.add("is-active");
    else if (section === "plantilla") btnClaraPlantilla?.classList.add("is-active");
    else if (section === "politicas") btnClaraPoliticas?.classList.add("is-active");
    else if (section === "simulador") btnClaraSimulador?.classList.add("is-active");
    else btnClaraMensajes?.classList.add("is-active");
    showClaraView(section);
  } else if (tab === "interacciones" || tab === "chats" || tab === "whatsapp") {
    btnWhatsapp?.classList.add("is-active");
    btnInteracciones?.classList.add("is-active");
    showInteraccionesView();
  } else if (tab === "recordatorios" || tab === "reminders") {
    btnWhatsapp?.classList.add("is-active");
    btnRecordatorios?.classList.add("is-active");
    showRecordatoriosView();
  } else if (tab === "creativos" || tab === "galeria" || tab === "campana-ig" || tab === "campanas-ig" || tab === "instagram" || (tab === "admin" && subtab === "creativos")) {
    btnWhatsapp?.classList.add("is-active");
    btnAdminCreativos?.classList.add("is-active");
    showAdminView("creativos", routeState);
  } else if (tab === "encuestas" || tab === "encuesta") {
    btnEncuestas?.classList.add("is-active");
    showEncuestasView();
  } else if (
    tab === "admin" ||
    tab === "administracion" ||
    tab === "usuarios" ||
    tab === "gastos" ||
    tab === "errores" ||
    tab === "reportes" ||
    tab === "backups" ||
    tab === "copias" ||
    tab === "copias-seguridad" ||
    tab === "servicios" ||
    tab === "consumos" ||
    tab === "cuotas" ||
    tab === "campana" ||
    tab === "campaña" ||
    tab === "turnos-campana"
  ) {
    const user = getSessionUser();
    if (!user || user.role !== "admin") {
      switchTab("inicio");
      return;
    }
    btnAdmin?.classList.add("is-active");
    let section = subtab || null;
    if (!section) {
      if (tab === "usuarios") section = "usuarios";
      else if (tab === "gastos") section = "gastos";
      else if (tab === "errores" || tab === "reportes") section = "errores";
      else if (tab === "backups" || tab === "copias" || tab === "copias-seguridad") section = "backups";
      else if (tab === "servicios" || tab === "consumos" || tab === "cuotas") section = "servicios";
      else if (tab === "campana" || tab === "campaña" || tab === "turnos-campana") section = "campana";
      else section = "usuarios";
    }
    if (section === "gastos") {
      btnAdminGastos?.classList.add("is-active");
    } else if (section === "errores") {
      btnAdminErrores?.classList.add("is-active");
    } else if (section === "backups") {
      btnAdminBackups?.classList.add("is-active");
    } else if (section === "servicios") {
      btnAdminServicios?.classList.add("is-active");
    } else if (section === "campana" || section === "campaña" || section === "turnos-campana") {
      btnAdminCampana?.classList.add("is-active");
    } else {
      btnAdminUsuarios?.classList.add("is-active");
    }
    showAdminView(section);
  } else {
    btnClinica?.classList.add("is-active");
    btnFichas?.classList.add("is-active");
    showLibrary();
  }
}

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
  setAdminOnlyVisibility(false);
}

function bindAdminNavOnce(adminNav) {
  if (!adminNav || adminNav.dataset.bound === "1") return;
  adminNav.dataset.bound = "1";

  const setupDropdown = (groupEl, triggerBtn) => {
    if (!groupEl || !triggerBtn) return;
    groupEl.addEventListener("mouseenter", () => {
      if (window.matchMedia("(max-width: 800px)").matches) return;
      document.querySelectorAll(".nav-dropdown").forEach((el) => {
        if (el !== groupEl) {
          el.classList.remove("is-open");
          el.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
        }
      });
      groupEl.classList.add("is-open");
      triggerBtn.setAttribute("aria-expanded", "true");
    });

    groupEl.addEventListener("mouseleave", () => {
      if (window.matchMedia("(max-width: 800px)").matches) return;
      groupEl.classList.remove("is-open");
      triggerBtn.setAttribute("aria-expanded", "false");
    });

    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = groupEl.classList.contains("is-open");
      closeAllDropdowns();
      if (!isOpen) {
        groupEl.classList.add("is-open");
        triggerBtn.setAttribute("aria-expanded", "true");
      }
    });
  };

  setupDropdown(document.getElementById("nav-group-clinica"), document.getElementById("nav-btn-clinica"));
  setupDropdown(document.getElementById("nav-group-consultorio"), document.getElementById("nav-btn-consultorio"));
  setupDropdown(document.getElementById("nav-group-whatsapp"), document.getElementById("nav-btn-whatsapp"));
  setupDropdown(document.getElementById("nav-group-clara"), document.getElementById("nav-btn-clara"));
  setupDropdown(document.getElementById("nav-group-admin"), document.getElementById("nav-btn-admin"));

  ["#nav-btn-encuestas", "#brand-logo"].forEach((id) => {
    document.querySelector(id)?.addEventListener("mouseenter", closeAllDropdowns);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-dropdown")) closeAllDropdowns();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
      closeMobileNav();
    }
  });

  document.getElementById("btn-nav-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileNav();
  });
  document.getElementById("admin-nav-backdrop")?.addEventListener("click", () => closeMobileNav());

  document.getElementById("nav-btn-fichas")?.addEventListener("click", () => switchTab("fichas"));
  document.getElementById("nav-btn-pacientes")?.addEventListener("click", () => switchTab("pacientes"));
  document.getElementById("nav-btn-consultorio-agendar")?.addEventListener("click", () => switchTab("consultorio", "agendar"));
  document.getElementById("nav-btn-consultorio-horarios")?.addEventListener("click", () => switchTab("consultorio", "horarios"));
  document.getElementById("nav-btn-consultorio-honorarios")?.addEventListener("click", () => switchTab("consultorio", "honorarios"));
  document.getElementById("nav-btn-clara-estado")?.addEventListener("click", () => switchTab("clara", "estado"));
  document.getElementById("nav-btn-clara-mensajes")?.addEventListener("click", () => switchTab("clara", "mensajes"));
  document.getElementById("nav-btn-clara-plantilla")?.addEventListener("click", () => switchTab("clara", "plantilla"));
  document.getElementById("nav-btn-clara-politicas")?.addEventListener("click", () => switchTab("clara", "politicas"));
  document.getElementById("nav-btn-clara-simulador")?.addEventListener("click", () => switchTab("clara", "simulador"));
  document.getElementById("nav-btn-interacciones")?.addEventListener("click", () => switchTab("interacciones"));
  document.getElementById("nav-btn-recordatorios")?.addEventListener("click", () => switchTab("recordatorios"));
  document.getElementById("nav-btn-encuestas")?.addEventListener("click", () => switchTab("encuestas"));
  document.getElementById("nav-btn-admin-usuarios")?.addEventListener("click", () => switchTab("admin", "usuarios"));
  document.getElementById("nav-btn-admin-gastos")?.addEventListener("click", () => switchTab("admin", "gastos"));
  document.getElementById("nav-btn-admin-errores")?.addEventListener("click", () => switchTab("admin", "errores"));
  document.getElementById("nav-btn-admin-backups")?.addEventListener("click", () => switchTab("admin", "backups"));
  document.getElementById("nav-btn-admin-servicios")?.addEventListener("click", () => switchTab("admin", "servicios"));
  document.getElementById("nav-btn-admin-campana")?.addEventListener("click", () => switchTab("admin", "campana"));
  document.getElementById("nav-btn-admin-creativos")?.addEventListener("click", () => switchTab("creativos"));
  document.getElementById("brand-logo")?.addEventListener("click", (e) => {
    e.preventDefault();
    switchTab("inicio");
  });
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
