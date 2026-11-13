/**
 * Kinésica Admin - Módulo de Configuración Unificada (facade).
 */

import { renderOptCText } from "./menu-texts.js?v=3";
import { DEFAULT_CLARA_TEXTS } from "./config-defaults.js?v=5";
import {
  showConsultorioView,
  hideConsultorioView,
  hideClaraView,
  showConfiguracionView,
  hideConfiguracionView,
} from "./config-views.js?v=4";

export { DEFAULT_CLARA_TEXTS };
export { showConsultorioView, hideConsultorioView, hideClaraView, showConfiguracionView, hideConfiguracionView };
export { appendChatMessage, resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=18";

export { showClaraView, switchConfigSubtab } from "./configuracion-nav.js";
export { initConfiguracionModule } from "./configuracion-init.js";
export { loadConfigData } from "./configuracion-clara-data.js";

export function previewOptCText(optC, fees) {
  return renderOptCText(optC, fees);
}
