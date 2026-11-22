/**
 * Kinésica Admin - Badge de notificaciones de Reporte de Errores (solo Martín).
 */

import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";

/** Username que recibe el badge de reportes de errores. */
export const ERRORES_BADGE_USERNAME = "martin";

export function countOpenErrores(list) {
  return (Array.isArray(list) ? list : []).filter((e) => e && e.estado !== "resuelto").length;
}

export function canShowErroresBadge(user = getSessionUser()) {
  return String(user?.username || "").toLowerCase() === ERRORES_BADGE_USERNAME;
}

function applyBadgeEl(el, show, label, aria) {
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

/**
 * Actualiza el badge de Reporte de errores.
 * Solo Martín ve el contador (menú + grupo Administración).
 * Otros usuarios: oculta el badge del ítem Errores sin tocar el del grupo.
 */
export function setErroresPendingBadge(count) {
  const audience = canShowErroresBadge();
  const n = audience ? Math.max(0, Number(count) || 0) : 0;
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show
    ? `${n === 1 ? "1 error pendiente" : `${n} errores pendientes`} en Administración`
    : "";

  applyBadgeEl(document.getElementById("nav-badge-errores"), show, label, aria);

  if (!audience) return;

  applyBadgeEl(document.getElementById("nav-badge-admin"), show, label, aria);
  const adminBtn = document.getElementById("nav-btn-admin");
  if (adminBtn) {
    if (show) adminBtn.setAttribute("aria-label", `Administración, ${aria}`);
    else adminBtn.removeAttribute("aria-label");
  }
}

export async function refreshErroresPendingBadge() {
  if (!canShowErroresBadge()) {
    setErroresPendingBadge(0);
    return;
  }
  try {
    const resp = await api(`errores.php?counts_only=1&_t=${Date.now()}`, { cache: "no-store" });
    if (!resp || resp.status !== "success") return;
    const count =
      typeof resp.pending_count === "number"
        ? resp.pending_count
        : Number(resp.totales?.pendientes) || 0;
    setErroresPendingBadge(count);
  } catch {
    /* silencioso */
  }
}
