import { api } from "./api.js?v=79";
import { parseBoolean } from "../ficha-rules.mjs?v=89";
import {
  getCachedInteractions,
  getDaysWindow,
  getIsBadgeRefreshing,
  setIsBadgeRefreshing,
  getBadgePollTimer,
  setBadgePollTimer,
  getIsRefreshing,
  getPendingMutations,
} from "./interacciones-state.js";

export const BADGE_POLL_INTERVAL_MS = 2 * 60 * 1000;

function countPendingFromList(list) {
  const active = (Array.isArray(list) ? list : []).filter((i) => i && parseBoolean(i.archived) !== true);
  return active.filter((i) => parseBoolean(i?.answered) !== true).length;
}

export function setInteraccionesPendingBadge(count) {
  const n = Math.max(0, Number(count) || 0);
  const label = n > 99 ? "99+" : String(n);
  const show = n > 0;
  const aria = show
    ? `${n === 1 ? "1 pendiente" : `${n} pendientes`} de respuesta en la bandeja`
    : "";

  for (const id of ["nav-badge-meta", "nav-badge-interacciones", "dock-badge-interacciones"]) {
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

  const metaBtn = document.getElementById("nav-btn-whatsapp");
  if (metaBtn) {
    if (show) metaBtn.setAttribute("aria-label", `Meta, ${aria}`);
    else metaBtn.removeAttribute("aria-label");
  }
}

export function syncBadgeFromCache() {
  setInteraccionesPendingBadge(countPendingFromList(getCachedInteractions()));
}

export async function refreshInteraccionesPendingBadge() {
  if (getIsBadgeRefreshing()) return;
  const view = document.getElementById("view-interacciones");
  if (view && !view.hidden && (getIsRefreshing() || getPendingMutations() > 0)) return;

  setIsBadgeRefreshing(true);
  try {
    const days = getDaysWindow() || 7;
    const resp = await api(
      `interacciones.php?days=${encodeURIComponent(String(days))}&counts_only=1&_t=${Date.now()}`,
      { cache: "no-store" }
    );
    if (!resp || resp.ok !== true) return;
    const count =
      typeof resp.unanswered_count === "number"
        ? resp.unanswered_count
        : countPendingFromList(resp.items);
    setInteraccionesPendingBadge(count);
  } catch {
    /* silencioso */
  } finally {
    setIsBadgeRefreshing(false);
  }
}

export function startBadgePoll() {
  stopBadgePoll();
  refreshInteraccionesPendingBadge();
  setBadgePollTimer(setInterval(() => {
    if (document.visibilityState !== "visible") return;
    refreshInteraccionesPendingBadge();
  }, BADGE_POLL_INTERVAL_MS));
}

export function stopBadgePoll() {
  const timer = getBadgePollTimer();
  if (timer) {
    clearInterval(timer);
    setBadgePollTimer(null);
  }
}
