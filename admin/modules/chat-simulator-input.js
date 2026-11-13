/**
 * Entrada de usuario del simulador Clara.
 */

import {
  pickSimText,
  resolveProfessionalSubmenu,
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
  withMenuFooter,
} from "./chat-simulator-engine.js?v=6";
import {
  appendChatMessage,
  replyAsBot,
  buildWelcomeMessage,
  getLangOptionLetter,
  mapMainMenuDigitToLetter,
  getChatSubmenu,
  setChatSubmenu,
  getChatLang,
  setChatLang,
  getSimContext,
} from "./chat-simulator-core.js";

export function handleChatUserInput(inputRaw) {
  const ctx = getSimContext();
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");
  let norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  // Mapear dígitos con el menú ya armado (A–E + customs + idioma en orden visual).
  norm = mapMainMenuDigitToLetter(norm, getChatSubmenu(), buildWelcomeMessage(getChatLang()));

  if (norm === "hello" || norm === "hi" || norm === "hey" || norm === "good morning" || norm === "good afternoon") {
    setChatSubmenu(null);
    setChatLang("en");
    setTimeout(() => replyAsBot(buildWelcomeMessage("en")), 400);
    return;
  }
  if (norm === "hola" || norm === "buenas" || norm === "buen dia" || norm === "buenas tardes") {
    setChatSubmenu(null);
    setChatLang("es");
    setTimeout(() => replyAsBot(buildWelcomeMessage("es")), 400);
    return;
  }
  if (norm === "menu" || norm === "reiniciar" || norm === "start") {
    setChatSubmenu(null);
    setTimeout(() => replyAsBot(buildWelcomeMessage(getChatLang())), 400);
    return;
  }

  const matchedCustom = ctx.getCustomOptions().find((o) => {
    const l = String(o.letter || "").toLowerCase();
    return l && (norm === l || norm === `opcion ${l}` || norm === `option ${l}` || norm.startsWith(`${l}.`) || norm.startsWith(`${l} -`));
  });
  if (matchedCustom) {
    setChatSubmenu(null);
    const resp = matchedCustom.response || "Información no disponible.";
    setTimeout(() => replyAsBot(withMenuFooter(resp, getChatLang())), 450);
    return;
  }

  const langLetter = getLangOptionLetter().toLowerCase();
  const isOptionLang = norm === langLetter || norm === `${langLetter}.` || norm === `opcion ${langLetter}` || norm === `option ${langLetter}` || norm.startsWith(`${langLetter} -`) || norm.startsWith(`${langLetter}-`);

  if (norm === "english" || norm === "ingles" || norm.includes("in english") || (isOptionLang && getChatLang() === "es")) {
    setChatSubmenu(null);
    setChatLang("en");
    setTimeout(() => replyAsBot(buildWelcomeMessage("en")), 400);
    return;
  }
  if (norm === "espanol" || norm === "spanish" || norm.includes("in spanish") || (isOptionLang && getChatLang() === "en")) {
    setChatSubmenu(null);
    setChatLang("es");
    setTimeout(() => replyAsBot(buildWelcomeMessage("es")), 400);
    return;
  }

  const isExactMainOption = /^(?:(?:opcion|option)\s+[a-e]|[a-e]\.?)$/i.test(norm);
  if (isExactMainOption) {
    const mainResp = resolveMainMenuResponse(norm.replace(/\.$/, ""), getChatLang(), ctx, { exactLetterOnly: true });
    if (mainResp.handled) {
      setChatSubmenu(mainResp.nextSubmenu);
      // Letra exacta del menú: sin saludo tradicional (igual que el bot).
      setTimeout(() => {
        replyAsBot(mainResp.text);
        if (mainResp.followup) {
          setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
        }
      }, 450);
      return;
    }
  }

  if (getChatSubmenu() === "turnos") {
    // El link de agendar ya viene en el submenú; 1 (y 2 por compat) = consultar/cancelar.
    if (
      norm === "1" || norm === "1." || norm === "2" || norm === "2."
      || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel"
      || norm === "my appointments" || norm === "mis turnos"
    ) {
      setChatSubmenu("buscar_dni");
      const optA2 = (getChatLang() === "en")
        ? pickSimText(ctx.inputs.optA2En, "opt_a2_text_en", ctx)
        : pickSimText(ctx.inputs.optA2, "opt_a2_text", ctx);
      setTimeout(() => replyAsBot(optA2), 600);
      return;
    }
    if (norm === "agendar" || norm === "book" || norm === "schedule") {
      setChatSubmenu(null);
      const optA = (getChatLang() === "en")
        ? pickSimText(ctx.inputs.optAEn, "opt_a_text_en", ctx)
        : pickSimText(ctx.inputs.optA, "opt_a_text", ctx);
      setTimeout(() => replyAsBot(optA), 500);
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
      replyAsBot(notFoundMsg);
    }, 600);
    return;
  }

  if (getChatSubmenu() === "profesional") {
    const { proMsg, alertTarget, optionLabel } = resolveProfessionalSubmenu(norm.replace(/\.$/, ""), getChatLang(), ctx);
    setChatSubmenu(null);
    const patientMessage = input;
    setTimeout(() => {
      replyAsBot(proMsg);
      notifyProfessionalFromSimulator(alertTarget, optionLabel, patientMessage, (errNotice) => appendChatMessage(errNotice, "bot"));
    }, 500);
    return;
  }

  const mainResp = resolveMainMenuResponse(norm, getChatLang(), ctx);
  if (mainResp.handled) {
    setChatSubmenu(mainResp.nextSubmenu);
    setTimeout(() => {
      replyAsBot(mainResp.text, {
        viaNaturalLanguage: mainResp.viaNaturalLanguage,
        letter: mainResp.letter,
      });
      if (mainResp.followup) {
        setTimeout(() => appendChatMessage(mainResp.followup, "bot"), 900);
      }
    }, 450);
    return;
  }

  // Texto libre que no es A–E: ofrecer contacto con un profesional (opción E).
  const startsWithGreeting = /^(?:hola|buenas|buen\s+d[ií]a|hello|hi|hey|good\s+(?:morning|afternoon|evening)|qu[eé]\s+tal|c[oó]mo\s+est[aá]s?)\b/iu.test(norm);
  if (startsWithGreeting || norm.length <= 2) {
    if (/^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))\b/i.test(norm)) setChatLang("en");
    else if (/^(?:hola|buenas|buen\s+d[ií]a)\b/i.test(norm)) setChatLang("es");
    setTimeout(() => replyAsBot(buildWelcomeMessage(getChatLang())), 500);
    return;
  }
  const intro = (getChatLang() === "en")
    ? "Would you like to speak directly with one of our practitioners?\n\n"
    : "¿Querés hablar directamente con uno de los profesionales?\n\n";
  const optE = (getChatLang() === "en")
    ? pickSimText(ctx.inputs.optEEn, "opt_e_text_en", ctx)
    : pickSimText(ctx.inputs.optE, "opt_e_text", ctx);
  setChatSubmenu("profesional");
  setTimeout(() => replyAsBot(intro + optE), 500);
}

