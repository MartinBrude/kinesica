import { switchTab } from "./app-tabs-switch.js";
import { closeAllDropdowns } from "./app-tabs-dropdowns.js";
import { closeMobileNav, toggleMobileNav } from "./app-tabs-mobile.js";

export function bindAdminNavOnce(adminNav) {
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

  document.getElementById("nav-btn-fichas")?.addEventListener("click", () => switchTab("fichas"));
  document.getElementById("nav-btn-pacientes")?.addEventListener("click", () => switchTab("pacientes"));
  document.getElementById("nav-btn-consultorio-agendar")?.addEventListener("click", () => switchTab("consultorio", "agendar"));
  document.getElementById("nav-btn-consultorio-horarios")?.addEventListener("click", () => switchTab("consultorio", "horarios"));
  document.getElementById("nav-btn-consultorio-honorarios")?.addEventListener("click", () => switchTab("consultorio", "horarios"));
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

  document.getElementById("dock-btn-inicio")?.addEventListener("click", () => switchTab("inicio"));
  document.getElementById("dock-btn-agendar")?.addEventListener("click", () => switchTab("consultorio", "agendar"));
  document.getElementById("dock-btn-interacciones")?.addEventListener("click", () => switchTab("interacciones"));
  document.getElementById("dock-btn-recordatorios")?.addEventListener("click", () => switchTab("recordatorios"));
  document.getElementById("dock-btn-menu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMobileNav();
  });
}
