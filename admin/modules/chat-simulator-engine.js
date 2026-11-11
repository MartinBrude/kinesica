/**
 * Kinésica Admin - Motor de Formato y Resolución del Simulador Clara
 * Formato Markdown, pie de menú, lógica de ramas conversacionales y alertas a profesionales.
 */

import { escapeHtml } from "./dom.js?v=79";
import { api } from "./api.js?v=79";
import { renderOptCText, renderOptCTextEn } from "./menu-texts.js?v=3";
import { isIncompleteClaraTextStub } from "./config-defaults.js?v=5";

export function pickSimText(inputEl, key, ctx) {
  const fromInput = inputEl?.value?.trim() || "";
  if (fromInput && !isIncompleteClaraTextStub(key, fromInput)) return fromInput;
  const fromTexts = String(ctx.getTexts()?.[key] || "").trim();
  if (fromTexts && !isIncompleteClaraTextStub(key, fromTexts)) return fromTexts;
  return ctx.defaults?.[key] || fromInput || fromTexts;
}

export function getNowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatWhatsAppMarkdown(rawText) {
  if (!rawText) return "";
  const escaped = escapeHtml(rawText);
  let formatted = escaped.replace(/\*([^*\n\r]+)\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/_([^_\n\r]+)_/g, "<em>$1</em>");
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#027eb5; text-decoration:underline;">$1</a>'
  );
  return formatted;
}

export function withMenuFooter(text, lang = "es") {
  const body = String(text || "").trim();
  if (!body) return body;
  const plain = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/menu/i.test(plain)) return body;
  const footer = (lang === "en") ? "_(Type *MENU* to see the options again)_" : "_(Escribí *MENU* para volver a ver las opciones)_";
  return `${body}\n\n${footer}`;
}

/** Saludo tradicional Kinésica (hora local del navegador, alineado al bot AR). */
export function kinesicaTraditionalGreeting(lang = "es", date = new Date()) {
  const hour = date.getHours();
  const isMorning = hour < 13;
  if (lang === "en") return isMorning ? "Good morning!" : "Good afternoon!";
  return isMorning ? "¡Buenos días!" : "¡Buenas tardes!";
}

/**
 * Anteponer saludo solo en primer contacto NL → texto puro de letra A–D.
 * `state` debe tener `{ used: boolean }` (se marca al anteponer o si el cuerpo ya saluda).
 */
export function withTraditionalFirstContactGreeting(text, lang = "es", state = null) {
  const body = String(text || "");
  if (!body) return body;
  if (state?.used) return body;
  if (/^(?:¡?\s*buenos\s+d[ií]as|¡?\s*buenas\s+tardes|¡?\s*hola|hello|hi\b|good\s+(?:morning|afternoon)|¡?\s*perfecto|great!)/i.test(body.trim())) {
    if (state) state.used = true;
    return body;
  }
  if (state) state.used = true;
  return `${kinesicaTraditionalGreeting(lang)}\n\n${body}`;
}

export function resolveOptionCText(chatLang, ctx) {
  const atmVal = parseInt(document.querySelector("#input-fee-atm")?.value, 10) || 65000;
  const genVal = parseInt(document.querySelector("#input-fee-general")?.value, 10) || 75000;
  const payVal = document.querySelector("#input-fee-payment-methods")?.value?.trim() || "Efectivo o transferencia bancaria";
  if (chatLang === "en") {
    const optCEn = pickSimText(ctx.inputs.optCEn, "opt_c_text_en", ctx);
    return renderOptCTextEn(optCEn, { atm: atmVal, general: genVal, payment_methods: payVal });
  }
  const optC = pickSimText(ctx.inputs.optC, "opt_c_text", ctx);
  return renderOptCText(optC, { atm: atmVal, general: genVal, payment_methods: payVal });
}

export function resolveProfessionalSubmenu(norm, chatLang, ctx) {
  let proMsg = (chatLang === "en")
    ? pickSimText(ctx.inputs.optE3En, "opt_e3_text_en", ctx)
    : pickSimText(ctx.inputs.optE3, "opt_e3_text", ctx);
  let alertTarget = "azar";
  let optionLabel = "E → consulta libre";
  if (norm === "1" || norm === "norberto") {
    alertTarget = "norberto";
    optionLabel = "E → 1 Norberto";
    proMsg = (chatLang === "en")
      ? pickSimText(ctx.inputs.optE1En, "opt_e1_text_en", ctx)
      : pickSimText(ctx.inputs.optE1, "opt_e1_text", ctx);
  } else if (norm === "2" || /^mar[ií]a$/.test(norm)) {
    alertTarget = "maria";
    optionLabel = "E → 2 María";
    proMsg = (chatLang === "en")
      ? pickSimText(ctx.inputs.optE2En, "opt_e2_text_en", ctx)
      : pickSimText(ctx.inputs.optE2, "opt_e2_text", ctx);
  } else if (norm === "3" || norm === "indistinto" || norm === "primera consulta" || norm === "either" || norm === "any") {
    alertTarget = "azar";
    optionLabel = "E → 3 Indistinto";
    proMsg = (chatLang === "en")
      ? pickSimText(ctx.inputs.optE3En, "opt_e3_text_en", ctx)
      : pickSimText(ctx.inputs.optE3, "opt_e3_text", ctx);
  }
  return { proMsg, alertTarget, optionLabel };
}

const NL_FEES = /\b(?:honorarios?|precios?|arancel(?:es)?|costos?|tarifas?|valor(?:es)?|cuanto\s+(?:sale|cuesta|vale)|fees?|prices?|costs?|rates?|how\s+much|obras?\s+social|prepagas?|osde|reintegros?)\b/i;
const NL_LOCATION = /\b(?:donde\s+(?:queda|estan|atienden)|direccion|ubicacion|como\s+llego|donde\s+es|horarios?|where\s+(?:are\s+you|is)|address|location|office\s+hours|opening\s+hours)\b/i;
const NL_ATTIRE = /\b(?:ropa|vestimenta|indumentaria|attire|clothes|clothing|what\s+(?:should\s+i\s+|to\s+)?wear|dress\s+code)\b/i;
const NL_BOOKING = /\b(?:agendar|agendame|sacar\s+turno|pedir\s+turno|reservar\s+turno|quiero\s+(?:un\s+)?turno|necesito\s+(?:un\s+)?turno|quisiera\s+(?:un\s+)?turno|turnera|book|appointment|schedule)\b/i;
const NL_PROFESSIONAL = /\b(?:profesional|hablar\s+con|practitioner|talk\s+to|speak\s+with)\b/i;

/**
 * Resuelve A–E. Con exactLetterOnly solo letras; si no, también NL.
 * viaNaturalLanguage + letter "a"|"b"|"c"|"d" → el caller puede anteponer saludo tradicional.
 */
export function resolveMainMenuResponse(norm, chatLang, ctx, opts = {}) {
  const exactOnly = opts.exactLetterOnly === true;
  const raw = String(norm || "");

  const isExactA = raw === "a" || raw.startsWith("opcion a") || raw.startsWith("option a");
  const isExactB = raw === "b" || raw.startsWith("opcion b") || raw.startsWith("option b");
  const isExactC = raw === "c" || raw.startsWith("opcion c") || raw.startsWith("option c");
  const isExactD = raw === "d" || raw.startsWith("opcion d") || raw.startsWith("option d");
  const isExactE = raw === "e" || raw.startsWith("opcion e") || raw.startsWith("option e");

  if (isExactA) {
    const text = (chatLang === "en")
      ? pickSimText(ctx.inputs.submenuTurnosEn, "submenu_turnos_text_en", ctx)
      : pickSimText(ctx.inputs.submenuTurnos, "submenu_turnos_text", ctx);
    return { handled: true, text, nextSubmenu: "turnos", letter: "a", viaNaturalLanguage: false };
  }
  const agendarInvite = (chatLang === "en")
    ? "📅 *Would you like to book?* You can check available days and times and reserve your session here:\n👉 *https://kinesica.com.ar/agendar*"
    : "📅 *¿Querés agendar?* Podés ver los días y horarios disponibles y reservar tu sesión acá:\n👉 *https://kinesica.com.ar/agendar*";

  if (!exactOnly && NL_BOOKING.test(raw) && !/\b(?:cancelar|anular|consultar|cancel|reschedule|check)\b/i.test(raw)) {
    // Alineado al bot: NL de agendar → texto de opción A (turnera), no el submenú.
    // Precio + agendar: honorarios primero; invite en followup (2ª burbuja).
    if (NL_FEES.test(raw)) {
      return {
        handled: true,
        text: resolveOptionCText(chatLang, ctx),
        followup: agendarInvite,
        nextSubmenu: null,
        letter: "c",
        viaNaturalLanguage: true,
      };
    }
    const text = (chatLang === "en")
      ? pickSimText(ctx.inputs.optAEn, "opt_a_text_en", ctx)
      : pickSimText(ctx.inputs.optA, "opt_a_text", ctx);
    return { handled: true, text, nextSubmenu: null, letter: "a", viaNaturalLanguage: true };
  }

  if (isExactB) {
    const text = (chatLang === "en")
      ? pickSimText(ctx.inputs.optBEn, "opt_b_text_en", ctx)
      : pickSimText(ctx.inputs.optB, "opt_b_text", ctx);
    return { handled: true, text, nextSubmenu: null, letter: "b", viaNaturalLanguage: false };
  }
  if (!exactOnly && NL_LOCATION.test(raw) && !/\bturnos?|appointments?\b/i.test(raw)) {
    const text = (chatLang === "en")
      ? pickSimText(ctx.inputs.optBEn, "opt_b_text_en", ctx)
      : pickSimText(ctx.inputs.optB, "opt_b_text", ctx);
    return { handled: true, text, nextSubmenu: null, letter: "b", viaNaturalLanguage: true };
  }

  if (isExactC) {
    return {
      handled: true,
      text: resolveOptionCText(chatLang, ctx),
      followup: agendarInvite,
      nextSubmenu: null,
      letter: "c",
      viaNaturalLanguage: false,
    };
  }
  if (!exactOnly && NL_FEES.test(raw)) {
    return {
      handled: true,
      text: resolveOptionCText(chatLang, ctx),
      followup: agendarInvite,
      nextSubmenu: null,
      letter: "c",
      viaNaturalLanguage: true,
    };
  }

  if (isExactD) {
    const optD = (chatLang === "en")
      ? pickSimText(ctx.inputs.optDEn, "opt_d_text_en", ctx)
      : pickSimText(ctx.inputs.optD, "opt_d_text", ctx);
    return { handled: true, text: withMenuFooter(optD, chatLang), nextSubmenu: null, letter: "d", viaNaturalLanguage: false };
  }
  if (!exactOnly && NL_ATTIRE.test(raw)) {
    const optD = (chatLang === "en")
      ? pickSimText(ctx.inputs.optDEn, "opt_d_text_en", ctx)
      : pickSimText(ctx.inputs.optD, "opt_d_text", ctx);
    return { handled: true, text: withMenuFooter(optD, chatLang), nextSubmenu: null, letter: "d", viaNaturalLanguage: true };
  }

  if (isExactE || (!exactOnly && NL_PROFESSIONAL.test(raw))) {
    const text = (chatLang === "en")
      ? pickSimText(ctx.inputs.optEEn, "opt_e_text_en", ctx)
      : pickSimText(ctx.inputs.optE, "opt_e_text", ctx);
    return {
      handled: true,
      text,
      nextSubmenu: "profesional",
      letter: "e",
      viaNaturalLanguage: !isExactE,
    };
  }
  return { handled: false, text: "", nextSubmenu: null, letter: null, viaNaturalLanguage: false };
}

export async function notifyProfessionalFromSimulator(target, optionLabel, patientMessage, onFail) {
  try {
    await api("clara-alert.php", {
      method: "POST",
      body: JSON.stringify({
        target,
        option_label: optionLabel,
        patient_message: patientMessage,
      }),
    });
  } catch (err) {
    const detail = (err && err.message && err.message !== "auth")
      ? err.message
      : "revisá WHATSAPP_TOKEN en config.php";
    if (onFail) {
      onFail(`⚠️ No pude avisar al profesional por WhatsApp: ${detail}`);
    }
  }
}
