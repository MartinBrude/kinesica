/**
 * Kinésica Admin — Coordinador de Badges del Grupo Administración.
 * Centraliza la agregación de notificaciones del dropdown Administración
 * (Pendientes + Errores) para evitar sobrescrituras entre submódulos.
 */

import { getSessionUser } from "./auth.js?v=83";

let currentPendientesCount = 0;
let currentErroresCount = 0;

export function applyBadgeEl(el, show, label, aria) {
  if (!el) return;
  el.textContent = label;
  el.hidden = !show;
  el.setAttribute("aria-hidden", show ? "false" : "true");
  if (show) {
    el.setAttribute("aria-label", aria);
    el.title = aria;
  } else {
    el.removeAttribute("aria-label");
    el.removeAttribute("title");
  }
}

export function updateAdminGroupBadge() {
  const user = getSessionUser();
  const canSeePendientes = user?.role === "admin";
  const canSeeErrores = String(user?.username || "").toLowerCase() === "martin";

  const p = canSeePendientes ? currentPendientesCount : 0;
  const e = canSeeErrores ? currentErroresCount : 0;
  const total = p + e;

  const show = total > 0;
  const label = total > 99 ? "99+" : String(total);

  let aria = "";
  if (show) {
    if (p > 0 && e > 0) {
      aria = `${p === 1 ? "1 pendiente" : `${p} pendientes`} y ${e === 1 ? "1 error" : `${e} errores`} en Administración`;
    } else if (p > 0) {
      aria = `${p === 1 ? "1 pendiente" : `${p} pendientes`} en Administración`;
    } else {
      aria = `${e === 1 ? "1 error pendiente" : `${e} errores pendientes`} en Administración`;
    }
  }

  applyBadgeEl(document.getElementById("nav-badge-admin"), show, label, aria);
  const adminBtn = document.getElementById("nav-btn-admin");
  if (adminBtn) {
    if (show) adminBtn.setAttribute("aria-label", `Administración, ${aria}`);
    else adminBtn.removeAttribute("aria-label");
  }
}

export function recordAdminPendientesCount(count) {
  currentPendientesCount = Math.max(0, Number(count) || 0);
  updateAdminGroupBadge();
}

export function recordAdminErroresCount(count) {
  currentErroresCount = Math.max(0, Number(count) || 0);
  updateAdminGroupBadge();
}

export function clearAdminGroupBadges() {
  currentPendientesCount = 0;
  currentErroresCount = 0;
  applyBadgeEl(document.getElementById("nav-badge-admin"), false, "0", "");
  const adminBtn = document.getElementById("nav-btn-admin");
  if (adminBtn) adminBtn.removeAttribute("aria-label");
}
