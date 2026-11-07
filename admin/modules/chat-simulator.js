/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara
 * Experiencia interactiva para probar el flujo de respuestas automáticas
 * a las opciones A-E, submenús y opciones personalizadas.
 */

import {
  getNowTimeStr,
  formatWhatsAppMarkdown,
  withMenuFooter,
  pickSimText,
  resolveProfessionalSubmenu,
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
} from "./chat-simulator-engine.js?v=4";

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

function buildWelcomeMessage(lang) {
  let welcome;
  const langLetter = getLangOptionLetter();
  welcome = (lang === "en")
    ? pickSimText(ctx.inputs.menuWelcomeEn, "menu_welcome_en", ctx)
    : pickSimText(ctx.inputs.menuWelcome, "menu_welcome", ctx);
  const customs = (ctx.getCustomOptions && ctx.getCustomOptions()) || [];
  if (customs.length > 0) {
    const extraLines = customs
      .filter((o) => o.letter && o.label)
      .map((o) => `*${String(o.letter).toUpperCase()}.* ${o.label}`)
      .join("\n");
    const firstLtr = String(customs[0].letter || "").toUpperCase();
    if (extraLines && firstLtr && !welcome.toUpperCase().includes(`*${firstLtr}.*`)) {
      welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${extraLines}\n\n_(`) : `${welcome}\n${extraLines}`;
    }
  }
  if (lang === "en") {
    const langLineEn = `*${langLetter}.* 🇪🇸 Español`;
    if (!welcome.toUpperCase().includes(`*${langLetter}.*`) && !/español|espanol|spanish/i.test(welcome)) {
      welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${langLineEn}\n\n_(`) : `${welcome}\n${langLineEn}`;
    }
  } else {
    const langLineEs = `*${langLetter}.* 🌐 English`;
    if (!welcome.toUpperCase().includes(`*${langLetter}.*`) && !/english/i.test(welcome)) {
      welcome = welcome.includes("\n\n_(") ? welcome.replace("\n\n_(", `\n${langLineEs}\n\n_(`) : `${welcome}\n${langLineEs}`;
    }
  }
  return welcome;
}

export function resetChatDemo(lang = chatLang) {
  if (!chatMessagesEl) return;
  chatMessagesEl.replaceChildren();
  chatSubmenu = null;
  chatLang = lang;
  appendChatMessage(buildWelcomeMessage(chatLang), "bot");
}

/** Letras del menú principal en el orden en que se muestran (*A.* … *G.* …). */
function mainMenuLettersInOrder(menuText) {
  const found = [];
  const re = /\*([A-Za-z])\.\*/g;
  let m;
  while ((m = re.exec(String(menuText || "")))) {
    const l = m[1].toLowerCase();
    if (!found.includes(l)) found.push(l);
  }
  return found.length ? found : ["a", "b", "c", "d", "e", "f"];
}

/** En menú principal, 1→1.ª letra, 2→2.ª, etc. Con submenú activo no mapea. */
function mapMainMenuDigitToLetter(norm, submenu, menuText) {
  if (submenu) return norm;
  const dig = String(norm || "").match(/^([1-9])\.?$/);
  if (!dig) return norm;
  const letters = mainMenuLettersInOrder(menuText);
  const idx = parseInt(dig[1], 10) - 1;
  return letters[idx] || norm;
}

function handleChatUserInput(inputRaw) {
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");
  let norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Mapear dígitos con el menú ya armado (A–E + customs + idioma en orden visual).
  norm = mapMainMenuDigitToLetter(norm, chatSubmenu, buildWelcomeMessage(chatLang));

  if (norm === "hello" || norm === "hi" || norm === "hey" || norm === "good morning" || norm === "good afternoon") {
    chatSubmenu = null;
    chatLang = "en";
    setTimeout(() => appendChatMessage(buildWelcomeMessage("en"), "bot"), 400);
    return;
  }
  if (norm === "hola" || norm === "buenas" || norm === "buen dia" || norm === "buenas tardes") {
    chatSubmenu = null;
    chatLang = "es";
    setTimeout(() => appendChatMessage(buildWelcomeMessage("es"), "bot"), 400);
    return;
  }
  if (norm === "menu" || norm === "reiniciar" || norm === "start") {
    chatSubmenu = null;
    setTimeout(() => appendChatMessage(buildWelcomeMessage(chatLang), "bot"), 400);
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
    setTimeout(() => appendChatMessage(buildWelcomeMessage("en"), "bot"), 400);
    return;
  }
  if (norm === "espanol" || norm === "spanish" || norm.includes("in spanish") || (isOptionLang && chatLang === "en")) {
    chatSubmenu = null;
    chatLang = "es";
    setTimeout(() => appendChatMessage(buildWelcomeMessage("es"), "bot"), 400);
    return;
  }

  const isExactMainOption = /^(?:(?:opcion|option)\s+[a-e]|[a-e]\.?)$/i.test(norm);
  if (isExactMainOption) {
    const mainResp = resolveMainMenuResponse(norm.replace(/\.$/, ""), chatLang, ctx);
    if (mainResp.handled) {
      chatSubmenu = mainResp.nextSubmenu;
      setTimeout(() => appendChatMessage(mainResp.text, "bot"), 450);
      return;
    }
  }

  if (chatSubmenu === "turnos") {
    // El link de agendar ya viene en el submenú; 1 (y 2 por compat) = consultar/cancelar.
    if (
      norm === "1" || norm === "1." || norm === "2" || norm === "2."
      || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel"
      || norm === "my appointments" || norm === "mis turnos"
    ) {
      chatSubmenu = "buscar_dni";
      const optA2 = (chatLang === "en")
        ? pickSimText(ctx.inputs.optA2En, "opt_a2_text_en", ctx)
        : pickSimText(ctx.inputs.optA2, "opt_a2_text", ctx);
      setTimeout(() => appendChatMessage(optA2, "bot"), 600);
      return;
    }
    if (norm === "agendar" || norm === "book" || norm === "schedule") {
      chatSubmenu = null;
      const optA = (chatLang === "en")
        ? pickSimText(ctx.inputs.optAEn, "opt_a_text_en", ctx)
        : pickSimText(ctx.inputs.optA, "opt_a_text", ctx);
      setTimeout(() => appendChatMessage(optA, "bot"), 500);
      return;
    }
  }

  if (chatSubmenu === "buscar_dni" && /\d/.test(norm)) {
    const docMatch = norm.match(/^(?:dni|documento|pasaporte|doc|id|passport)?\s*:?\s*([0-9a-zA-Z.\s-]{5,15})$/i);
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
    const { proMsg, alertTarget, optionLabel } = resolveProfessionalSubmenu(norm.replace(/\.$/, ""), chatLang, ctx);
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

  // Texto libre que no es A–E: ofrecer contacto con un profesional (opción E).
  const startsWithGreeting = /^(?:hola|buenas|buen\s+d[ií]a|hello|hi|hey|good\s+(?:morning|afternoon|evening)|qu[eé]\s+tal|c[oó]mo\s+est[aá]s?)\b/iu.test(norm);
  if (startsWithGreeting || norm.length <= 2) {
    if (/^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b/i.test(norm)) chatLang = "en";
    else if (/^(?:hola|buenas|buen\s+d[ií]a)\b/i.test(norm)) chatLang = "es";
    setTimeout(() => appendChatMessage(buildWelcomeMessage(chatLang), "bot"), 500);
    return;
  }
  const intro = (chatLang === "en")
    ? "Would you like to speak directly with one of our practitioners?\n\n"
    : "¿Querés hablar directamente con uno de los profesionales?\n\n";
  const optE = (chatLang === "en")
    ? pickSimText(ctx.inputs.optEEn, "opt_e_text_en", ctx)
    : pickSimText(ctx.inputs.optE, "opt_e_text", ctx);
  chatSubmenu = "profesional";
  setTimeout(() => appendChatMessage(intro + optE, "bot"), 500);
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
