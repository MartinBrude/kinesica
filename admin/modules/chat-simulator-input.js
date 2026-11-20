/**
 * Entrada de usuario del simulador Clara (alineada a kinesica-bot modo menú).
 */

import {
  pickSimText,
  resolveProfessionalSubmenu,
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
  withMenuFooter,
} from "./chat-simulator-engine.js?v=7";
import {
  isThanksMessage, getThanksText, isClaraBotQuery, getClaraBotText,
  isMediosPagoQuery, getMediosPagoText, getSaludoBreveText,
  getMenuAntiSpamText, resolveUnrecognizedReply,
} from "./chat-simulator-faq.js?v=1";
import {
  appendChatMessage, replyAsBot, buildWelcomeMessage, getLangOptionLetter,
  mapMainMenuDigitToLetter, getChatSubmenu, setChatSubmenu, getChatLang,
  setChatLang, getSimContext, markMenuShown, wasMenuShownWithin,
  resetUnrecCount, bumpUnrecCount,
} from "./chat-simulator-core.js";

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
  if (norm === "menu" || norm === "reiniciar" || norm === "start") {
    setChatSubmenu(null);
    setTimeout(() => showWelcome(getChatLang(), { force: true }), 400);
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

  const isExactMainOption = /^(?:(?:opcion|option)\s+[a-e]|[a-e]\.?)$/i.test(norm);
  if (isExactMainOption) {
    const mainResp = resolveMainMenuResponse(norm.replace(/\.$/, ""), getChatLang(), ctx, { exactLetterOnly: true });
    if (mainResp.handled) {
      setChatSubmenu(mainResp.nextSubmenu);
      setTimeout(() => {
        replyHandled(mainResp.text);
        if (mainResp.followup) {
          setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
        }
      }, 450);
      return;
    }
  }

  if (getChatSubmenu() === "turnos") {
    if (
      norm === "1" || norm === "1." || norm === "2" || norm === "2."
      || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel"
      || norm === "my appointments" || norm === "mis turnos"
    ) {
      setChatSubmenu("buscar_dni");
      const optA2 = (getChatLang() === "en")
        ? pickSimText(ctx.inputs.optA2En, "opt_a2_text_en", ctx)
        : pickSimText(ctx.inputs.optA2, "opt_a2_text", ctx);
      setTimeout(() => replyHandled(optA2), 600);
      return;
    }
    if (norm === "agendar" || norm === "book" || norm === "schedule") {
      setChatSubmenu(null);
      const optA = (getChatLang() === "en")
        ? pickSimText(ctx.inputs.optAEn, "opt_a_text_en", ctx)
        : pickSimText(ctx.inputs.optA, "opt_a_text", ctx);
      setTimeout(() => replyHandled(optA), 500);
      return;
    }
  }

  if (getChatSubmenu() === "buscar_dni" && /\d/.test(norm)) {
    const docMatch = norm.match(/^(?:dni|documento|pasaporte|doc|id|passport)?\s*:?\s*([0-9a-zA-Z.\s-]{5,15})$/i);
    const cleanDoc = docMatch ? docMatch[1].replace(/[.\s-]/g, "").toUpperCase() : "";
    setChatSubmenu(null);
    setTimeout(() => {
      const notFoundMsg = (getChatLang() === "en")
        ? `We didn't find any scheduled appointments associated with document *${cleanDoc || input}*.\n\n_(Type *MENU* to return to the menu)_`
        : `No encontramos turnos agendados asociados al documento *${cleanDoc || input}*.\n\n_(Escribí *MENU* para volver al inicio)_`;
      replyHandled(notFoundMsg);
    }, 600);
    return;
  }

  if (getChatSubmenu() === "profesional") {
    const { proMsg, alertTarget, optionLabel } = resolveProfessionalSubmenu(norm.replace(/\.$/, ""), getChatLang(), ctx);
    setChatSubmenu(null);
    const patientMessage = input;
    setTimeout(() => {
      replyHandled(proMsg);
      notifyProfessionalFromSimulator(alertTarget, optionLabel, patientMessage, (errNotice) => appendChatMessage(errNotice, "bot"));
    }, 500);
    return;
  }

  const mainResp = resolveMainMenuResponse(norm, getChatLang(), ctx);
  if (mainResp.handled) {
    setChatSubmenu(mainResp.nextSubmenu);
    setTimeout(() => {
      replyHandled(mainResp.text, {
        viaNaturalLanguage: mainResp.viaNaturalLanguage,
        letter: mainResp.letter,
      });
      if (mainResp.followup) {
        setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
      }
    }, 450);
    return;
  }

  // Texto libre no mapeado: 1º aclarar / menú; 2º derivar (igual que el bot).
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

  const count = bumpUnrecCount();
  const unrec = resolveUnrecognizedReply(getChatLang(), {
    unrecCount: count,
    menuShownRecently: wasMenuShownWithin(MENU_RECENT_MS),
  });
  setTimeout(() => {
    if (unrec.kind === "menu") {
      showWelcome(getChatLang());
      return;
    }
    replyAsBot(unrec.text);
    if (unrec.alert) {
      resetUnrecCount();
      setChatSubmenu(null);
      notifyProfessionalFromSimulator(
        "norberto",
        "texto libre (2º no reconocido)",
        input,
        (errNotice) => appendChatMessage(errNotice, "bot"),
      );
    }
  }, 500);
}
