/**
 * Kinésica Admin - Motor de Formato y Resolución del Simulador Clara
 * Formato Markdown, pie de menú, lógica de ramas conversacionales y alertas a profesionales.
 */

import { escapeHtml } from "./dom.js?v=78";
import { api } from "./api.js?v=78";
import { renderOptCText, renderOptCTextEn } from "./menu-texts.js?v=2";

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

export function resolveOptionCText(chatLang, ctx) {
  const atmVal = parseInt(document.querySelector("#input-fee-atm")?.value, 10) || 65000;
  const genVal = parseInt(document.querySelector("#input-fee-general")?.value, 10) || 75000;
  const payVal = document.querySelector("#input-fee-payment-methods")?.value?.trim() || "Efectivo o transferencia bancaria";
  if (chatLang === "en") {
    const optCEn = ctx.inputs.optCEn?.value?.trim() || ctx.getTexts().opt_c_text_en || ctx.defaults.opt_c_text_en;
    return renderOptCTextEn(optCEn, { atm: atmVal, general: genVal, payment_methods: payVal });
  }
  const optC = ctx.inputs.optC?.value?.trim() || ctx.getTexts().opt_c_text || ctx.defaults.opt_c_text;
  return renderOptCText(optC, { atm: atmVal, general: genVal, payment_methods: payVal });
}

export function resolveProfessionalSubmenu(norm, chatLang, ctx) {
  let proMsg = (chatLang === "en")
    ? (ctx.inputs.optE3En?.value?.trim() || ctx.getTexts().opt_e3_text_en || ctx.defaults.opt_e3_text_en)
    : (ctx.inputs.optE3?.value?.trim() || ctx.getTexts().opt_e3_text || ctx.defaults.opt_e3_text);
  let alertTarget = "azar";
  let optionLabel = "E → consulta libre";
  if (norm === "1" || norm === "norberto") {
    alertTarget = "norberto";
    optionLabel = "E → 1 Norberto";
    proMsg = (chatLang === "en")
      ? (ctx.inputs.optE1En?.value?.trim() || ctx.getTexts().opt_e1_text_en || ctx.defaults.opt_e1_text_en)
      : (ctx.inputs.optE1?.value?.trim() || ctx.getTexts().opt_e1_text || ctx.defaults.opt_e1_text);
  } else if (norm === "2" || /^mar[ií]a$/.test(norm)) {
    alertTarget = "maria";
    optionLabel = "E → 2 María";
    proMsg = (chatLang === "en")
      ? (ctx.inputs.optE2En?.value?.trim() || ctx.getTexts().opt_e2_text_en || ctx.defaults.opt_e2_text_en)
      : (ctx.inputs.optE2?.value?.trim() || ctx.getTexts().opt_e2_text || ctx.defaults.opt_e2_text);
  } else if (norm === "3" || norm === "indistinto" || norm === "primera consulta" || norm === "either" || norm === "any") {
    alertTarget = "azar";
    optionLabel = "E → 3 Indistinto";
    proMsg = (chatLang === "en")
      ? (ctx.inputs.optE3En?.value?.trim() || ctx.getTexts().opt_e3_text_en || ctx.defaults.opt_e3_text_en)
      : (ctx.inputs.optE3?.value?.trim() || ctx.getTexts().opt_e3_text || ctx.defaults.opt_e3_text);
  }
  return { proMsg, alertTarget, optionLabel };
}

export function resolveMainMenuResponse(norm, chatLang, ctx) {
  if (norm === "a" || norm.startsWith("opcion a") || norm.startsWith("option a") || norm.includes("turno") || norm.includes("agendar") || norm.includes("appointment") || norm.includes("book")) {
    const text = (chatLang === "en")
      ? (ctx.inputs.submenuTurnosEn?.value?.trim() || ctx.getTexts().submenu_turnos_text_en || ctx.defaults.submenu_turnos_text_en)
      : (ctx.inputs.submenuTurnos?.value?.trim() || ctx.getTexts().submenu_turnos_text || ctx.defaults.submenu_turnos_text);
    return { handled: true, text, nextSubmenu: "turnos" };
  }
  if (norm === "b" || norm.startsWith("opcion b") || norm.startsWith("option b") || norm.includes("donde queda") || norm.includes("ubicacion") || norm.includes("location")) {
    const text = (chatLang === "en")
      ? (ctx.inputs.optBEn?.value?.trim() || ctx.getTexts().opt_b_text_en || ctx.defaults.opt_b_text_en)
      : (ctx.inputs.optB?.value?.trim() || ctx.getTexts().opt_b_text || ctx.defaults.opt_b_text);
    return { handled: true, text, nextSubmenu: null };
  }
  if (norm === "c" || norm.startsWith("opcion c") || norm.startsWith("option c") || norm.includes("honorarios") || norm.includes("precio") || norm.includes("fees")) {
    return { handled: true, text: resolveOptionCText(chatLang, ctx), nextSubmenu: null };
  }
  if (norm === "d" || norm.startsWith("opcion d") || norm.startsWith("option d") || norm.includes("ropa") || norm.includes("vestimenta") || norm.includes("attire")) {
    const optD = (chatLang === "en")
      ? (ctx.inputs.optDEn?.value?.trim() || ctx.getTexts().opt_d_text_en || ctx.defaults.opt_d_text_en)
      : (ctx.inputs.optD?.value?.trim() || ctx.getTexts().opt_d_text || ctx.defaults.opt_d_text);
    return { handled: true, text: withMenuFooter(optD, chatLang), nextSubmenu: null };
  }
  if (norm === "e" || norm.startsWith("opcion e") || norm.startsWith("option e") || norm.includes("profesional") || norm.includes("hablar") || norm.includes("practitioner")) {
    const text = (chatLang === "en")
      ? (ctx.inputs.optEEn?.value?.trim() || ctx.getTexts().opt_e_text_en || ctx.defaults.opt_e_text_en)
      : (ctx.inputs.optE?.value?.trim() || ctx.getTexts().opt_e_text || ctx.defaults.opt_e_text);
    return { handled: true, text, nextSubmenu: "profesional" };
  }
  return { handled: false, text: "", nextSubmenu: null };
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
