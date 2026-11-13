/**
 * Kinésica Admin - Módulo de Interacciones WhatsApp (facade).
 */

export {
  AUTO_REFRESH_INTERVAL_MS,
  AUTO_REFRESH_START_HOUR,
  AUTO_REFRESH_END_HOUR,
} from "./interacciones-constants.js";

export { BADGE_POLL_INTERVAL_MS, setInteraccionesPendingBadge, refreshInteraccionesPendingBadge } from "./interacciones-badge.js";
export { isWithinAutoRefreshHours, showInteraccionesView, hideInteraccionesView } from "./interacciones-lifecycle.js";
export { loadInteracciones } from "./interacciones-load.js";
export { initInteraccionesModule } from "./interacciones-init.js";
