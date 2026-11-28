/**
 * Kinésica Admin — Badge y control de digesto semanal de Pendientes.
 */

import { api } from "./api.js?v=79";
import { getSessionUser } from "./auth.js?v=83";
import { dialogAlert, dialogConfirm } from "./dom.js?v=79";
import { applyBadgeEl, recordAdminPendientesCount } from "./admin-group-badge.js";

export const PENDIENTES_BADGE_USERNAME = "norberto";

let cachedDigestPaused = true;

export function getCachedDigestPaused() {
  return cachedDigestPaused;
}

export function countOpenPendientes(list) {
  return (Array.isArray(list) ? list : []).filter((i) => i && i.estado !== "resuelto").length;
}

export function updateDigestToggleUI(isPaused) {
  cachedDigestPaused = Boolean(isPaused);
  const digestDot = document.querySelector("#admin-digest-pendientes-dot");
  const digestLabel = document.querySelector("#admin-digest-pendientes-label");
  const digestToggleBtn = document.querySelector("#admin-btn-toggle-digest-pendientes");
  if (digestDot) {
    digestDot.className = `dash-status-dot ${cachedDigestPaused ? "inactive" : "active"}`;
  }
  if (digestLabel) {
    digestLabel.textContent = cachedDigestPaused ? "Mails: Pausados" : "Mails: Activos";
  }
  if (digestToggleBtn) {
    digestToggleBtn.title = cachedDigestPaused
      ? "Los mails semanales de pendientes a Norberto están pausados. Tocá para reanudarlos."
      : "Los mails semanales de pendientes a Norberto están activos. Tocá para pausarlos.";
    digestToggleBtn.setAttribute("aria-label", digestToggleBtn.title);
  }
}

export function canShowPendientesBadge(user = getSessionUser()) {
  return user?.role === "admin";
}

export function setPendientesPendingBadge(count) {
  const audience = canShowPendientesBadge();
  const n = audience ? Math.max(0, Number(count) || 0) : 0;
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show ? `${n === 1 ? "1 pendiente" : `${n} pendientes`} en Administración` : "";

  applyBadgeEl(document.getElementById("nav-badge-pendientes"), show, label, aria);
  recordAdminPendientesCount(audience ? n : 0);
}

export async function refreshPendientesPendingBadge() {
  if (!canShowPendientesBadge()) {
    setPendientesPendingBadge(0);
    return;
  }
  try {
    const resp = await api(`pendientes.php?counts_only=1&_t=${Date.now()}`, { cache: "no-store" });
    if (!resp || resp.status !== "success") return;
    const count =
      typeof resp.pending_count === "number"
        ? resp.pending_count
        : Number(resp.totales?.pendientes) || 0;
    setPendientesPendingBadge(count);
  } catch {
    /* silencioso */
  }
}

export function initDigestToggleListener() {
  const digestToggleBtn = document.querySelector("#admin-btn-toggle-digest-pendientes");
  if (!digestToggleBtn) return;
  digestToggleBtn.addEventListener("click", async () => {
    const willPause = !getCachedDigestPaused();
    const msg = willPause
      ? "¿Pausar los recordatorios semanales por correo a Norberto?\n\nNo se enviarán digestos de pendientes los lunes hasta que los vuelvas a activar."
      : "¿Reanudar los recordatorios semanales por correo a Norberto?\n\nSe volverá a enviar el resumen de pendientes el próximo día hábil.";
    const ok = await dialogConfirm(msg);
    if (!ok) return;

    try {
      digestToggleBtn.disabled = true;
      const resp = await api("pendientes.php", {
        method: "POST",
        body: JSON.stringify({ action: "toggle_digest_pause", paused: willPause }),
      });
      if (resp && typeof resp.digest_paused === "boolean") {
        updateDigestToggleUI(resp.digest_paused);
      }
    } catch (err) {
      dialogAlert("No se pudo cambiar el estado de los mails: " + (err.message || "Error desconocido"));
    } finally {
      digestToggleBtn.disabled = false;
    }
  });
}
