import { resetChatDemo, initChatSimulator } from "./chat-simulator.js?v=20";
import { initMailPreview, refreshMailPreviewPrefill } from "./mail-preview.js?v=2";
import {
  showClaraView as showClaraSubView,
  switchConfigSubtab as switchConfigSubView,
} from "./config-views.js?v=4";
import { loadConfigData } from "./configuracion-clara-data.js";
import { loadEstadoServicios } from "./clara-estado-servicios.js?v=3";

export function showClaraView(section = "") {
  showClaraSubView(() => {
    loadConfigData();
    initMailPreview();
    refreshMailPreviewPrefill();
    const chatMessagesEl = document.querySelector("#chat-demo-messages");
    if (chatMessagesEl && chatMessagesEl.children.length === 0) resetChatDemo();
    if (section === "estado" || !section) {
      loadEstadoServicios();
    }
  }, section);
}

export function switchConfigSubtab(subtabId) {
  switchConfigSubView(subtabId, () => showClaraView(subtabId));
}
