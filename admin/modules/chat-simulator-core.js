import {
  getNowTimeStr,
  formatWhatsAppMarkdown,
  withTraditionalFirstContactGreeting,
  pickSimText,
} from "./chat-simulator-engine.js?v=6";

let ctx = {
  defaults: {},
  inputs: {},
  getTexts: () => ({}),
  getCustomOptions: () => [],
};

export function setSimContext(next) {
  ctx = { ...ctx, ...next };
}

export function getSimContext() {
  return ctx;
}

export const chatMessagesEl = document.querySelector("#chat-demo-messages");
export const chatFormEl = document.querySelector("#chat-demo-form");
export const chatInputEl = document.querySelector("#chat-demo-input");
export const chatQuickBtns = document.querySelectorAll(".chat-quick-btn");

let chatSubmenu = null;
let chatLang = "es";
export const traditionalGreetingState = { used: false };
let botRepliedOnce = false;

export function getChatSubmenu() { return chatSubmenu; }
export function setChatSubmenu(value) { chatSubmenu = value; }
export function getChatLang() { return chatLang; }
export function setChatLang(value) { chatLang = value; }

export function replyAsBot(text, { viaNaturalLanguage = false, letter = null } = {}) {
  let out = text;
  if (viaNaturalLanguage && ["a", "b", "c", "d"].includes(letter)) {
    out = withTraditionalFirstContactGreeting(text, chatLang, traditionalGreetingState);
  }
  botRepliedOnce = true;
  appendChatMessage(out, "bot");
}

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

export function buildWelcomeMessage(lang) {
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
  traditionalGreetingState.used = false;
  botRepliedOnce = false;
}

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

export function mapMainMenuDigitToLetter(norm, submenu, menuText) {
  if (submenu) return norm;
  const dig = String(norm || "").match(/^([1-9])\.?$/);
  if (!dig) return norm;
  const letters = mainMenuLettersInOrder(menuText);
  const idx = parseInt(dig[1], 10) - 1;
  return letters[idx] || norm;
}
