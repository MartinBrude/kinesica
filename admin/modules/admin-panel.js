/**
 * Kinésica Admin - Módulo de Administración ("Admin del Admin")
 * Exclusivo para usuarios con rol 'admin'.
 * Supervisa el equipo de profesionales (altas/bajas) y el balance de gastos operativos multimoneda.
 */

import { getSessionUser } from "./auth.js?v=81";
import { dialogAlert, switchActiveView } from "./dom.js?v=78";
import {
  initProfesionalesUI,
  loadProfesionalesData,
  closeProfModal,
  isProfModalOpen,
} from "./admin-profesionales.js?v=84";
import {
  initGastosUI,
  loadGastosData,
  closeGastoModal,
  isGastoModalOpen,
} from "./admin-gastos.js?v=82";
import {
  initErroresUI,
  loadErroresData,
  closeErrorModal,
  isErrorModalOpen,
} from "./admin-errores.js";

const viewAdmin = document.querySelector("#view-admin");

export function scrollToAdminSection(section) {
  if (!section) return;
  const map = {
    usuarios: "admin-usuarios-card",
    profesionales: "admin-usuarios-card",
    gastos: "admin-gastos-card",
    errores: "admin-errores-card",
    backups: "admin-backups-card",
    copias: "admin-backups-card",
    "copias-seguridad": "admin-backups-card",
  };
  const targetId = map[String(section).toLowerCase()];
  if (!targetId) return;

  setTimeout(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 60);
}

export function showAdminView(section = null) {
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    dialogAlert("Sección reservada exclusivamente a administradores.");
    return;
  }

  const view = switchActiveView("view-admin");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "admin", section: section || "" }));
    } catch {}
    loadAdminData();
    if (section) {
      scrollToAdminSection(section);
    }
  }
}

export function hideAdminView() {
  if (viewAdmin) viewAdmin.hidden = true;
}

export async function loadAdminData() {
  await Promise.allSettled([
    loadProfesionalesData(loadAdminData),
    loadGastosData(loadAdminData),
    loadErroresData(loadAdminData),
  ]);
}

export function initAdminModule() {
  initProfesionalesUI({ onReload: loadAdminData });
  initGastosUI({ onReload: loadAdminData });
  initErroresUI({ onReload: loadAdminData });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (isProfModalOpen()) closeProfModal();
      if (isGastoModalOpen()) closeGastoModal();
      if (isErrorModalOpen()) closeErrorModal();
    }
  });
}
