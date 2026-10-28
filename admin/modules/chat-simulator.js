/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara
 * Experiencia interactiva para probar el flujo de respuestas automáticas
 * a las opciones A-E, submenús y opciones personalizadas.
 */

import {
  getNowTimeStr,
  formatWhatsAppMarkdown,
  withMenuFooter,
  resolveOptionCText,
  resolveProfessionalSubmenu,
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
} from "./chat-simulator-engine.js";

let ctx = {
  defaults: {},
  inputs: {},
  getTexts: () => ({}),
  getCustomOptions: () => [],
};

export function setChatContext(next) {
  ctx = { ...ctx, ...next };
}

const chatMessagesEl = document.querySelector("#chat-demo-messages");
const chatFormEl = document.querySelector("#chat-demo-form");
const chatInputEl = document.querySelector("#chat-demo-input");
const chatQuickBtns = document.querySelectorAll(".chat-quick-btn");

let chatSubmenu = null;
let chatLang = "es";

export function appendChatMessage(text, sender = "bot") {
  if (!chatMessagesEl) return;
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${sender}`;
  
  const textNode = document.createElement("div");
  if (sender === "bot") {
    textNode.innerHTML = formatWhatsAppMarkdown(text);
  } else {
    textNode.textContent = text;
  }
  msgEl.appendChild(textNode);

  const timeNode = document.createElement("span");
  timeNode.className = "chat-msg-time";
  timeNode.textContent = getNowTimeStr();
  msgEl.appendChild(timeNode);

  chatMessagesEl.appendChild(msgEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function getLangOptionLetter() {
  const customOpts = (ctx.getCustomOptions && ctx.getCustomOptions()) || [];
  const usedLetters = new Set(["A", "B", "C", "D", "E"]);
  for (const opt of customOpts) {
    if (opt && opt.letter) usedLetters.add(String(opt.letter).trim().toUpperCase());
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 5; i < alphabet.length; i++) {
    if (!usedLetters.has(alphabet[i])) {
      return alphabet[i];
    }
  }
  return "F";
}

export function resetChatDemo(lang = chatLang) {
  if (!chatMessagesEl) return;
  chatMessagesEl.replaceChildren();
  chatSubmenu = null;
  chatLang = lang;
  let welcome;
  const langLetter = getLangOptionLetter();
  if (chatLang === "en") {
    welcome = ctx.inputs.menuWelcomeEn?.value?.trim() || ctx.getTexts().menu_welcome_en || ctx.defaults.menu_welcome_en;
    const langLineEn = `*${langLetter}.* 🇪🇸 Español`;
    if (!welcome.toUpperCase().includes(`*${langLetter}.*`) && !/español|espanol|spanish/i.test(welcome)) {
      welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${langLineEn}\n\n_(`) : `${welcome}\n${langLineEn}`;
    }
  } else {
    welcome = ctx.inputs.menuWelcome?.value?.trim() || ctx.getTexts().menu_welcome || ctx.defaults.menu_welcome;
    if (ctx.getCustomOptions() && ctx.getCustomOptions().length > 0) {
      const extraLines = ctx.getCustomOptions()
        .filter((o) => o.letter && o.label)
        .map((o) => `*${o.letter.toUpperCase()}.* ${o.label}`)
        .join("\n");
      if (extraLines && !welcome.toUpperCase().includes(`*${ctx.getCustomOptions()[0].letter.toUpperCase()}.*`)) {
        welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${extraLines}\n\n_(`) : `${welcome}\n${extraLines}`;
      }
    }
    const langLineEs = `*${langLetter}.* 🌐 English`;
    if (!welcome.toUpperCase().includes(`*${langLetter}.*`) && !/english/i.test(welcome)) {
      welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${langLineEs}\n\n_(`) : `${welcome}\n${langLineEs}`;
    }
  }
  appendChatMessage(welcome, "bot");
}

function handleChatUserInput(inputRaw) {
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");
  const norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (norm === "menu" || norm === "reiniciar" || norm === "hola" || norm === "buenas" || norm === "hello" || norm === "hi" || norm === "start") {
    setTimeout(() => resetChatDemo(chatLang), 400);
    return;
  }

  const matchedCustom = ctx.getCustomOptions().find((o) => {
    const l = String(o.letter || "").toLowerCase();
    return l && (norm === l || norm === `opcion ${l}` || norm === `option ${l}` || norm.startsWith(`${l}.`) || norm.startsWith(`${l} -`));
  });
  if (matchedCustom) {
    chatSubmenu = null;
    const resp = matchedCustom.response || "Información no disponible.";
    setTimeout(() => appendChatMessage(withMenuFooter(resp, chatLang), "bot"), 450);
    return;
  }

  const langLetter = getLangOptionLetter().toLowerCase();
  const isOptionLang = norm === langLetter || norm === `${langLetter}.` || norm === `opcion ${langLetter}` || norm === `option ${langLetter}` || norm.startsWith(`${langLetter} -`) || norm.startsWith(`${langLetter}-`);

  if (norm === "english" || norm === "ingles" || norm.includes("in english") || (isOptionLang && chatLang === "es")) {
    chatSubmenu = null;
    chatLang = "en";
    setTimeout(() => resetChatDemo("en"), 400);
    return;
  }
  if (norm === "espanol" || norm === "spanish" || norm.includes("in spanish") || (isOptionLang && chatLang === "en")) {
    chatSubmenu = null;
    chatLang = "es";
    setTimeout(() => resetChatDemo("es"), 400);
    return;
  }

  if (chatSubmenu === "turnos") {
    if (norm === "1" || norm === "agendar" || norm === "book" || norm === "schedule") {
      chatSubmenu = null;
      const optA = (chatLang === "en")
        ? (ctx.inputs.optAEn?.value?.trim() || ctx.getTexts().opt_a_text_en || ctx.defaults.opt_a_text_en)
        : (ctx.inputs.optA?.value?.trim() || ctx.getTexts().opt_a_text || ctx.defaults.opt_a_text);
      setTimeout(() => appendChatMessage(optA, "bot"), 500);
      return;
    }
    if (norm === "2" || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel") {
      chatSubmenu = "buscar_dni";
      const optA2 = (chatLang === "en")
        ? (ctx.inputs.optA2En?.value?.trim() || ctx.getTexts().opt_a2_text_en || ctx.defaults.opt_a2_text_en)
        : (ctx.inputs.optA2?.value?.trim() || ctx.getTexts().opt_a2_text || ctx.defaults.opt_a2_text);
      setTimeout(() => appendChatMessage(optA2, "bot"), 600);
      return;
    }
  }

  if (chatSubmenu === "buscar_dni") {
    const docMatch = norm.match(/^(?:dni|documento|pasaporte|doc|id|passport)?\s*([0-9a-zA-Z.\s-]{6,15})$/i);
    const cleanDoc = docMatch ? docMatch[1].replace(/[.\s-]/g, "").toUpperCase() : "";
    chatSubmenu = null;
    setTimeout(() => {
      const notFoundMsg = (chatLang === "en")
        ? `We didn't find any scheduled appointments associated with document *${cleanDoc || input}*.\n\n_(Type *MENU* to return to the menu)_`
        : `No encontramos turnos agendados asociados al documento *${cleanDoc || input}*.\n\n_(Escribí *MENU* para volver al inicio)_`;
      appendChatMessage(notFoundMsg, "bot");
    }, 600);
    return;
  }

  if (chatSubmenu === "profesional") {
    const { proMsg, alertTarget, optionLabel } = resolveProfessionalSubmenu(norm, chatLang, ctx);
    chatSubmenu = null;
    const patientMessage = input;
    setTimeout(() => {
      appendChatMessage(proMsg, "bot");
      notifyProfessionalFromSimulator(alertTarget, optionLabel, patientMessage, (errNotice) => appendChatMessage(errNotice, "bot"));
    }, 500);
    return;
  }

  const mainResp = resolveMainMenuResponse(norm, chatLang, ctx);
  if (mainResp.handled) {
    chatSubmenu = mainResp.nextSubmenu;
    setTimeout(() => appendChatMessage(mainResp.text, "bot"), 450);
    return;
  }

  setTimeout(() => {
    const fallbackMsg = (chatLang === "en")
      ? "I'm sorry, I couldn't understand that option. Please reply with one of the menu letters or type *MENU* 🙌."
      : "Disculpame, no llegué a comprender esa opción. Por favor ingresá una de las letras del menú o escribí *MENU* 🙌.";
    appendChatMessage(fallbackMsg, "bot");
  }, 500);
}

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
