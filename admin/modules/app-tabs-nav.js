import { switchTab } from "./app-tabs-switch.js";
import { closeAllDropdowns } from "./app-tabs-dropdowns.js";
import { closeMobileNav, toggleMobileNav } from "./app-tabs-mobile.js";

export function bindAdminNavOnce(adminNav) {
  if (!adminNav || adminNav.dataset.bound === "1") return;
  adminNav.dataset.bound = "1";

  const setupDropdown = (groupEl, triggerBtn) => {
    if (!groupEl || !triggerBtn) return;
    groupEl.addEventListener("mouseenter", () => {
      groupEl.classList.remove("is-closed");
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
      groupEl.classList.remove("is-closed");
      if (window.matchMedia("(max-width: 800px)").matches) return;
      groupEl.classList.remove("is-open");
      triggerBtn.setAttribute("aria-expanded", "false");
    });

    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isMobile = window.matchMedia("(max-width: 800px)").matches;
      if (isMobile) {
        const isOpen = groupEl.classList.contains("is-open");
        closeAllDropdowns();
        if (!isOpen) {
          groupEl.classList.remove("is-closed");
          groupEl.classList.add("is-open");
          triggerBtn.setAttribute("aria-expanded", "true");
        }
      } else {
        const defaultActions = {
          "nav-group-clinica": () => switchTab("fichas"),
          "nav-group-consultorio": () => switchTab("consultorio", "agendar"),
          "nav-group-whatsapp": () => switchTab("interacciones"),
          "nav-group-clara": () => switchTab("clara", "mensajes"),
          "nav-group-admin": () => switchTab("admin", "usuarios"),
        };
        const action = defaultActions[groupEl.id];
        closeAllDropdowns();
        if (action) {
          action();
        } else {
          const isOpen = groupEl.classList.contains("is-open");
          if (!isOpen) {
            groupEl.classList.remove("is-closed");
            groupEl.classList.add("is-open");
            triggerBtn.setAttribute("aria-expanded", "true");
          }
        }
      }
    });
  };

  setupDropdown(document.getElementById("nav-group-clinica"), document.getElementById("nav-btn-clinica"));
  setupDropdown(document.getElementById("nav-group-consultorio"), document.getElementById("nav-btn-consultorio"));
  setupDropdown(document.getElementById("nav-group-whatsapp"), document.getElementById("nav-btn-whatsapp"));
  setupDropdown(document.getElementById("nav-group-clara"), document.getElementById("nav-btn-clara"));
  setupDropdown(document.getElementById("nav-group-admin"), document.getElementById("nav-btn-admin"));

  document.querySelector("#brand-logo")?.addEventListener("mouseenter", closeAllDropdowns);

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

  const bindNavLink = (id, tab, subtab, extraAction) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      closeAllDropdowns();
      if (extraAction) extraAction();
      switchTab(tab, subtab);
    });
  };

  bindNavLink("nav-btn-fichas", "fichas");
  bindNavLink("nav-btn-pacientes", "pacientes");
  bindNavLink("nav-btn-consultorio-agendar", "consultorio", "agendar", () => {
    document.querySelector("[data-admin-booking-open]")?.click();
  });
  bindNavLink("nav-btn-consultorio-horarios", "consultorio", "horarios");
  bindNavLink("nav-btn-consultorio-honorarios", "consultorio", "honorarios");
  bindNavLink("nav-btn-clara-estado", "clara", "estado");
  bindNavLink("nav-btn-clara-mensajes", "clara", "mensajes");
  bindNavLink("nav-btn-clara-plantilla", "clara", "plantilla");
  bindNavLink("nav-btn-clara-politicas", "clara", "politicas");
  bindNavLink("nav-btn-clara-simulador", "clara", "simulador");
  bindNavLink("nav-btn-interacciones", "interacciones");
  bindNavLink("nav-btn-recordatorios", "recordatorios");
  bindNavLink("nav-btn-encuestas", "encuestas");
  bindNavLink("nav-btn-admin-usuarios", "admin", "usuarios");
  bindNavLink("nav-btn-admin-gastos", "admin", "gastos");
  bindNavLink("nav-btn-admin-errores", "admin", "errores");
  bindNavLink("nav-btn-admin-backups", "admin", "backups");
  bindNavLink("nav-btn-admin-servicios", "admin", "servicios");
  bindNavLink("nav-btn-admin-campana", "admin", "campana");
  bindNavLink("nav-btn-admin-creativos", "creativos");

  document.getElementById("brand-logo")?.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    switchTab("inicio");
  });

  document.getElementById("dock-btn-inicio")?.addEventListener("click", () => switchTab("inicio"));
  document.getElementById("dock-btn-agendar")?.addEventListener("click", () => {
    switchTab("consultorio", "agendar");
    document.querySelector("[data-admin-booking-open]")?.click();
  });
  document.getElementById("dock-btn-interacciones")?.addEventListener("click", () => switchTab("interacciones"));
  document.getElementById("dock-btn-recordatorios")?.addEventListener("click", () => switchTab("recordatorios"));
  document.getElementById("dock-btn-menu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileNav();
  });
}
