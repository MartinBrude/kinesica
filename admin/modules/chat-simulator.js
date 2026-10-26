/**
 * Kinésica Admin - Simulador Interactivo de WhatsApp de Clara
 * ============================================================
 * Experiencia interactiva para probar el flujo de respuestas automáticas
 * a las opciones A-E, submenús y opciones personalizadas.
 */

import { renderOptCText, renderOptCTextEn } from "./menu-texts.js?v=2";
import { escapeHtml } from "./dom.js?v=78";
import { api } from "./api.js?v=78";

/**
 * Contexto inyectado por configuracion.js (evita import circular y estado duplicado).
 * getTexts / getCustomOptions se evalúan en cada uso para leer siempre el estado vigente.
 */
let ctx = {
  defaults: {},
  inputs: {},
  getTexts: () => ({}),
  getCustomOptions: () => [],
};

export function setChatContext(next) {
  ctx = { ...ctx, ...next };
}

// ----------------------------------------------------
// Simulador de Chat con Clara (WhatsApp Experience)
// ----------------------------------------------------
const chatMessagesEl = document.querySelector("#chat-demo-messages");
const chatFormEl = document.querySelector("#chat-demo-form");
const chatInputEl = document.querySelector("#chat-demo-input");
const chatQuickBtns = document.querySelectorAll(".chat-quick-btn");

let chatSubmenu = null; // 'turnos', 'profesional', etc.
let chatLang = "es";

function getNowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatWhatsAppMarkdown(rawText) {
  if (!rawText) return "";
  const escaped = escapeHtml(rawText);
  // Negrita: *texto* -> <strong>texto</strong>
  let formatted = escaped.replace(/\*([^*\n\r]+)\*/g, "<strong>$1</strong>");
  // Cursiva: _texto_ -> <em>texto</em>
  formatted = formatted.replace(/_([^_\n\r]+)_/g, "<em>$1</em>");
  // Enlaces http/https automáticos
  formatted = formatted.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#027eb5; text-decoration:underline;">$1</a>'
  );
  return formatted;
}

// Pie "volver al menú": solo se agrega si el texto no menciona ya MENU/menú (igual que el bot real).
function withMenuFooter(text, lang = chatLang) {
  const body = String(text || "").trim();
  if (!body) return body;
  const plain = body.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/menu/i.test(plain)) return body;
  const footer = (lang === "en") ? "_(Type *MENU* to see the options again)_" : "_(Escribí *MENU* para volver a ver las opciones)_";
  return `${body}\n\n${footer}`;
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

export function resetChatDemo(lang = chatLang) {
  if (!chatMessagesEl) return;
  chatMessagesEl.replaceChildren();
  chatSubmenu = null;
  chatLang = lang;
  let welcome;
  if (chatLang === "en") {
    welcome = ctx.inputs.menuWelcomeEn?.value?.trim() || ctx.getTexts().menu_welcome_en || ctx.defaults.menu_welcome_en;
  } else {
    welcome = ctx.inputs.menuWelcome?.value?.trim() || ctx.getTexts().menu_welcome || ctx.defaults.menu_welcome;
    if (ctx.getCustomOptions() && ctx.getCustomOptions().length > 0) {
      const extraLines = ctx.getCustomOptions()
        .filter((o) => o.letter && o.label)
        .map((o) => `*${o.letter.toUpperCase()}.* ${o.label}`)
        .join("\n");
      if (extraLines && !welcome.toUpperCase().includes(`*${ctx.getCustomOptions()[0].letter.toUpperCase()}.*`)) {
        if (welcome.includes("\n\n_(")) {
          welcome = welcome.replace("\n\n_(", `\n${extraLines}\n\n_(`);
        } else {
          welcome += `\n${extraLines}`;
        }
      }
    }
  }
  appendChatMessage(welcome, "bot");
}

function handleChatUserInput(inputRaw) {
  const input = (inputRaw || "").trim();
  if (!input) return;

  appendChatMessage(input, "user");

  const norm = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Reset / Menu
  if (norm === "menu" || norm === "reiniciar" || norm === "hola" || norm === "buenas") {
    setTimeout(() => {
      resetChatDemo(chatLang);
    }, 400);
    return;
  }

  // Cambio de idioma (English / Español)
  if (norm === "english" || norm === "ingles" || (norm === "f" && chatLang === "es")) {
    chatSubmenu = null;
    chatLang = "en";
    setTimeout(() => {
      resetChatDemo("en");
    }, 400);
    return;
  }
  if (norm === "espanol" || norm === "spanish" || (norm === "f" && chatLang === "en")) {
    chatSubmenu = null;
    chatLang = "es";
    setTimeout(() => {
      resetChatDemo("es");
    }, 400);
    return;
  }

  // Buscar coincidencia en opciones personalizadas
  const matchedCustom = ctx.getCustomOptions().find((o) => {
    const l = String(o.letter || "").toLowerCase();
    return l && (norm === l || norm === `opcion ${l}` || norm.startsWith(`${l}.`) || norm.startsWith(`${l} -`));
  });
  if (matchedCustom) {
    chatSubmenu = null;
    const resp = matchedCustom.response || "Información no disponible.";
    setTimeout(() => {
      appendChatMessage(withMenuFooter(resp, chatLang), "bot");
    }, 450);
    return;
  }

  // Si está en submenú Turnos
  if (chatSubmenu === "turnos") {
    if (norm === "1" || norm === "agendar" || norm === "book" || norm === "schedule") {
      chatSubmenu = null;
      const optA = (chatLang === "en")
        ? (ctx.inputs.optAEn?.value?.trim() || ctx.getTexts().opt_a_text_en || ctx.defaults.opt_a_text_en)
        : (ctx.inputs.optA?.value?.trim() || ctx.getTexts().opt_a_text || ctx.defaults.opt_a_text);
      setTimeout(() => {
        appendChatMessage(optA, "bot");
      }, 500);
      return;
    }
    if (norm === "2" || norm === "consultar" || norm === "cancelar" || norm === "check" || norm === "cancel") {
      chatSubmenu = "buscar_dni";
      const optA2 = (chatLang === "en")
        ? (ctx.inputs.optA2En?.value?.trim() || ctx.getTexts().opt_a2_text_en || ctx.defaults.opt_a2_text_en)
        : (ctx.inputs.optA2?.value?.trim() || ctx.getTexts().opt_a2_text || ctx.defaults.opt_a2_text);
      setTimeout(() => {
        appendChatMessage(optA2, "bot");
      }, 600);
      return;
    }
  }

  // Si está en espera de búsqueda por DNI o Documento
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

  // Si está en submenú Profesional (mismas respuestas que el bot real)
  if (chatSubmenu === "profesional") {
    let proMsg = (chatLang === "en")
      ? (ctx.inputs.optE3En?.value?.trim() || ctx.getTexts().opt_e3_text_en || ctx.defaults.opt_e3_text_en)
      : (ctx.inputs.optE3?.value?.trim() || ctx.getTexts().opt_e3_text || ctx.defaults.opt_e3_text);
    /** @type {"norberto"|"maria"|"azar"} */
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
    chatSubmenu = null;
    const patientMessage = input;
    setTimeout(() => {
      appendChatMessage(proMsg, "bot");
      notifyProfessionalFromSimulator(alertTarget, optionLabel, patientMessage);
    }, 500);
    return;
  }

  // Opciones A a E
  if (norm === "a" || norm.startsWith("opcion a") || norm.startsWith("option a")) {
    chatSubmenu = "turnos";
    const subTurnosMsg = (chatLang === "en")
      ? (ctx.inputs.submenuTurnosEn?.value?.trim() || ctx.getTexts().submenu_turnos_text_en || ctx.defaults.submenu_turnos_text_en)
      : (ctx.inputs.submenuTurnos?.value?.trim() || ctx.getTexts().submenu_turnos_text || ctx.defaults.submenu_turnos_text);
    setTimeout(() => {
      appendChatMessage(subTurnosMsg, "bot");
    }, 450);
    return;
  }

  if (norm === "b" || norm.startsWith("opcion b") || norm.startsWith("option b") || norm.includes("donde queda") || norm.includes("ubicacion") || norm.includes("location")) {
    chatSubmenu = null;
    const optB = (chatLang === "en")
      ? (ctx.inputs.optBEn?.value?.trim() || ctx.getTexts().opt_b_text_en || ctx.defaults.opt_b_text_en)
      : (ctx.inputs.optB?.value?.trim() || ctx.getTexts().opt_b_text || ctx.defaults.opt_b_text);
    setTimeout(() => {
      appendChatMessage(optB, "bot");
    }, 450);
    return;
  }

  if (norm === "c" || norm.startsWith("opcion c") || norm.startsWith("option c") || norm.includes("honorarios") || norm.includes("precio") || norm.includes("fees")) {
    chatSubmenu = null;
    const atmVal = parseInt(document.querySelector("#input-fee-atm")?.value, 10) || 65000;
    const genVal = parseInt(document.querySelector("#input-fee-general")?.value, 10) || 75000;
    const payVal = document.querySelector("#input-fee-payment-methods")?.value?.trim() || "Efectivo o transferencia bancaria";
    let feeMsg;
    if (chatLang === "en") {
      const optCEn = ctx.inputs.optCEn?.value?.trim() || ctx.getTexts().opt_c_text_en || ctx.defaults.opt_c_text_en;
      feeMsg = renderOptCTextEn(optCEn, { atm: atmVal, general: genVal, payment_methods: payVal });
    } else {
      const optC = ctx.inputs.optC?.value?.trim() || ctx.getTexts().opt_c_text || ctx.defaults.opt_c_text;
      feeMsg = renderOptCText(optC, { atm: atmVal, general: genVal, payment_methods: payVal });
    }
    setTimeout(() => {
      appendChatMessage(feeMsg, "bot");
    }, 450);
    return;
  }

  if (norm === "d" || norm.startsWith("opcion d") || norm.startsWith("option d") || norm.includes("ropa") || norm.includes("vestimenta") || norm.includes("attire")) {
    chatSubmenu = null;
    const optD = (chatLang === "en")
      ? (ctx.inputs.optDEn?.value?.trim() || ctx.getTexts().opt_d_text_en || ctx.defaults.opt_d_text_en)
      : (ctx.inputs.optD?.value?.trim() || ctx.getTexts().opt_d_text || ctx.defaults.opt_d_text);
    setTimeout(() => {
      appendChatMessage(withMenuFooter(optD, chatLang), "bot");
    }, 450);
    return;
  }

  if (norm === "e" || norm.startsWith("opcion e") || norm.startsWith("option e") || norm.includes("profesional") || norm.includes("hablar") || norm.includes("practitioner")) {
    chatSubmenu = "profesional";
    const optE = (chatLang === "en")
      ? (ctx.inputs.optEEn?.value?.trim() || ctx.getTexts().opt_e_text_en || ctx.defaults.opt_e_text_en)
      : (ctx.inputs.optE?.value?.trim() || ctx.getTexts().opt_e_text || ctx.defaults.opt_e_text);
    setTimeout(() => {
      appendChatMessage(optE, "bot");
    }, 450);
    return;
  }

  // Respuesta por defecto con el menú
  setTimeout(() => {
    const fallbackMsg = (chatLang === "en")
      ? "I'm sorry, I couldn't understand that option. Please reply with one of the menu letters or type *MENU* 🙌."
      : "Disculpame, no llegué a comprender esa opción. Por favor ingresá una de las letras del menú o escribí *MENU* 🙌.";
    appendChatMessage(fallbackMsg, "bot");
  }, 500);
}

/**
 * Avisa por WhatsApp real al profesional (DEMO · Simulador Clara).
 * @param {"norberto"|"maria"|"azar"} target
 * @param {string} optionLabel
 * @param {string} patientMessage
 */
async function notifyProfessionalFromSimulator(target, optionLabel, patientMessage) {
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
    appendChatMessage(
      `⚠️ No pude avisar al profesional por WhatsApp: ${detail}`,
      "bot"
    );
  }
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
      if (act) {
        handleChatUserInput(act);
      }
    });
  });
}
