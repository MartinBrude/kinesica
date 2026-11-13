/** Estado compartido del directorio de pacientes. */

let pacientesCache = [];
let activeFilterProf = "todos";
let pendingSearchFromUrl = "";
let isBadgeRefreshing = false;
let badgePollTimer = null;

export const PACIENTES_BADGE_POLL_INTERVAL_MS = 2 * 60 * 1000;

export const viewPacientes = typeof document !== "undefined" ? document.querySelector("#view-pacientes") : null;
export const listEl = typeof document !== "undefined" ? document.querySelector("#pacientes-list-tbody") : null;
export const searchInput = typeof document !== "undefined" ? document.querySelector("#search-pacientes") : null;
export const profFilter = typeof document !== "undefined" ? document.querySelector("#filter-pacientes-prof") : null;
export const btnNuevo = typeof document !== "undefined" ? document.querySelector("#btn-nuevo-paciente") : null;
export const btnBackupSql = typeof document !== "undefined" ? document.querySelector("#btn-backup-sql") : null;
export const countEl = typeof document !== "undefined" ? document.querySelector("#pacientes-total-count") : null;

export function getPacientesCache() { return pacientesCache; }
export function setPacientesCache(list) { pacientesCache = Array.isArray(list) ? list : []; }
export function updatePacientesCache(mutator) {
  pacientesCache = typeof mutator === "function" ? mutator(pacientesCache) : pacientesCache;
}

export function getActiveFilterProf() { return activeFilterProf; }
export function setActiveFilterProf(value) { activeFilterProf = value; }

export function getPendingSearchFromUrl() { return pendingSearchFromUrl; }
export function setPendingSearchFromUrl(value) { pendingSearchFromUrl = value; }

export function getIsBadgeRefreshing() { return isBadgeRefreshing; }
export function setIsBadgeRefreshing(value) { isBadgeRefreshing = value; }

export function getBadgePollTimer() { return badgePollTimer; }
export function setBadgePollTimer(timer) { badgePollTimer = timer; }

export function initPendingSearchFromUrl() {
  if (typeof window === "undefined" || !window.location) return;
  try {
    const p = new URLSearchParams(window.location.search);
    let q = (p.get("buscar") || p.get("q") || "").trim();
    if (!q && window.location.hash.includes("?")) {
      const hp = new URLSearchParams(window.location.hash.split("?")[1]);
      q = (hp.get("buscar") || hp.get("q") || "").trim();
    }
    if (q) {
      pendingSearchFromUrl = q;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("kinesica_pending_paciente_search", q);
      }
    }
  } catch { /* ignore */ }
}
