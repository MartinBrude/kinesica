/**
 * Poll de la bandeja mientras hay takeover activo (mensajes del paciente en vivo).
 */
import { TAKEOVER_POLL_INTERVAL_MS } from "./interacciones-constants.js";
import {
  getTakeoverPollTimer,
  setTakeoverPollTimer,
  hasActiveTakeoverInCache,
  getIsRefreshing,
  getPendingMutations,
} from "./interacciones-state.js";

export function stopTakeoverPoll() {
  const timer = getTakeoverPollTimer();
  if (timer) {
    clearInterval(timer);
    setTakeoverPollTimer(null);
  }
}

export function syncTakeoverPoll() {
  const view = document.getElementById("view-interacciones");
  const shouldRun = Boolean(view && !view.hidden && hasActiveTakeoverInCache());
  if (!shouldRun) {
    stopTakeoverPoll();
    return;
  }
  if (getTakeoverPollTimer()) return;
  setTakeoverPollTimer(setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const v = document.getElementById("view-interacciones");
    if (!v || v.hidden) {
      stopTakeoverPoll();
      return;
    }
    if (!hasActiveTakeoverInCache()) {
      stopTakeoverPoll();
      return;
    }
    if (getIsRefreshing() || getPendingMutations() > 0) return;
    import("./interacciones-load.js?v=4")
      .then((m) => m.loadInteracciones(false, { quiet: true }))
      .catch(() => {});
  }, TAKEOVER_POLL_INTERVAL_MS));
}
