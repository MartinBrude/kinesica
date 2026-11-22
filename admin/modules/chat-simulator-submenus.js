/**
 * Submenús y secuencias multi-letra del simulador Clara.
 */

import {
  pickSimText,
  resolveProfessionalSubmenu,
  notifyProfessionalFromSimulator,
  resolveMainMenuResponse,
  withMenuFooter,
} from "./chat-simulator-engine.js?v=7";
import { parseMenuLetterSequence } from "./chat-simulator-faq.js?v=2";
import {
  appendChatMessage,
  getChatSubmenu,
  setChatSubmenu,
  getChatLang,
} from "./chat-simulator-core.js";

/**
 * Procesa secuencias multi-letra (ABC / A B C). Devuelve true si fue manejada.
 */
export function handleMultiLetterSequence(norm, langLetter, ctx, replyHandled) {
  const validLetters = new Set(["a", "b", "c", "d", "e", langLetter]);
  for (const opt of ctx.getCustomOptions() || []) {
    const l = String(opt.letter || "").trim().toLowerCase();
    if (l) validLetters.add(l);
  }
  const seqRaw = parseMenuLetterSequence(norm, validLetters);
  const seq = seqRaw ? seqRaw.filter((L) => L !== langLetter) : null;
  if (!seq || seq.length < 2) return false;

  const responses = [];
  let nextSub = null;
  for (const L of seq) {
    if (L === "a") nextSub = "turnos";
    else if (L === "e") nextSub = "profesional";
    const custom = (ctx.getCustomOptions() || []).find(
      (o) => String(o.letter || "").trim().toLowerCase() === L,
    );
    if (custom) {
      responses.push(withMenuFooter(custom.response || "Información no disponible.", getChatLang()));
      continue;
    }
    const mainResp = resolveMainMenuResponse(L, getChatLang(), ctx, { exactLetterOnly: true });
    if (mainResp.handled) {
      let block = mainResp.text;
      if (mainResp.followup) block = `${block}\n\n${mainResp.followup}`;
      responses.push(block);
    }
  }
  if (responses.length < 1) return false;

  setChatSubmenu(nextSub);
  setTimeout(() => {
    replyHandled(responses[0]);
    if (responses.length > 1) {
      setTimeout(() => appendChatMessage(responses.slice(1).join("\n\n"), "bot"), 900);
    }
  }, 450);
  return true;
}

/**
 * Procesa los submenús activos (`turnos`, `buscar_dni`, `profesional`). Devuelve true si fue manejado.
 */
export function handleActiveSubmenu(norm, input, ctx, replyHandled) {
  const submenu = getChatSubmenu();

  if (submenu === "turnos") {
    if (
      norm === "1" || norm === "1." || norm === "2" || norm === "2."
      || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel"
      || norm === "my appointments" || norm === "mis turnos"
    ) {
      setChatSubmenu("buscar_dni");
      const optA2 = getChatLang() === "en"
        ? pickSimText(ctx.inputs.optA2En, "opt_a2_text_en", ctx)
        : pickSimText(ctx.inputs.optA2, "opt_a2_text", ctx);
      setTimeout(() => replyHandled(optA2), 600);
      return true;
    }
    if (norm === "agendar" || norm === "book" || norm === "schedule") {
      setChatSubmenu(null);
      const optA = getChatLang() === "en"
        ? pickSimText(ctx.inputs.optAEn, "opt_a_text_en", ctx)
        : pickSimText(ctx.inputs.optA, "opt_a_text", ctx);
      setTimeout(() => replyHandled(optA), 500);
      return true;
    }
  }

  if (submenu === "buscar_dni" && /\d/.test(norm)) {
    const docMatch = norm.match(/^(?:dni|documento|pasaporte|doc|id|passport)?\s*:?\s*([0-9a-zA-Z.\s-]{5,15})$/i);
    const cleanDoc = docMatch ? docMatch[1].replace(/[.\s-]/g, "").toUpperCase() : "";
    setChatSubmenu(null);
    setTimeout(() => {
      const notFoundMsg = getChatLang() === "en"
        ? `We didn't find any scheduled appointments associated with document *${cleanDoc || input}*.\n\n_(Type *MENU* to return to the menu)_`
        : `No encontramos turnos agendados asociados al documento *${cleanDoc || input}*.\n\n_(Escribí *MENU* para volver al inicio)_`;
      replyHandled(notFoundMsg);
    }, 600);
    return true;
  }

  if (submenu === "profesional") {
    const { proMsg, alertTarget, optionLabel } = resolveProfessionalSubmenu(norm.replace(/\.$/, ""), getChatLang(), ctx);
    setChatSubmenu(null);
    setTimeout(() => {
      replyHandled(proMsg);
      notifyProfessionalFromSimulator(alertTarget, optionLabel, input, (errNotice) => appendChatMessage(errNotice, "bot"));
    }, 500);
    return true;
  }

  return false;
}
