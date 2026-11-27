/**
 * Entrada de usuario del simulador Clara (alineada a kinesica-bot modo menú).
 */

import {
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
  withMenuFooter,
} from "./chat-simulator-engine.js?v=8";
import {
  isThanksMessage, getThanksText, isClaraBotQuery, getClaraBotText,
  isMediosPagoQuery, getMediosPagoText, getSaludoBreveText,
  getMenuAntiSpamText, resolveUnrecognizedReply,
  isMenuCommand, isWhatsAppOnlyLineFaq, getWhatsAppOnlyLineText,
} from "./chat-simulator-faq.js?v=2";
import {
  appendChatMessage, replyAsBot, buildWelcomeMessage, getLangOptionLetter,
  mapMainMenuDigitToLetter, getChatSubmenu, setChatSubmenu, getChatLang,
  setChatLang, getSimContext, markMenuShown, wasMenuShownWithin,
  resetUnrecCount, bumpUnrecCount,
} from "./chat-simulator-core.js";
import {
  handleMultiLetterSequence,
  handleActiveSubmenu,
} from "./chat-simulator-submenus.js";

const MENU_RECENT_MS = 15 * 60 * 1000;
const MENU_ANTISPAM_MS = 60 * 1000;

/** @param {{ force?: boolean }} [opts] force=true → menú completo (MENU / cambio de idioma). */
function showWelcome(lang, opts = {}) {
  resetUnrecCount();
  if (!opts.force && wasMenuShownWithin(MENU_ANTISPAM_MS)) {
    replyAsBot(getMenuAntiSpamText(lang));
    return;
  }
  markMenuShown();
  replyAsBot(buildWelcomeMessage(lang));
}

function replyHandled(text, opts = {}) {
  resetUnrecCount();
  replyAsBot(text, opts);
}

function paymentMethodsFromDom() {
  return document.querySelector("#input-fee-payment-methods")?.value?.trim()
    || "Efectivo o transferencia bancaria";
}

export function handleChatUserInput(inputRaw) {
  const ctx = getSimContext();
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");
  let norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  norm = mapMainMenuDigitToLetter(norm, getChatSubmenu(), buildWelcomeMessage(getChatLang()));

  if (norm === "hello" || norm === "hi" || norm === "hey" || norm === "good morning" || norm === "good afternoon") {
    setChatSubmenu(null);
    setChatLang("en");
    setTimeout(() => {
      if (wasMenuShownWithin(MENU_RECENT_MS)) replyAsBot(getSaludoBreveText("en"));
      else showWelcome("en");
    }, 400);
    return;
  }
  if (norm === "hola" || norm === "buenas" || norm === "buen dia" || norm === "buenas tardes") {
    setChatSubmenu(null);
    setChatLang("es");
    setTimeout(() => {
      if (wasMenuShownWithin(MENU_RECENT_MS)) replyAsBot(getSaludoBreveText("es"));
      else showWelcome("es");
    }, 400);
    return;
  }
  if (isMenuCommand(norm)) {
    setChatSubmenu(null);
    setTimeout(() => showWelcome(getChatLang(), { force: true }), 400);
    return;
  }
  if (isWhatsAppOnlyLineFaq(input)) {
    setChatSubmenu(null);
    setTimeout(() => {
      replyHandled(getWhatsAppOnlyLineText(getChatLang()));
      setTimeout(() => showWelcome(getChatLang(), { force: true }), 900);
    }, 450);
    return;
  }

  const matchedCustom = ctx.getCustomOptions().find((o) => {
    const l = String(o.letter || "").toLowerCase();
    return l && (norm === l || norm === `opcion ${l}` || norm === `option ${l}` || norm.startsWith(`${l}.`) || norm.startsWith(`${l} -`));
  });
  if (matchedCustom) {
    setChatSubmenu(null);
    const resp = matchedCustom.response || "Información no disponible.";
    setTimeout(() => replyHandled(withMenuFooter(resp, getChatLang())), 450);
    return;
  }

  const langLetter = getLangOptionLetter().toLowerCase();
  const isOptionLang = norm === langLetter || norm === `${langLetter}.` || norm === `opcion ${langLetter}` || norm === `option ${langLetter}` || norm.startsWith(`${langLetter} -`) || norm.startsWith(`${langLetter}-`);

  if (norm === "english" || norm === "ingles" || norm.includes("in english") || (isOptionLang && getChatLang() === "es")) {
    setChatSubmenu(null);
    setChatLang("en");
    setTimeout(() => showWelcome("en", { force: true }), 400);
    return;
  }
  if (norm === "espanol" || norm === "spanish" || norm.includes("in spanish") || (isOptionLang && getChatLang() === "en")) {
    setChatSubmenu(null);
    setChatLang("es");
    setTimeout(() => showWelcome("es", { force: true }), 400);
    return;
  }

  if (isThanksMessage(norm)) {
    setTimeout(() => replyHandled(getThanksText(getChatLang())), 400);
    return;
  }
  if (isClaraBotQuery(input)) {
    setTimeout(() => replyHandled(getClaraBotText(getChatLang())), 450);
    return;
  }
  if (isMediosPagoQuery(input)) {
    setTimeout(() => replyHandled(getMediosPagoText(getChatLang(), paymentMethodsFromDom()), {
      viaNaturalLanguage: true,
      letter: "c",
    }), 450);
    return;
  }

  if (handleMultiLetterSequence(norm, langLetter, ctx, replyHandled)) return;

  if (/^(?:(?:opcion|option)\s+[a-e]|[a-e]\.?)$/i.test(norm)) {
    const mainResp = resolveMainMenuResponse(norm.replace(/\.$/, ""), getChatLang(), ctx, { exactLetterOnly: true });
    if (mainResp.handled) {
      setChatSubmenu(mainResp.nextSubmenu);
      setTimeout(() => {
        replyHandled(mainResp.text);
        if (mainResp.followup) setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
        if (mainResp.notifyTarget) {
          notifyProfessionalFromSimulator(mainResp.notifyTarget, mainResp.optionLabel || "E → Norberto Brude", input, (errNotice) => appendChatMessage(errNotice, "bot"));
        }
      }, 450);
      return;
    }
  }

  if (handleActiveSubmenu(norm, input, ctx, replyHandled)) return;

  const mainResp = resolveMainMenuResponse(norm, getChatLang(), ctx);
  if (mainResp.handled) {
    setChatSubmenu(mainResp.nextSubmenu);
    setTimeout(() => {
      replyHandled(mainResp.text, { viaNaturalLanguage: mainResp.viaNaturalLanguage, letter: mainResp.letter });
      if (mainResp.followup) setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
      if (mainResp.notifyTarget) {
        notifyProfessionalFromSimulator(mainResp.notifyTarget, mainResp.optionLabel || "E → Norberto Brude", input, (errNotice) => appendChatMessage(errNotice, "bot"));
      }
    }, 450);
    return;
  }

  const startsWithGreeting = /^(?:hola|buenas|buen\s+d[ií]a|hello|hi|hey|good\s+(?:morning|afternoon|evening)|qu[eé]\s+tal|c[oó]mo\s+est[aá]s?)\b/iu.test(norm);
  const greetingOnly = startsWithGreeting && norm.split(/\s+/).length <= 4
    && !/\b(?:turno|dolor|precio|donde|osde|agendar|appointment|pain|fee|where)\b/i.test(norm);
  if (greetingOnly || norm.length <= 2) {
    if (/^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b/i.test(norm)) setChatLang("en");
    else if (/^(?:hola|buenas|buen\s+d[ií]a)\b/i.test(norm)) setChatLang("es");
    setTimeout(() => {
      if (wasMenuShownWithin(MENU_RECENT_MS)) replyAsBot(getSaludoBreveText(getChatLang()));
      else showWelcome(getChatLang());
    }, 500);
    return;
  }

  const unrec = resolveUnrecognizedReply(getChatLang(), {
    unrecCount: bumpUnrecCount(),
    menuShownRecently: wasMenuShownWithin(MENU_RECENT_MS),
  });
  setTimeout(() => {
    if (unrec.kind === "menu") { showWelcome(getChatLang()); return; }
    replyAsBot(unrec.text);
    if (unrec.alert) {
      resetUnrecCount();
      setChatSubmenu(null);
      notifyProfessionalFromSimulator("norberto", "texto libre (2º no reconocido)", input, (errNotice) => appendChatMessage(errNotice, "bot"));
    }
  }, 500);
}
