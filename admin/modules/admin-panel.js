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

export function setAdminActiveSection(section = "usuarios") {
  const norm = String(section || "").toLowerCase().trim();
  let target = "usuarios";
  if (norm === "gastos") target = "gastos";
  else if (norm === "errores" || norm === "reportes") target = "errores";
  else if (norm === "backups" || norm === "copias" || norm === "copias-seguridad") target = "backups";

  const cardUsuarios = document.getElementById("admin-usuarios-card");
  const cardGastos = document.getElementById("admin-gastos-card");
  const cardErrores = document.getElementById("admin-errores-card");
  const cardBackups = document.getElementById("admin-backups-card");

  if (cardUsuarios) cardUsuarios.hidden = target !== "usuarios";
  if (cardGastos) cardGastos.hidden = target !== "gastos";
  if (cardErrores) cardErrores.hidden = target !== "errores";
  if (cardBackups) cardBackups.hidden = target !== "backups";

  const heroTitle = document.getElementById("admin-hero-title");
  if (heroTitle) {
    const titles = {
      usuarios: "Administración · Usuarios",
      gastos: "Administración · Registro de Gastos",
      errores: "Administración · Reporte de Errores",
      backups: "Administración · Copias de Seguridad",
    };
    heroTitle.textContent = titles[target] || "Administración del Sistema";
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

export const scrollToAdminSection = setAdminActiveSection;

export function showAdminView(section = "usuarios") {
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    dialogAlert("Sección reservada exclusivamente a administradores.");
    return;
  }

  const validSection = ["usuarios", "gastos", "errores", "backups"].includes(String(section).toLowerCase())
    ? String(section).toLowerCase()
    : "usuarios";

  const view = switchActiveView("view-admin");
  if (view) {
    try {
      sessionStorage.setItem("kinesica_admin_view", JSON.stringify({ view: "admin", section: validSection }));
    } catch {}
    setAdminActiveSection(validSection);
    loadAdminData();
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
