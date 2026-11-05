/**
 * Kinésica Admin - Gestión de Pestañas y Navegación Principal
 * Controla la activación de secciones del menú superior y los canales de administración.
 */

import { api } from "./api.js?v=77";
import { getSessionUser } from "./auth.js?v=83";
import { showLibrary } from "./library.js?v=93";
import { showPacientesView, hidePacientesView } from "./pacientes.js?v=5";
import { showDashboardView, hideDashboardView, updateDashboardClara, updateDashboardBooking } from "./dashboard.js?v=11";
import { showConsultorioView, hideConsultorioView, showClaraView, hideClaraView } from "./configuracion.js?v=28";
import { showAdminView, hideAdminView } from "./admin-panel.js?v=14";
import { showInteraccionesView, hideInteraccionesView } from "./interacciones.js?v=12";
import { showRecordatoriosView, hideRecordatoriosView } from "./recordatorios.js?v=11";
import { applyHoursToRuntime } from "./horarios.js?v=3";

export function closeAllDropdowns() {
  document.querySelectorAll(".nav-dropdown").forEach((el) => {
    el.classList.remove("is-open");
    el.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
  });
}

export function switchTab(tab, subtab) {
  const btnClinica = document.querySelector("#nav-btn-clinica");
  const btnFichas = document.querySelector("#nav-btn-fichas");
  const btnPacientes = document.querySelector("#nav-btn-pacientes");
  const btnConsultorio = document.querySelector("#nav-btn-consultorio");
  const btnWhatsapp = document.querySelector("#nav-btn-whatsapp");
  const btnInteracciones = document.querySelector("#nav-btn-interacciones");
  const btnRecordatorios = document.querySelector("#nav-btn-recordatorios");
  const btnClara = document.querySelector("#nav-btn-clara");
  const btnAdmin = document.querySelector("#nav-btn-admin");
  const btnAdminUsuarios = document.querySelector("#nav-btn-admin-usuarios");
  const btnAdminGastos = document.querySelector("#nav-btn-admin-gastos");
  const btnAdminErrores = document.querySelector("#nav-btn-admin-errores");
  const btnAdminBackups = document.querySelector("#nav-btn-admin-backups");
  const btnAdminServicios = document.querySelector("#nav-btn-admin-servicios");

  document.querySelectorAll(".admin-nav .btn, .admin-nav .nav-dropdown-item").forEach((b) => b.classList.remove("is-active"));
  closeAllDropdowns();

  hideDashboardView();
  hidePacientesView();
  hideConsultorioView();
  hideClaraView();
  hideInteraccionesView();
  hideRecordatoriosView();
  hideAdminView();

  if (tab === "inicio") {
    showDashboardView();
  } else if (tab === "pacientes") {
    btnClinica?.classList.add("is-active");
    btnPacientes?.classList.add("is-active");
    showPacientesView();
  } else if (tab === "consultorio" || tab === "horarios" || tab === "honorarios") {
    btnConsultorio?.classList.add("is-active");
    showConsultorioView();
  } else if (tab === "clara" || tab === "configuracion") {
    btnClara?.classList.add("is-active");
    showClaraView();
  } else if (tab === "interacciones" || tab === "chats" || tab === "whatsapp") {
    btnWhatsapp?.classList.add("is-active");
    btnInteracciones?.classList.add("is-active");
    showInteraccionesView();
  } else if (tab === "recordatorios" || tab === "reminders") {
    btnWhatsapp?.classList.add("is-active");
    btnRecordatorios?.classList.add("is-active");
    showRecordatoriosView();
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
    tab === "cuotas"
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

export function unmountAdminChannels() {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("is-admin-role");
  }
  const nav = document.getElementById("admin-nav");
  if (nav) nav.hidden = true;
  const navGroupAdmin = document.getElementById("nav-group-admin");
  if (navGroupAdmin) navGroupAdmin.hidden = true;
  const btnAdmin = document.getElementById("nav-btn-admin");
  if (btnAdmin) btnAdmin.hidden = true;
  const dashCardAdmin = document.getElementById("dash-card-admin");
  if (dashCardAdmin) dashCardAdmin.hidden = true;
}

export function mountAdminChannels() {
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    unmountAdminChannels();
    return;
  }

  if (typeof document !== "undefined") {
    document.documentElement.classList.add("is-admin-role");
  }

  const adminNav = document.getElementById("admin-nav");
  if (adminNav) {
    adminNav.hidden = false;
    const navGroupAdmin = document.getElementById("nav-group-admin");
    if (navGroupAdmin) navGroupAdmin.hidden = false;
    const btnAdmin = document.getElementById("nav-btn-admin");
    if (btnAdmin) btnAdmin.hidden = false;
    const dashCardAdmin = document.getElementById("dash-card-admin");
    if (dashCardAdmin) dashCardAdmin.hidden = false;

    if (!adminNav.dataset.bound) {
      adminNav.dataset.bound = "1";

      const setupDropdown = (groupEl, triggerBtn) => {
        if (!groupEl || !triggerBtn) return;
        groupEl.addEventListener("mouseenter", () => {
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
      setupDropdown(document.getElementById("nav-group-whatsapp"), document.getElementById("nav-btn-whatsapp"));
      setupDropdown(document.getElementById("nav-group-admin"), document.getElementById("nav-btn-admin"));

      ["#nav-btn-consultorio", "#nav-btn-clara", "#brand-logo"].forEach((id) => {
        document.querySelector(id)?.addEventListener("mouseenter", closeAllDropdowns);
      });

      document.addEventListener("click", (e) => {
        if (!e.target.closest(".nav-dropdown")) closeAllDropdowns();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllDropdowns();
      });

      document.getElementById("nav-btn-fichas")?.addEventListener("click", () => switchTab("fichas"));
      document.getElementById("nav-btn-pacientes")?.addEventListener("click", () => switchTab("pacientes"));
      document.getElementById("nav-btn-consultorio")?.addEventListener("click", () => switchTab("consultorio"));
      document.getElementById("nav-btn-clara")?.addEventListener("click", () => switchTab("clara"));
      document.getElementById("nav-btn-interacciones")?.addEventListener("click", () => switchTab("interacciones"));
      document.getElementById("nav-btn-recordatorios")?.addEventListener("click", () => switchTab("recordatorios"));
      document.getElementById("nav-btn-admin-usuarios")?.addEventListener("click", () => switchTab("admin", "usuarios"));
      document.getElementById("nav-btn-admin-gastos")?.addEventListener("click", () => switchTab("admin", "gastos"));
      document.getElementById("nav-btn-admin-errores")?.addEventListener("click", () => switchTab("admin", "errores"));
      document.getElementById("nav-btn-admin-backups")?.addEventListener("click", () => switchTab("admin", "backups"));
      document.getElementById("nav-btn-admin-servicios")?.addEventListener("click", () => switchTab("admin", "servicios"));
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
