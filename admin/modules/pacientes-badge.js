import { api } from "./api.js?v=79";
import { countMissingPhoneFromList } from "./pacientes-identifiers.js";
import {
  getPacientesCache,
  getIsBadgeRefreshing,
  setIsBadgeRefreshing,
  getBadgePollTimer,
  setBadgePollTimer,
  PACIENTES_BADGE_POLL_INTERVAL_MS,
} from "./pacientes-state.js";

export function setPacientesMissingPhoneBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show
    ? `${n === 1 ? "1 contacto" : `${n} contactos`} sin teléfono en el directorio`
    : "";

  for (const id of ["nav-badge-clinica", "nav-badge-pacientes"]) {
    const el = document.getElementById(id);
    if (!el) continue;
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

  const clinicaBtn = document.getElementById("nav-btn-clinica");
  if (clinicaBtn) {
    if (show) clinicaBtn.setAttribute("aria-label", `Clínica, ${aria}`);
    else clinicaBtn.removeAttribute("aria-label");
  }
}

export function syncPacientesBadgeFromCache() {
  setPacientesMissingPhoneBadge(countMissingPhoneFromList(getPacientesCache()));
}

export async function refreshPacientesMissingPhoneBadge() {
  if (getIsBadgeRefreshing()) return;
  const view = document.getElementById("view-pacientes");
  if (view && !view.hidden && getPacientesCache().length > 0) {
    syncPacientesBadgeFromCache();
    return;
  }

  setIsBadgeRefreshing(true);
  try {
    const resp = await api(`pacientes.php?counts_only=1&_t=${Date.now()}`, { cache: "no-store" });
    if (!resp || (resp.status !== "success" && resp.ok !== true)) return;
    const count = typeof resp.missing_phone_count === "number" ? resp.missing_phone_count : 0;
    setPacientesMissingPhoneBadge(count);
  } catch {
    /* silencioso: el badge no debe romper el admin */
  } finally {
    setIsBadgeRefreshing(false);
  }
}

export function startPacientesBadgePoll() {
  stopPacientesBadgePoll();
  refreshPacientesMissingPhoneBadge();
  setBadgePollTimer(setInterval(() => {
    if (document.visibilityState !== "visible") return;
    refreshPacientesMissingPhoneBadge();
  }, PACIENTES_BADGE_POLL_INTERVAL_MS));
}

export function stopPacientesBadgePoll() {
  const timer = getBadgePollTimer();
  if (timer) {
    clearInterval(timer);
    setBadgePollTimer(null);
  }
}
