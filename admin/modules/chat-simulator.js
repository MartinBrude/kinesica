/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara (facade).
 */

import {
  setSimContext,
  chatFormEl,
  chatInputEl,
  chatQuickBtns,
  resetChatDemo,
  appendChatMessage,
  getLangOptionLetter,
  buildWelcomeMessage,
  mapMainMenuDigitToLetter,
  replyAsBot,
} from "./chat-simulator-core.js";
import { handleChatUserInput } from "./chat-simulator-input.js";

export function setChatContext(next) {
  setSimContext(next);
}

export {
  appendChatMessage,
  getLangOptionLetter,
  resetChatDemo,
};

export function initChatSimulator() {
  chatFormEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = chatInputEl?.value?.trim();
    if (!val) return;
    chatInputEl.value = "";
    handleChatUserInput(val);
  });

  chatQuickBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.chatAct;
      if (act) handleChatUserInput(act);
    });
  });
}
